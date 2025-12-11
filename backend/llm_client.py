"""
Centralized Client for GitHub Models API (via Azure AI Inference)
Uses requests directly for simpler header handling.
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

# Global state to store latest known limits
CACHED_RATE_LIMITS = {
    "limit_requests": "Unknown",
    "remaining_requests": "Unknown",
    "reset_requests": None,
    "limit_tokens": "Unknown",
    "remaining_tokens": "Unknown",
    "reset_tokens": None,
}

def _update_rate_limits(headers):
    """Parses standard x-ratelimit headers and updates the cache."""
    global CACHED_RATE_LIMITS
    
    # Helper to clean header values
    def g(key): return headers.get(key, "").strip() or headers.get(key.lower(), "").strip()

    # Capture both request and token limits if available
    req_lim = g("x-ratelimit-limit-requests")
    req_rem = g("x-ratelimit-remaining-requests")
    req_res = g("x-ratelimit-reset-requests")
    
    tok_lim = g("x-ratelimit-limit-tokens")
    tok_rem = g("x-ratelimit-remaining-tokens")
    tok_res = g("x-ratelimit-reset-tokens")

    if req_lim: CACHED_RATE_LIMITS["limit_requests"] = req_lim
    if req_rem: CACHED_RATE_LIMITS["remaining_requests"] = req_rem
    if req_res: CACHED_RATE_LIMITS["reset_requests"] = req_res
    
    if tok_lim: CACHED_RATE_LIMITS["limit_tokens"] = tok_lim
    if tok_rem: CACHED_RATE_LIMITS["remaining_tokens"] = tok_rem
    if tok_res: CACHED_RATE_LIMITS["reset_tokens"] = tok_res


def query_llm(messages, max_tokens=1000, temperature=0.1, model="gpt-4o-mini", json_mode=False):
    """
    Sends a request to the GitHub Models API.
    Returns: (content_string, updated_rate_limits_dict)
    """
    endpoint = "https://models.inference.ai.azure.com/chat/completions"
    token = os.getenv("MODEL_API_KEY")
    
    if not token:
        raise ValueError("MODEL_API_KEY is missing in .env")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }

    payload = {
        "messages": messages,
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens
    }
    
    if json_mode:
        payload["response_format"] = { "type": "json_object" }

    try:
        response = requests.post(endpoint, headers=headers, json=payload, timeout=180)
        
        # Always try to update limits from headers, even on error response if headers exist
        _update_rate_limits(response.headers)
        
        response.raise_for_status() # Raise error for non-200
        
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        
        return content, CACHED_RATE_LIMITS

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            retry_after = e.response.headers.get("Retry-After")
            reset_time = e.response.headers.get("x-ratelimit-reset-requests")
            
            def format_time(seconds):
                try:
                    s = int(float(seconds))
                    if s < 60: return f"{s}s"
                    elif s < 3600: return f"{s//60}m {s%60}s"
                    else: return f"{s//3600}h {(s%3600)//60}m"
                except: return f"{seconds}s"

            wait_time_seconds = 0
            if retry_after:
                wait_time_seconds = retry_after
            elif reset_time:
                wait_time_seconds = reset_time
            
            human_readable = format_time(wait_time_seconds)
            
            # Pass both human readable AND raw seconds for frontend parsing
            raise Exception(f"API Rate Limit Hit. Please wait {human_readable} (wait {wait_time_seconds}s) before trying again.")
        raise e

    except requests.exceptions.RequestException as e:
        print(f"LLM Details: {e}")
        if e.response:
             print(f"LLM Response: {e.response.text}")
        raise e
