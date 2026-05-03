import os
import json
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

def ingest_single_project(project_name, description, technologies):
    """
    Ingest a project into the LangChain ChromaDB
    """
    base_path = "../knowledge_base"
    project_path = os.path.join(base_path, project_name)
    
    if not os.path.exists(project_path):
        raise ValueError(f"Project path does not exist: {project_path}")
    
    print(f"📁 Loading documents from: {project_path}")
    
    # Load documents
    documents = []
    extensions = (".py", ".java", ".js", ".md", ".txt", ".html", ".css", ".json")
    
    for root, dirs, files in os.walk(project_path):
        # Skip unnecessary directories
        dirs[:] = [d for d in dirs if d not in ["node_modules", ".git", "__pycache__", "venv", "dist", "build"]]
        
        for file in files:
            if not file.endswith(extensions):
                continue
                
            file_path = os.path.join(root, file)
            
            try:
                loader = TextLoader(file_path, encoding="utf-8")
                docs = loader.load()
                
                # Add metadata to each document
                for doc in docs:
                    doc.metadata["project"] = project_name
                    doc.metadata["description"] = description
                    doc.metadata["technologies"] = json.dumps(technologies) if isinstance(technologies, list) else technologies
                    doc.metadata["source"] = file_path
                
                documents.extend(docs)
                print(f"  ✅ Loaded: {file}")
                
            except Exception as e:
                print(f"  ❌ Error loading {file}: {e}")
    
    if not documents:
        raise ValueError(f"No documents found in {project_path}")
    
    print(f"📄 Total documents loaded: {len(documents)}")
    
    # Split documents
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500, 
        chunk_overlap=50
    )
    chunks = splitter.split_documents(documents)
    print(f"✂️  Created {len(chunks)} chunks")
    
    # Initialize embeddings (MUST match chatbot.py)
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
    
    # Connect to the SAME Chroma database as chatbot.py
    db = Chroma(
        persist_directory="../db",
        embedding_function=embeddings,
        collection_name="projects_kb"  # Must match chatbot.py
    )
    
    # Add documents to Chroma
    print("💾 Adding to ChromaDB...")
    db.add_documents(chunks)
    # REMOVED: db.persist()  # This line was causing the error
    
    print(f"✅ Projet ajouté dynamiquement : {project_name}")
    
    # Try to get count (optional, may not work in all versions)
    try:
        total_chunks = db._collection.count()
        print(f"   📊 Total chunks in DB: {total_chunks}")
    except:
        print(f"   📊 Chunks added: {len(chunks)}")
    
    return {
        "status": "success",
        "project": project_name,
        "chunks_added": len(chunks)
    }