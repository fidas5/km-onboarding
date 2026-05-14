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
    # Étape 1: Vérification du chemin du projet
    base_path = "../knowledge_base"
    project_path = os.path.join(base_path, project_name)
    
    if not os.path.exists(project_path):
        raise ValueError(f"Project path does not exist: {project_path}")
    
    print(f"📁 Loading documents from: {project_path}")
    
    # Étape 2: Parcours des fichiers du projet

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
                #Étape 3: Chargement de chaque fichier
                loader = TextLoader(file_path, encoding="utf-8")  #Charge le fichier et crée un objet Document avec: -page_content: Le texte du fichier , -metadata: Dictionnaire vide (on va l'enrichir)
                docs = loader.load()
                
                # Étape 4: Ajout de métadonnées
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
    
    # Étape 5: Découpage en chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500, # Taille maximale de chaque chunk
        chunk_overlap=50  # Chevauchement entre chunks :Évite de couper une phrase importante en plein milieu
    )
    chunks = splitter.split_documents(documents)
    print(f"✂️  Created {len(chunks)} chunks")
    
    # Étape 6: Création des embeddings
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
    
    # Étape 7: Connexion à ChromaDB
    db = Chroma(
        persist_directory="../db",  # Dossier où stocker la base
        embedding_function=embeddings,  # Fonction pour créer les vecteurs
        collection_name="projects_kb"   # Nom de la collection
    )
    
    # Étape 8: Ajout des chunks à la base
    print("💾 Adding to ChromaDB...")
    db.add_documents(chunks)
    
    print(f"✅ Projet ajouté dynamiquement : {project_name}")
    
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