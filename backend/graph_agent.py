import networkx as nx
import json
from llm_client import query_llm

class GraphAgent:
    def __init__(self):
        self.graph = nx.DiGraph()
    
    def extract_graph_from_text(self, text: str):
        """
        Extract entities/relations using GPT-4o Mini (via llm_client) and build the graph.
        Returns: Tuple(triples, rate_limit_info)
        """
        self.graph.clear()
        
        input_text = text[:60000]
        print(f"Extracting graph from {len(input_text)} chars using GPT-4o Mini...")
        
        # Dynamic Limit Logic
        # Base 20 relationships (for small files), plus 1 for every 500 characters
        # Cap at 80 to prevent graph explosions
        char_count = len(input_text)
        dynamic_limit = 20 + (char_count // 500)
        dynamic_limit = min(dynamic_limit, 80) # Increased cap for larger context
        
        prompt_text = f"""
        Extract a COMPREHENSIVE knowledge graph from the text below.
        Return a JSON object with a list of triples.
        
        CRITICAL INSTRUCTION: Analyze the document content to Determine its Domain (e.g., Legal, Scientific, Narrative, Technical, etc.).
        
        Dynamically create a hierarchical structure that best fits the content.
        Do NOT force a specific schema. Instead, invent categories that make sense for this specific text.
        
        General Logic for ANY Document (Chain of Thought):
        1. **SCAN**: identifying all Key Entities first (People, Organizations, Dates, Locations, Events, Concepts).
        2. **CATEGORIZE**: Group these entities into logical high-level themes (e.g., "Experience", "Methodology", "Findings").
        3. **LINK**: Create hierarchical connections from Document -> Category -> Entity -> Details.
        
        CRITICAL: ensuring "Who", "What", "When", and "Where" are covered.
        
        Example (Abstract):
        - "Document" -> "Category A (e.g. Findings)" -> "Item 1"
        - "Item 1" -> "Detail X" -> "Value"
        - "Document" -> "Category B (e.g. Methodology)" -> "Process Z"
        
        Format: {{ "triples": [ {{"source": "Parent Node", "target": "Child Node", "relation": "relationship"}} ] }}
        Target: Extract at least {dynamic_limit} relationships. If the content is sparse and you cannot reach this target, extract as many meaningful relationships as possible without hallucinating.
        
        Text:
        {input_text} 
        """

        messages = [
            {"role": "system", "content": "You are a JSON-speaking API."},
            {"role": "user", "content": prompt_text}
        ]

        try:
            # Query LLM to get graph structure
            raw_content, rate_limits = query_llm(
                messages=messages, 
                model="gpt-4o-mini",
                json_mode=True,
                max_tokens=14000
            )

            # Clean up markdown code blocks if present
            cleaned_content = raw_content.replace('```json', '').replace('```', '').strip()
            
            try:
                data = json.loads(cleaned_content)
            except json.JSONDecodeError:
                print("JSON decode failed, attempting regex extraction...")
                import re
                match = re.search(r'\{.*\}', cleaned_content, re.DOTALL)
                if match:
                    data = json.loads(match.group())
                else:
                    raise ValueError("Could not find valid JSON in response")
            
            triples = data.get("triples", [])

            if not triples:
                print("WARNING: Extracted triples list is empty.")
                return [], rate_limits

            # Build graph
            temp_graph = nx.Graph()
            root_node = "Document"
            temp_graph.add_node(root_node, group=0)

            for item in triples:
                if not isinstance(item, dict) or 'source' not in item or 'target' not in item or 'relation' not in item:
                    continue    
                src = item['source']
                tgt = item['target']
                rel = item['relation']
                if not src or not tgt:
                    continue
                temp_graph.add_node(src, group=1)
                temp_graph.add_node(tgt, group=1)
                temp_graph.add_edge(src, tgt, label=rel)
                temp_graph.add_edge(root_node, src, label="contains")
            
            self.graph = temp_graph
            return triples, rate_limits
            
        except Exception as e:
            print(f"Error calling GPT-4o Mini: {e}")
            raise 

    def reset_graph(self):
        self.graph.clear()
        return []

    def get_graph_data(self):
        nodes = [{"id": n, "group": self.graph.nodes[n].get("group", 1)} for n in self.graph.nodes()]
        links = [{"source": u, "target": v, "label": d.get("label", "")} for u, v, d in self.graph.edges(data=True)]
        return {"nodes": nodes, "links": links}

    def get_triples_as_text(self):
        """
        Returns a string representation of the graph for LLM context.
        """
        if self.graph.number_of_edges() == 0:
            return ""
            
        text = "Extracted Knowledge Graph Relationships:\n"
        for u, v, data in self.graph.edges(data=True):
            label = data.get("label", "related to")
            text += f"- {u} [{label}] {v}\n"
        
        return text