"""
Centralized LLM Client
Uses requests directly for simpler header handling.
"""
import requests
import os
import time
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


def query_llm(messages, max_tokens=4000, temperature=0.1, model="gemini-2.5-flash", json_mode=False):
    """
    Sends a request to the Google Gemini API (via OpenAI-compatible endpoint).
    Returns: (content_string, updated_rate_limits_dict)
    """
    token = os.getenv("GEMINI_API_KEY") or os.getenv("MODEL_API_KEY") or os.getenv("GROQ_API_KEY")
    if not token:
        raise ValueError("API Key is missing. Please set GEMINI_API_KEY or MODEL_API_KEY in your environment.")

    # Auto-detect provider if Groq key is used
    if token.startswith("gsk_"):
        endpoint = "https://api.groq.com/openai/v1/chat/completions"
        if model.startswith("gemini"):
            model = "qwen/qwen3.8-27b"
    else:
        # Default: Google Gemini endpoint
        endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        if not model.startswith("gemini"):
            model = "gemini-2.5-flash"

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

    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            response = requests.post(endpoint, headers=headers, json=payload, timeout=180)
            
            # Always try to update limits from headers
            _update_rate_limits(response.headers)
            
            # Handle transient high-demand / server errors with backoff
            if response.status_code in [500, 502, 503, 504] and attempt < max_attempts - 1:
                wait_time = 2 * (attempt + 1)
                print(f"Server returned {response.status_code}. Retrying in {wait_time}s (attempt {attempt + 1}/{max_attempts})...")
                time.sleep(wait_time)
                continue

            response.raise_for_status()
            
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
                raise Exception(f"API Rate Limit Hit. Please wait {human_readable} (wait {wait_time_seconds}s) before trying again.")

            if e.response.status_code in [500, 502, 503, 504] and attempt < max_attempts - 1:
                wait_time = 2 * (attempt + 1)
                print(f"Transient error {e.response.status_code}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue
            raise e

        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
            if attempt < max_attempts - 1:
                wait_time = 2 * (attempt + 1)
                print(f"Network error: {e}. Retrying in {wait_time}s...")
                time.sleep(wait_time)
                continue
            raise e
