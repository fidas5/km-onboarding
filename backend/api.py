from flask_cors import CORS
from chatbot import ask_question
from langdetect import detect
from chatbot import db
from flask import Flask, Response, jsonify, request
import time

import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
import json


from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer

import os
import shutil
import subprocess
import sys
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
app = Flask(__name__)
load_dotenv()


app.config["MAIL_SERVER"] = "smtp.gmail.com"
app.config["MAIL_PORT"] = 587
app.config["MAIL_USE_TLS"] = True
app.config["MAIL_USERNAME"] = os.getenv("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.getenv("MAIL_PASSWORD")

mail = Mail(app)

serializer = URLSafeTimedSerializer("SECRET_KEY")

# ============================================
# MODIFICATION: Fonction pour créer une nouvelle connexion
# ============================================
def get_db_connection():
    """Crée une nouvelle connexion MySQL pour chaque requête"""
    return mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME'),
        port=int(os.getenv('DB_PORT'))
    )

# ============================================
# ATTENTION: Gardez ces connexions globales pour les routes existantes
# mais on va les réinitialiser en cas de problème
# ============================================
database = mysql.connector.connect(
    host=os.getenv('DB_HOST'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database=os.getenv('DB_NAME'),
    port=int(os.getenv('DB_PORT'))
)
cursor = database.cursor(dictionary=True)

import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

sys.path.append(PROJECT_ROOT)
# autoriser React
CORS(app)

def detect_language(text):
    try:
        return detect(text)
    except:
        return "fr"


#classe les technologies en 3 catégories pour personnaliser le plan
def analyze_profile(tech_levels):
    weak = []
    medium = []
    strong = []

    for tech, level in tech_levels.items():
        if level in ["none", "junior"]:
            weak.append(tech)
        elif level == "intermediate":
            medium.append(tech)
        else:
            strong.append(tech)

    return weak, medium, strong

@app.route("/ask", methods=["POST"])
def ask():
    data = request.json
    question = data.get("question")
    project = data.get("project")
    chat_id = data.get("chat_id")  # =%

    def generate():
        try:
            result = ask_question(question, "fr", project, chat_id, database)
            answer = result["answer"]

            for char in answer:
                yield char
                time.sleep(0.01)

        except Exception as e:
            
            yield f"\n[ERROR] {str(e)}"

    return Response(generate(), content_type="text/plain")


@app.route("/projects", methods=["GET"])
def get_projects():
    docs = db.get()

    projects = {}

    for meta in docs["metadatas"]:
        name = meta.get("project")

        if not name:
            continue

        # 🔥 récupérer technologies proprement
        techs = meta.get("technologies", [])

        # ⚠️ si c'est une string → convertir en liste
        if isinstance(techs, str):
            try:
                techs = json.loads(techs)
            except:
                techs = []

        # 🔥 ajouter projet s'il n'existe pas encore
        if name not in projects:
            projects[name] = {
                "description": meta.get("description", ""),
                "technologies": techs
            }

    return jsonify(projects)


@app.route("/delete_project", methods=["DELETE"])
def delete_project():
    data = request.json
    project_name = data.get("project_name")
    
    if not project_name:
        return jsonify({"error": "Project name is required"}), 400
    
    try:
        # 1. Supprimer de ChromaDB
        docs = db.get()
        
        ids_to_delete = []
        for i, meta in enumerate(docs["metadatas"]):
            if meta and meta.get("project") == project_name:
                ids_to_delete.append(docs["ids"][i])
        
        if ids_to_delete:
            db.delete(ids=ids_to_delete)
            print(f"✅ Supprimé {len(ids_to_delete)} vecteurs pour '{project_name}'")
        
        # 2. Nettoyer MySQL
        cursor = database.cursor()
        
        # Supprimer les messages
        cursor.execute("""
            DELETE m FROM messages m
            INNER JOIN chats c ON m.chat_id = c.id
            WHERE c.project = %s
        """, (project_name,))
        
        # Supprimer les chats
        cursor.execute("DELETE FROM chats WHERE project = %s", (project_name,))
        
        # Supprimer les learning paths
        cursor.execute("DELETE FROM learning_paths WHERE project = %s", (project_name,))
        
        database.commit()
        
        # 3. Optionnel : Supprimer le dossier physique du projet
        import shutil
        knowledge_base_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "knowledge_base", project_name)
        if os.path.exists(knowledge_base_path):
            shutil.rmtree(knowledge_base_path)
            print(f"✅ Dossier supprimé: {knowledge_base_path}")
        
        return jsonify({
            "message": f"Project '{project_name}' deleted successfully",
            "vectors_deleted": len(ids_to_delete)
        }), 200
        
    except Exception as e:
        database.rollback()
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/projects/<string:project_name>", methods=["PUT"])
def modify_project(project_name):
    """
    Modifier un projet existant par son NOM (description, technologies)
    """
    data = request.json
    new_name = data.get("name")
    new_description = data.get("description")
    new_technologies = data.get("technologies")
    
    if not any([new_name, new_description, new_technologies]):
        return jsonify({"error": "Au moins un champ à modifier (name, description, technologies) est requis"}), 400
    
    try:
        # 1. Vérifier si le projet existe dans ChromaDB
        docs = db.get()
        project_exists = False
        ids_to_update = []
        
        for i, meta in enumerate(docs["metadatas"]):
            if meta and meta.get("project") == project_name:
                project_exists = True
                ids_to_update.append(docs["ids"][i])
        
        if not project_exists:
            return jsonify({"error": f"Projet '{project_name}' non trouvé"}), 404
        
        # 2. Si le nom change, vérifier que le nouveau nom n'existe pas déjà
        if new_name and new_name != project_name:
            for meta in docs["metadatas"]:
                if meta and meta.get("project") == new_name:
                    return jsonify({"error": f"Le projet '{new_name}' existe déjà"}), 409
        
        # 3. Mettre à jour dans ChromaDB - Version CORRIGÉE
        for doc_id in ids_to_update:
            # Récupérer les métadonnées existantes
            doc_index = docs["ids"].index(doc_id)
            current_metadata = docs["metadatas"][doc_index].copy()
            
            # Mettre à jour les champs modifiés
            if new_name:
                current_metadata["project"] = new_name
            if new_description:
                current_metadata["description"] = new_description
            if new_technologies is not None:
                if isinstance(new_technologies, str):
                    try:
                        new_technologies = json.loads(new_technologies)
                    except:
                        new_technologies = []
                current_metadata["technologies"] = new_technologies
            
            # ✅ Correction: Utiliser db._collection.update() au lieu de db.update()
            db._collection.update(
                ids=[doc_id],
                metadatas=[current_metadata]
            )
        
        # 4. Si le nom a changé, mettre à jour dans MySQL
        if new_name and new_name != project_name:
            cursor = database.cursor()
            
            # Mettre à jour dans chats
            cursor.execute("UPDATE chats SET project = %s WHERE project = %s", (new_name, project_name))
            
            # Mettre à jour dans learning_paths
            cursor.execute("UPDATE learning_paths SET project = %s WHERE project = %s", (new_name, project_name))
            
            database.commit()
            
            # Renommer le dossier physique
            knowledge_base_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "knowledge_base")
            old_path = os.path.join(knowledge_base_path, project_name)
            new_path = os.path.join(knowledge_base_path, new_name)
            
            if os.path.exists(old_path):
                os.rename(old_path, new_path)
                print(f"✅ Dossier renommé: {old_path} -> {new_path}")
        
        # 5. Construire la réponse
        response = {
            "message": f"Projet '{project_name}' modifié avec succès",
            "updates": {}
        }
        
        if new_name:
            response["updates"]["name"] = f"'{project_name}' -> '{new_name}'"
        if new_description:
            response["updates"]["description"] = new_description
        if new_technologies is not None:
            response["updates"]["technologies"] = new_technologies
        
        return jsonify(response), 200
        
    except Exception as e:
        if 'database' in locals():
            database.rollback()
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    

