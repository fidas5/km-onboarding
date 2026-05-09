from chatbot import db
import json
import os

def explorer_chromadb(output_dir="chroma_export"):
    """Explore complètement ChromaDB et sauvegarde dans des fichiers"""
    
    # Créer le dossier de sortie
    os.makedirs(output_dir, exist_ok=True)
    
    # Récupérer tous les documents
    docs = db.get()
    
    # 1. Statistiques générales
    stats = {
        "total_documents": len(docs['ids']),
        "total_ids_uniques": len(set(docs['ids'])),
        "projects": {}
    }
    
    # 2. Projets disponibles
    projects = {}
    for meta in docs["metadatas"]:
        if meta:
            project = meta.get("project", "unknown")
            if project not in projects:
                projects[project] = 0
            projects[project] += 1
    
    stats["projects"] = projects
    
    # Sauvegarder les statistiques
    with open(os.path.join(output_dir, "statistiques.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    # 3. Détails par projet
    projects_data = {}
    for project in projects.keys():
        project_docs = []
        for i, meta in enumerate(docs["metadatas"]):
            if meta and meta.get("project") == project:
                doc_info = {
                    "index": i + 1,
                    "id": docs['ids'][i],
                    "type": meta.get('type', 'unknown'),
                    "source": meta.get('source', 'unknown'),
                    "content": docs['documents'][i] if docs['documents'][i] else ""
                }
                project_docs.append(doc_info)
        
        projects_data[project] = project_docs
        
        # Sauvegarder chaque projet dans un fichier séparé
        with open(os.path.join(output_dir, f"{project}_documents.json"), "w", encoding="utf-8") as f:
            json.dump(project_docs, f, indent=2, ensure_ascii=False)
        
        # Aussi en format texte lisible
        with open(os.path.join(output_dir, f"{project}_contenu.txt"), "w", encoding="utf-8") as f:
            f.write(f"📦 PROJET: {project.upper()}\n")
            f.write("="*60 + "\n\n")
            for doc in project_docs:
                f.write(f"Document {doc['index']}:\n")
                f.write(f"ID: {doc['id']}\n")
                f.write(f"Type: {doc['type']}\n")
                f.write(f"Source: {doc['source']}\n")
                f.write(f"Contenu:\n{doc['content']}\n")
                f.write("-"*40 + "\n\n")
    
    # 4. Export complet
    export_data = {
        "export_date": str(__import__('datetime').datetime.now()),
        "total_documents": len(docs['ids']),
        "projects": projects,
        "documents": [
            {
                "id": docs['ids'][i],
                "content": docs['documents'][i],
                "metadata": docs['metadatas'][i]
            }
            for i in range(len(docs['ids']))
        ]
    }
    
    # Sauvegarder l'export complet
    with open(os.path.join(output_dir, "chromadb_export_complet.json"), "w", encoding="utf-8") as f:
        json.dump(export_data, f, indent=2, ensure_ascii=False)
    
    # 5. Sauvegarder les IDs seulement
    ids_list = docs['ids']
    with open(os.path.join(output_dir, "tous_les_ids.txt"), "w", encoding="utf-8") as f:
        for doc_id in ids_list:
            f.write(f"{doc_id}\n")
    
    # 6. Créer un résumé markdown
    with open(os.path.join(output_dir, "RESUME.md"), "w", encoding="utf-8") as f:
        f.write(f"# Export ChromaDB\n\n")
        f.write(f"**Date d'export:** {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write(f"## Statistiques\n\n")
        f.write(f"- Total documents: **{len(docs['ids'])}**\n")
        f.write(f"- IDs uniques: **{len(set(docs['ids']))}**\n")
        f.write(f"- Nombre de projets: **{len(projects)}**\n\n")
        f.write(f"## Projets\n\n")
        for project, count in projects.items():
            f.write(f"- **{project}**: {count} documents\n")
        f.write(f"\n## Fichiers générés\n\n")
        f.write(f"1. `statistiques.json` - Statistiques générales\n")
        f.write(f"2. `chromadb_export_complet.json` - Export complet en JSON\n")
        f.write(f"3. `tous_les_ids.txt` - Liste de tous les IDs\n")
        f.write(f"4. Dossiers par projet:\n")
        for project in projects.keys():
            f.write(f"   - `{project}_documents.json` - Documents du projet\n")
            f.write(f"   - `{project}_contenu.txt` - Contenu lisible du projet\n")
    
    print(f"\n✅ Export terminé !")
    print(f"📁 Dossier: {os.path.abspath(output_dir)}")
    print(f"\n📄 Fichiers créés:")
    print(f"   - statistiques.json")
    print(f"   - chromadb_export_complet.json")
    print(f"   - tous_les_ids.txt")
    print(f"   - RESUME.md")
    for project in projects.keys():
        print(f"   - {project}_documents.json")
        print(f"   - {project}_contenu.txt")
    
    return output_dir

# Exécuter
if __name__ == "__main__":
    # Vous pouvez spécifier le dossier de sortie
    # explorer_chromadb("mon_export_chroma")  # Dossier personnalisé
    explorer_chromadb()  # Dossier par défaut: "chroma_export"