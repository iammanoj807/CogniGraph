import chromadb
from chromadb.utils import embedding_functions

class RAGEngine:
    def __init__(self):
        # Initialize ChromaDB (in-memory for demo)
        self.client = chromadb.Client()
        self.collection = self.client.get_or_create_collection(name="cognigraph_docs")
        # Default embedding function is usually built-in (all-MiniLM-L6-v2)
    
    def reset(self):
        """
        Clear all documents from the vector store.
        Called before processing a new document to prevent stale data.
        """
        try:
            self.client.delete_collection(name="cognigraph_docs")
            self.collection = self.client.get_or_create_collection(name="cognigraph_docs")
            print("RAG Engine reset: Cleared all previous documents.")
        except Exception as e:
            print(f"RAG reset warning: {e}")
            # Collection might not exist, which is fine
        
    def add_document(self, text: str, doc_id: str):
        """
        Chunk text and add to vector store.
        """
        # Chunking strategy: 1000 chars with 200 char overlap.
        # Overlap prevents context loss at chunk boundaries.
        chunk_size = 1000
        overlap = 200
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start += (chunk_size - overlap)
            
        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        
        self.collection.add(
            documents=chunks,
            ids=ids,
            metadatas=[{"source": doc_id} for _ in chunks]
        )
        print(f"Added {len(chunks)} chunks to RAG engine (size={chunk_size}, overlap={overlap}).")

    def query(self, query_text: str, n_results=3):
        """
        Retrieve relevant chunks.
        """
        results = self.collection.query(
            query_texts=[query_text],
            n_results=n_results
        )
        return results['documents'][0] if results['documents'] else []