@app.route("/chats", methods=["POST"])
def create_chat():
    data = request.json
    
    # Récupérer l'utilisateur depuis le token
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return jsonify({"error": "Non authentifié"}), 401
    
    token = auth_header.split(" ")[1] if " " in auth_header else auth_header
    
    cursor = database.cursor(dictionary=True)
    cursor.execute("SELECT id FROM users WHERE auth_token = %s", (token,))
    user = cursor.fetchone()
    
    if not user:
        return jsonify({"error": "Utilisateur non trouvé"}), 401
    
    user_id = user['id']
    project = data.get("project")
    title = data.get("title", "Nouvelle conversation")
    
    if not project:
        return jsonify({"error": "Project name is required"}), 400
    
    cursor.execute(
        "INSERT INTO chats (user_id, project, title) VALUES (%s, %s, %s)",
        (user_id, project, title)
    )
    database.commit()
    
    chat_id = cursor.lastrowid
    
    return jsonify({"id": chat_id, "title": title})


@app.route("/chats/<project>", methods=["GET"])
def get_chats(project):
    """Récupérer tous les chats d'un projet pour l'utilisateur connecté"""
    try:
        # Récupérer l'utilisateur depuis le token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify([]), 200
        
        token = auth_header.split(" ")[1] if " " in auth_header else auth_header
        
        cursor = database.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE auth_token = %s", (token,))
        user = cursor.fetchone()
        
        if not user:
            return jsonify([]), 200
        
        user_id = user['id']
        
        # Récupérer les chats de l'utilisateur pour ce projet
        cursor.execute(
            "SELECT * FROM chats WHERE project=%s AND user_id=%s ORDER BY created_at DESC", 
            (project, user_id)
        )
        chats = cursor.fetchall()
        
        # S'assurer que chats est une liste (même vide)
        if not chats:
            chats = []
        
        # Récupérer les messages pour chaque chat
        for chat in chats:
            cursor.execute(
                "SELECT * FROM messages WHERE chat_id=%s ORDER BY created_at ASC", 
                (chat["id"],)
            )
            chat["messages"] = cursor.fetchall() or []
        
        return jsonify(chats), 200
        
    except Exception as e:
        print(f"Error in get_chats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify([]), 200
    
    
@app.route("/messages", methods=["POST"])
def add_message():
    data = request.json

    cursor.execute(
        "INSERT INTO messages (chat_id, role, content) VALUES (%s, %s, %s)",
        (data["chat_id"], data["role"], data["content"])
    )
    database.commit()

    return jsonify({"status": "ok"})


@app.route("/chats/<int:id>", methods=["PUT"])
def update_chat(id):
    data = request.json

    cursor.execute(
        "UPDATE chats SET title=%s, pinned=%s WHERE id=%s",
        (data["title"], data["pinned"], id)
    )
    database.commit()

    return jsonify({"status": "updated"})

@app.route("/chats/<int:id>", methods=["DELETE"])
def delete_chat(id):
    cursor.execute("DELETE FROM chats WHERE id=%s", (id,))
    database.commit()

    return jsonify({"status": "deleted"})

@app.route("/registerOLD", methods=["POST"])
def registerOLD():
    data = request.json

    hashed_password = generate_password_hash(data["password"])

    try:
        cursor.execute(
            "INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
            (data["name"], data["email"], hashed_password)
        )
        database.commit()

        return jsonify({"message": "User created"})
    
    except:
        return jsonify({"error": "Email already exists"}), 400
    

@app.route("/loginOLD", methods=["POST"])
def loginOLD():
    data = request.json

    cursor.execute("SELECT * FROM users WHERE email=%s", (data["email"],))
    user = cursor.fetchone()

    if user and check_password_hash(user["password"], data["password"]):
        return jsonify({
            "user_id": user["id"],
            "name": user["name"]
        })

    return jsonify({"error": "Invalid credentials"}), 401


import json
import hashlib
from flask import request, jsonify
from datetime import datetime

# ============================================================
# API 1 : Générer un plan d'apprentissage personnalisé
# ============================================================
# Réponse : Le plan d'apprentissage (nouveau ou existant) + progression
# ============================================================
@app.route("/generate-path", methods=["POST"])
def generate_path():
    try:
        # Étape 1 : Récupération des données envoyées par le client
        data = request.json
        if not data:
            return jsonify({"error": "Aucune données fournies"}), 400
        
        user_id = data.get("user_id")
        project = data.get("project")
        tech_levels = data.get("technologies")
        
        if not user_id or not project or not tech_levels:
            return jsonify({"error": "user_id, project et technologies sont requis"}), 400

        cursor = database.cursor(dictionary=True)

        # Étape 2 : Normalisation des technologies pour créer un hash unique
        tech_levels_sorted = dict(sorted(tech_levels.items()))
        tech_json = json.dumps(tech_levels_sorted, separators=(',', ':'), sort_keys=True)
        tech_hash = hashlib.sha256(tech_json.encode()).hexdigest()

        # Étape 3 : Vérifier si l'utilisateur a déjà ce plan exact
        cursor.execute("""
            SELECT id, content, status, completed_steps, last_accessed 
            FROM learning_paths 
            WHERE user_id = %s AND project = %s AND tech_hash = %s
        """, (user_id, project, tech_hash))

        existing_user = cursor.fetchone()

        # Cas 1 : Plan trouvé pour cet utilisateur
        if existing_user:
            try:
                content = json.loads(existing_user["content"]) if isinstance(existing_user["content"], str) else existing_user["content"]
            except:
                content = existing_user["content"]
                
            return jsonify({
                "learning_path": content,
                "source": "user_database",
                "path_id": existing_user["id"],
                "status": existing_user["status"],
                "completed_steps": json.loads(existing_user["completed_steps"]) if existing_user["completed_steps"] else []
            })

        # Étape 4 : Vérifier si un AUTRE utilisateur a déjà généré ce plan
        cursor.execute("""
            SELECT content FROM learning_paths
            WHERE project = %s AND tech_hash = %s
            LIMIT 1
        """, (project, tech_hash))

        existing_global = cursor.fetchone()

        # Cas 2 : Plan trouvé chez un autre utilisateur
        if existing_global:
            path_content = existing_global["content"]
            
            try:
                existing_plan = json.loads(path_content) if isinstance(path_content, str) else path_content
                learning_plan = {
                    "title": existing_plan.get("title", f"Plan d'apprentissage - {project}"),
                    "description": existing_plan.get("description", f"Plan personnalisé pour maîtriser {project}"),
                    "total_estimated_hours": existing_plan.get("total_estimated_hours", "Non défini"),
                    "difficulty_level": existing_plan.get("difficulty_level", "Personnalisé"),
                    "modules": existing_plan.get("modules", []),
                    "final_project": existing_plan.get("final_project", None)
                }
            except:
                learning_plan = {
                    "title": f"Plan d'apprentissage - {project}",
                    "description": f"Plan personnalisé pour maîtriser {project}",
                    "modules": path_content.get("modules", []) if isinstance(path_content, dict) else []
                }
            
            content_json = json.dumps(learning_plan, ensure_ascii=False)
            
            cursor.execute("""
                INSERT INTO learning_paths (user_id, project, content, technologies, tech_hash, status, completed_steps, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (user_id, project, content_json, tech_json, tech_hash, "not_started", json.dumps([]), datetime.now()))
            
            database.commit()
            path_id = cursor.lastrowid

            return jsonify({
                "learning_path": learning_plan,
                "source": "copied_from_other_user",
                "path_id": path_id,
                "status": "not_started",
                "completed_steps": []
            })

        # Étape 5 : Cas 3 - Génération d'un nouveau plan
        # Analyse du profil utilisateur
        weak, medium, strong = analyze_profile(tech_levels)
        
        # Déterminer le niveau global
        if len(weak) > len(strong):
            global_level = "débutant"
            level_emoji = "🌱"
        elif len(medium) > len(weak) and len(medium) > len(strong):
            global_level = "intermédiaire"
            level_emoji = "📈"
        else:
            global_level = "avancé"
            level_emoji = "🚀"

        # Construction du prompt
        prompt = f"""
Tu es un expert en pédagogie technique. Génère un plan d'apprentissage STRUCTURÉ et TRÈS CONCRET en JSON pour un développeur sur le projet : "{project}".

## NIVEAUX DE L'UTILISATEUR : 
- Compétences Faibles : {weak if weak else "Aucune"}
- Compétences Moyennes : {medium if medium else "Aucune"}
- Compétences Fortes : {strong if strong else "Aucune"}
- Niveau global : {global_level} {level_emoji}

## FORMAT JSON ATTENDU :
{{
    "title": "Plan d'apprentissage - {project}",
    "description": "Description motivante",
    "total_estimated_hours": "X heures",
    "difficulty_level": "{global_level}",
    "modules": [
        {{
            "id": "module_1",
            "title": "Titre du module",
            "description": "Objectif pédagogique",
            "estimated_time": "2-3 heures",
            "steps": [
                {{
                    "id": "step_1_1",
                    "title": "Titre de l'étape",
                    "description": "Description détaillée",
                    "resources": [
                        {{"type": "Documentation", "title": "Titre", "url": "https://lien.reel.com"}}
                    ],
                    "exercises": [
                        {{
                            "title": "Exercice",
                            "instructions": "Instructions",
                            "expected_output": "Résultat attendu"
                        }}
                    ]
                }}
            ]
        }}
    ]
}}

Retourne UNIQUEMENT le JSON, sans texte avant ou après. Minimum 2 modules, maximum 4 modules.
"""

        # Appel au LLM
        result = ask_question(prompt, "fr", project, None, database)
        
        if not result or not result.get("answer"):
            return jsonify({"error": "Le LLM n'a pas retourné de réponse"}), 500
        
        # Extraction du JSON
        import re
        json_match = re.search(r'\{[\s\S]*\}', result["answer"], re.DOTALL)
        if json_match:
            learning_plan = json.loads(json_match.group())
        else:
            learning_plan = json.loads(result["answer"])

        # Validation
        if not learning_plan.get("modules") or len(learning_plan["modules"]) == 0:
            return jsonify({"error": "Le plan généré ne contient pas de modules valides"}), 500

        # Sauvegarde
        content_json = json.dumps(learning_plan, ensure_ascii=False)
        
        cursor.execute("""
            INSERT INTO learning_paths (
                user_id, project, content, technologies, tech_hash, 
                status, completed_steps, created_at, last_accessed
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (user_id, project, content_json, tech_json, tech_hash, 
              "not_started", json.dumps([]), datetime.now(), datetime.now()))

        database.commit()
        path_id = cursor.lastrowid

        return jsonify({
            "learning_path": learning_plan,
            "source": "generated",
            "path_id": path_id,
            "status": "not_started",
            "completed_steps": []
        })
        
    except KeyError as e:
        return jsonify({"error": f"Donnée manquante: {str(e)}"}), 400
    except json.JSONDecodeError as e:
        return jsonify({"error": f"Erreur de parsing JSON: {str(e)}"}), 500
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Erreur interne: {str(e)}"}), 500
    

# ============================================================
# API 2 : Sauvegarder la progression de l'utilisateur
# ============================================================
# Réponse : Message de confirmation + pourcentage de progression
# ============================================================
@app.route("/save-learning-progress", methods=["POST"])
def save_learning_progress():
    data = request.json
    
    user_id = data.get("user_id")
    project = data.get("project")
    completed_steps = data.get("completed_steps", [])
    status = data.get("status", "in_progress")
    
    cursor = database.cursor()
    
    # Récupère le plan pour calculer le nombre total d'étapes
    cursor.execute("""
        SELECT content FROM learning_paths 
        WHERE user_id = %s AND project = %s
        ORDER BY id DESC LIMIT 1
    """, (user_id, project))
    
    result = cursor.fetchone()
    
    total_steps = 0
    if result:
        try:
            content = json.loads(result["content"]) if isinstance(result["content"], str) else result["content"]
            for module in content.get("modules", []):
                total_steps += len(module.get("steps", []))
        except:
            pass
    
    # Calcule le pourcentage de progression
    progress_percentage = (len(completed_steps) / total_steps * 100) if total_steps > 0 else 0
    
    # Si toutes les étapes sont complétées, le statut passe automatiquement à "completed"
    if progress_percentage == 100:
        status = "completed"
    
    # Met à jour la progression en base
    cursor.execute("""
        UPDATE learning_paths 
        SET completed_steps = %s, 
            status = %s,
            progress_percentage = %s,
            last_accessed = %s
        WHERE user_id = %s AND project = %s
    """, (json.dumps(completed_steps), status, progress_percentage, datetime.now(), user_id, project))
    
    database.commit()
    
    return jsonify({
        "message": "Progress saved",
        "progress_percentage": progress_percentage,
        "status": status
    })

# ============================================================
# API 3 : Récupérer la progression sauvegardée d'un utilisateur
# ============================================================
# Réponse : Plan + progression (ou exists: false si rien trouvé)
# ============================================================
@app.route("/get-learning-progress/<int:user_id>/<project>", methods=["GET"])
def get_learning_progress(user_id, project):
    cursor = database.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT id, content, status, completed_steps, progress_percentage, last_accessed
        FROM learning_paths 
        WHERE user_id = %s AND project = %s
        ORDER BY id DESC LIMIT 1
    """, (user_id, project))
    
    result = cursor.fetchone()
    
    if result:
        try:
            content = json.loads(result["content"]) if isinstance(result["content"], str) else result["content"]
            completed_steps = json.loads(result["completed_steps"]) if result["completed_steps"] else []
            
            return jsonify({
                "exists": True,
                "learning_path": content,
                "path_id": result["id"],
                "status": result["status"],
                "completed_steps": completed_steps,
                "progress_percentage": result["progress_percentage"] or 0,
                "last_accessed": result["last_accessed"].isoformat() if result["last_accessed"] else None
            })
        except:
            pass
    
    return jsonify({"exists": False})


@app.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.json
    email = data["email"]

    cursor.execute(
        "SELECT * FROM users WHERE email=%s",
        (email,)
    )

    user = cursor.fetchone()

    if not user:
        return jsonify({
            "message": "Aucun compte trouvé"
        }), 404

    token = serializer.dumps(email, salt="reset")

    link = f"http://localhost:3000/reset-password/{token}"

    msg = Message(
        "Réinitialisation mot de passe",
        sender=os.getenv("MAIL_USERNAME"),
        recipients=[email]
    )

    msg.body = f"""
Bonjour,

Clique sur ce lien :

{link}

Lien valide 30 minutes.
"""

    mail.send(msg)

    return jsonify({
        "message": "Email envoyé"
    })




@app.route("/reset-password/<token>", methods=["POST"])
def reset_password(token):
    try:
        email = serializer.loads(
            token,
            salt="reset",
            max_age=1800
        )
    except:
        return jsonify({
            "message": "Lien expiré"
        }), 400

    data = request.json
    password = generate_password_hash(data["password"])

    cursor.execute(
        "UPDATE users SET password=%s WHERE email=%s",
        (password, email)
    )

    database.commit()

    return jsonify({
        "message": "Mot de passe changé"
    })

import os
import shutil
import subprocess
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

KNOWLEDGE_BASE = os.path.join(PROJECT_ROOT, "knowledge_base")
LOAD_SCRIPT = os.path.join(PROJECT_ROOT, "scripts", "load_data.py")


@app.route("/add-project", methods=["POST"])
def add_project():
    name = request.form.get("name")
    description = request.form.get("description")
    
    # Vérification si le nom est vide
    if not name:
        return jsonify({"error": "Le nom du projet est requis"}), 400
    
    # Vérifier dans ChromaDB si le projet existe déjà
    docs = db.get()
    existing_projects = set()
    for meta in docs["metadatas"]:
        project_name = meta.get("project")
        if project_name:
            existing_projects.add(project_name.lower())
    
    if name.lower() in existing_projects:
        return jsonify({
            "error": f"Un projet nommé '{name}' existe déjà. Veuillez choisir un autre nom."
        }), 400
    
    technologies = request.form.get("technologies")
    try:
        technologies = json.loads(technologies)
    except:
        technologies = []
    
    file = request.files.get("file")
    
    if not file:
        return jsonify({"error": "No file provided"}), 400
    
    # créer dossier projet
    project_path = os.path.join(KNOWLEDGE_BASE, name)
    
    # === LIGNE AJOUTÉE ===
    # Vérifier si le dossier existe déjà
    if os.path.exists(project_path):
        return jsonify({
            "error": f"Un dossier pour le projet '{name}' existe déjà."
        }), 400
    # === FIN LIGNE AJOUTÉE ===
    
    os.makedirs(project_path, exist_ok=True)
    
    # sauvegarder zip
    zip_filename = secure_filename(file.filename)
    zip_path = os.path.join(project_path, zip_filename)
    file.save(zip_path)
    
    # extraction
    try:
        import zipfile
        
        # First, verify it's a valid ZIP file
        if not zipfile.is_zipfile(zip_path):
            os.remove(zip_path)
            return jsonify({"error": "Invalid ZIP file"}), 400
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Extract all files, skipping problematic ones
            for member in zip_ref.namelist():
                # Skip node_modules and other junk directories
                if any(skip in member for skip in ['node_modules/', '.git/', '__pycache__/', 'venv/', 'dist/', 'build/']):
                    continue
                
                try:
                    zip_ref.extract(member, project_path)
                except Exception as e:
                    print(f"Warning: Could not extract {member}: {e}")
                    continue
        
        # Close the ZIP file explicitly
        zip_ref.close()
        
        # Wait a moment before deleting
        import time
        time.sleep(0.5)
        
        # Try to delete the zip file with retry
        for attempt in range(3):
            try:
                os.remove(zip_path)
                break
            except PermissionError:
                if attempt < 2:
                    time.sleep(0.5)
                else:
                    print(f"Warning: Could not delete {zip_path}")
        
    except zipfile.BadZipFile as e:
        return jsonify({"error": f"Bad ZIP file: {str(e)}"}), 400
    except Exception as e:
        return jsonify({"error": f"Extraction error: {str(e)}"}), 500
    
    # Ingestion with error handling
    try:
        from scripts.load_data import ingest_single_project
        
        # Call the function
        result = ingest_single_project(name, description, technologies)
        
        return jsonify({
            "message": "Projet ajouté avec succès",
            "ingestion_result": result
        })
        
    except ImportError as e:
        print(f"Import error: {e}")
        return jsonify({"error": f"Could not import ingest_single_project: {str(e)}"}), 500
        
    except Exception as e:
        print(f"Ingestion error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Ingestion failed: {str(e)}"}), 500

# ============================================
# ADMIN ROLE 
# ============================================

# ============================================
# IMPORTS SUPPLEMENTAIRES (à ajouter en haut)
# ============================================
import secrets
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import re

# ============================================
# ADMIN DECORATOR (CORRIGÉ)
# ============================================

def admin_required(f):
    """Decorator pour les routes admin uniquement - avec nouvelle connexion"""
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Token manquant"}), 401
        
        token = auth_header.split(" ")[1] if " " in auth_header else auth_header
        
        # Créer une nouvelle connexion pour la vérification admin
        conn = get_db_connection()
        cursor_admin = conn.cursor(dictionary=True)
        
        try:
            cursor_admin.execute("""
                SELECT u.*, r.name as role_name 
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.auth_token = %s AND u.is_active = 1
            """, (token,))
            user = cursor_admin.fetchone()
            
            if not user or user['role_name'] != 'admin':
                return jsonify({"error": "Accès non autorisé - Admin requis"}), 403
            
            request.admin_user = user
            return f(*args, **kwargs)
        finally:
            cursor_admin.close()
            conn.close()
    
    decorated_function.__name__ = f.__name__
    return decorated_function

# ============================================
# FONCTION D'ENVOI D'EMAIL
# ============================================

def send_invitation_email(to_email, register_link, admin_name):
    """Envoie l'email d'invitation"""
    msg = MIMEMultipart()
    msg['From'] = app.config["MAIL_USERNAME"]
    msg['To'] = to_email
    msg['Subject'] = "Invitation à rejoindre AI-Onboarding"
    
    html_content = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #6366f1, #3b82f6); padding: 20px; text-align: center; color: white; border-radius: 10px 10px 0 0; }}
            .content {{ padding: 20px; background: #f8fafc; }}
            .button {{ background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }}
            .footer {{ text-align: center; padding: 15px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>AI-Onboarding</h2>
            </div>
            <div class="content">
                <p>Bonjour,</p>
                <p><strong>{admin_name}</strong> vous a invité à rejoindre la plateforme AI-Onboarding.</p>
                <p>Cliquez sur le lien ci-dessous pour créer votre compte :</p>
                <p style="margin: 25px 0;">
                    <a href="{register_link}" class="button">Créer mon compte</a>
                </p>
                <p>Ce lien expire dans 7 jours.</p>
                <hr>
                <p style="font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
            </div>
            <div class="footer">
                &copy; 2024 AI-Onboarding - Plateforme d'onboarding intelligent
            </div>
        </div>
    </body>
    </html>
    """
    
    msg.attach(MIMEText(html_content, 'html'))
    
    try:
        with smtplib.SMTP(app.config["MAIL_SERVER"], app.config["MAIL_PORT"]) as server:
            server.starttls()
            server.login(app.config["MAIL_USERNAME"], app.config["MAIL_PASSWORD"])
            server.send_message(msg)
        print(f"✅ Email envoyé à {to_email}")
    except Exception as e:
        print(f"❌ Erreur envoi email: {e}")

# ============================================
# LOGIN MODIFIÉ
# ============================================

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    
    cursor = database.cursor(dictionary=True)
    cursor.execute("""
        SELECT u.*, r.name as role_name 
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.email = %s AND u.is_active = 1
    """, (data['email'],))
    
    user = cursor.fetchone()
    
    if not user or not check_password_hash(user['password'], data['password']):
        return jsonify({"error": "Email ou mot de passe incorrect"}), 401
    
    # Générer token de session
    auth_token = secrets.token_urlsafe(32)
    cursor.execute("UPDATE users SET auth_token = %s WHERE id = %s", (auth_token, user['id']))
    database.commit()
    
    return jsonify({
        "user": {
            "id": user['id'],
            "name": user['name'],
            "email": user['email'],
            "role": user['role_name']
        },
        "token": auth_token,
        "role": user['role_name']
    })

# ============================================
# REGISTER AVEC TOKEN INVITATION
# ============================================

@app.route("/register", methods=["POST"])
def register():
    """Inscription UNIQUEMENT par invitation (avec token)"""
    data = request.json
    
    print("📝 Données reçues:", data)
    
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    token = data.get("token")
    
    # Validation des champs obligatoires
    if not name or not email or not password or not token:
        return jsonify({"error": "Tous les champs sont requis"}), 400
    
    cursor = database.cursor(dictionary=True)
    
    # Vérifier le token d'invitation
    cursor.execute("""
        SELECT * FROM users 
        WHERE invitation_token = %s 
        AND is_active = 0 
        AND invitation_expires > NOW()
    """, (token,))
    
    invited_user = cursor.fetchone()
    if not invited_user:
        return jsonify({"error": "Lien d'invitation invalide ou expiré"}), 400
    
    # Vérifier que l'email correspond à l'invitation
    if invited_user['email'] != email:
        return jsonify({"error": "L'email ne correspond pas à l'invitation"}), 400
    
    # Mettre à jour l'utilisateur invité avec son nom et mot de passe
    hashed_password = generate_password_hash(password)
    cursor.execute("""
        UPDATE users 
        SET name = %s, 
            password = %s, 
            is_active = 1,
            invitation_token = NULL,
            invitation_expires = NULL
        WHERE id = %s
    """, (name, hashed_password, invited_user['id']))
    
    database.commit()
    
    return jsonify({
        "message": "Compte activé avec succès",
        "user": {
            "id": invited_user['id'],
            "name": name,
            "email": email,
            "role": "developer"
        }
    }), 201

# ============================================
# ADMIN - INVITER UN EMPLOYÉ (CORRIGÉ)
# ============================================

@app.route("/admin/invite", methods=["POST"])
@admin_required
def invite_employee():
    """Invite un employé par email - seulement l'email, pas de name/password"""
    data = request.json
    email = data.get("email")
    
    if not email:
        return jsonify({"error": "Email requis"}), 400
    
    # Créer une nouvelle connexion pour cette requête
    conn = get_db_connection()
    cursor_invite = conn.cursor(dictionary=True)
    
    try:
        # Vérifier si l'email existe déjà
        cursor_invite.execute("SELECT id, is_active FROM users WHERE email = %s", (email,))
        existing = cursor_invite.fetchone()
        
        if existing:
            if existing['is_active']:
                return jsonify({"error": "Cet email est déjà utilisé par un compte actif"}), 400
            else:
                return jsonify({"error": "Une invitation est déjà en attente pour cet email"}), 400
        
        # Générer un token unique
        invitation_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(days=7)
        
        # Créer un utilisateur INACTIF
        cursor_invite.execute("""
            INSERT INTO users (email, role_id, is_active, invited_by, invitation_token, invitation_expires)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (email, 2, 0, request.admin_user['id'], invitation_token, expires_at))
        
        conn.commit()
        
        # Envoyer l'email d'invitation
        register_link = f"http://localhost:3000/register?token={invitation_token}"
        
        try:
            send_invitation_email(email, register_link, request.admin_user['name'])
        except Exception as e:
            print(f"Erreur envoi email: {e}")
        
        return jsonify({
            "message": f"Invitation envoyée à {email}",
            "expires_at": expires_at.isoformat()
        })
    finally:
        cursor_invite.close()
        conn.close()

# ============================================
# ADMIN - LISTE DES EMPLOYÉS (CORRIGÉ)
# ============================================

@app.route("/admin/employees", methods=["GET"])
@admin_required
def get_employees():
    """Récupère la liste de tous les employés"""
    conn = get_db_connection()
    cursor_emp = conn.cursor(dictionary=True)
    
    try:
        cursor_emp.execute("""
            SELECT u.id, u.name, u.email, u.is_active, u.created_at,
                   r.name as role, inv.name as invited_by_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN users inv ON u.invited_by = inv.id
            WHERE r.name = 'developer'
            ORDER BY u.created_at DESC
        """)
        
        employees = cursor_emp.fetchall()
        
        # Formater les dates
        for emp in employees:
            if emp['created_at']:
                emp['created_at'] = emp['created_at'].isoformat()
        
        return jsonify(employees)
    finally:
        cursor_emp.close()
        conn.close()

# ============================================
# ADMIN - STATISTIQUES (CORRIGÉ)
# ============================================

@app.route("/admin/stats", methods=["GET"])
@admin_required
def get_admin_stats():
    """Statistiques pour l'admin"""
    conn = get_db_connection()
    cursor_stats = conn.cursor(dictionary=True)
    
    try:
        # Nombre d'employés actifs
        cursor_stats.execute("""
            SELECT COUNT(*) as count FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.name = 'developer' AND u.is_active = 1
        """)
        active_employees = cursor_stats.fetchone()['count'] or 0
        
        # Nombre d'invitations en attente
        cursor_stats.execute("""
            SELECT COUNT(*) as count FROM users 
            WHERE is_active = 0 AND invitation_token IS NOT NULL AND invitation_expires > NOW()
        """)
        pending_invitations = cursor_stats.fetchone()['count'] or 0
        
        # Nombre de projets
        cursor_stats.execute("SELECT COUNT(*) as count FROM projects")
        projects_count = cursor_stats.fetchone()['count'] or 0
        
        # Nombre de chats
        cursor_stats.execute("SELECT COUNT(*) as count FROM chats")
        chats_count = cursor_stats.fetchone()['count'] or 0
        
        # Nombre total d'utilisateurs
        cursor_stats.execute("SELECT COUNT(*) as count FROM users")
        total_users = cursor_stats.fetchone()['count'] or 0
        
        return jsonify({
            "active_employees": active_employees,
            "pending_invitations": pending_invitations,
            "projects_count": projects_count,
            "chats_count": chats_count,
            "total_users": total_users
        })
    finally:
        cursor_stats.close()
        conn.close()

# ============================================
# ADMIN - LISTE DES INVITATIONS EN ATTENTE (CORRIGÉ)
# ============================================

@app.route("/admin/pending-invitations", methods=["GET"])
@admin_required
def get_pending_invitations():
    """Récupère les invitations en attente"""
    conn = get_db_connection()
    cursor_pending = conn.cursor(dictionary=True)
    
    try:
        cursor_pending.execute("""
            SELECT u.id, u.email, u.invitation_token, u.invitation_expires, 
                   u.created_at, inv.name as invited_by_name
            FROM users u
            LEFT JOIN users inv ON u.invited_by = inv.id
            WHERE u.is_active = 0 AND u.invitation_token IS NOT NULL AND u.invitation_expires > NOW()
            ORDER BY u.created_at DESC
        """)
        
        invitations = cursor_pending.fetchall()
        
        for inv in invitations:
            inv['created_at'] = inv['created_at'].isoformat() if inv['created_at'] else None
            inv['invitation_expires'] = inv['invitation_expires'].isoformat() if inv['invitation_expires'] else None
        
        return jsonify(invitations)
    finally:
        cursor_pending.close()
        conn.close()

# ============================================
# ADMIN - MODIFIER UN EMPLOYÉ
# ============================================

@app.route("/admin/employees/<int:employee_id>", methods=["PUT"])
@admin_required
def update_employee(employee_id):
    """Modifie les informations d'un employé"""
    data = request.json
    
    cursor = database.cursor(dictionary=True)
    
    # Vérifier que l'utilisateur est un employé
    cursor.execute("""
        SELECT u.*, r.name as role_name 
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = %s AND r.name = 'developer'
    """, (employee_id,))
    
    employee = cursor.fetchone()
    if not employee:
        return jsonify({"error": "Employé non trouvé"}), 404
    
    updates = []
    values = []
    
    if 'name' in data:
        updates.append("name = %s")
        values.append(data['name'])
    
    if 'email' in data:
        # Vérifier si l'email n'est pas déjà utilisé
        cursor.execute("SELECT id FROM users WHERE email = %s AND id != %s", (data['email'], employee_id))
        if cursor.fetchone():
            return jsonify({"error": "Cet email est déjà utilisé"}), 400
        updates.append("email = %s")
        values.append(data['email'])
    
    if updates:
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
        values.append(employee_id)
        cursor.execute(query, values)
        database.commit()
    
    return jsonify({"message": "Employé mis à jour avec succès"})

# ============================================
# ADMIN - ACTIVER/DÉSACTIVER EMPLOYÉ
# ============================================

@app.route("/admin/employees/<int:employee_id>/toggle", methods=["POST"])
@admin_required
def toggle_employee_status(employee_id):
    """Active/Désactive un employé"""
    cursor = database.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT u.*, r.name as role_name 
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = %s AND r.name = 'developer'
    """, (employee_id,))
    
    employee = cursor.fetchone()
    if not employee:
        return jsonify({"error": "Employé non trouvé"}), 404
    
    new_status = not employee['is_active']
    cursor.execute("UPDATE users SET is_active = %s WHERE id = %s", (new_status, employee_id))
    database.commit()
    
    status_text = "désactivé" if not new_status else "réactivé"
    return jsonify({
        "message": f"Employé {status_text}",
        "is_active": new_status
    })

# ============================================
# ADMIN - SUPPRIMER EMPLOYÉ
# ============================================

@app.route("/admin/employees/<int:employee_id>", methods=["DELETE"])
@admin_required
def delete_employee(employee_id):
    """Supprime définitivement un employé"""
    cursor = database.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT u.*, r.name as role_name 
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = %s AND r.name = 'developer'
    """, (employee_id,))
    
    employee = cursor.fetchone()
    if not employee:
        return jsonify({"error": "Employé non trouvé"}), 404
    
    cursor.execute("DELETE FROM users WHERE id = %s", (employee_id,))
    database.commit()
    
    return jsonify({"message": "Employé supprimé définitivement"})

# ============================================
# ADMIN - ANNULER UNE INVITATION
# ============================================

@app.route("/admin/cancel-invitation/<int:user_id>", methods=["DELETE"])
@admin_required
def cancel_invitation(user_id):
    """Annule une invitation en attente"""
    cursor = database.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT * FROM users 
        WHERE id = %s AND is_active = 0 AND invitation_token IS NOT NULL
    """, (user_id,))
    
    invitation = cursor.fetchone()
    if not invitation:
        return jsonify({"error": "Invitation non trouvée"}), 404
    
    cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
    database.commit()
    
    return jsonify({"message": "Invitation annulée"})


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)