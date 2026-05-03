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


@app.route("/chats/<project>", methods=["GET"])
def get_chats(project):
    cursor.execute("SELECT * FROM chats WHERE project=%s", (project,))
    chats = cursor.fetchall()

    for chat in chats:
        cursor.execute("SELECT * FROM messages WHERE chat_id=%s", (chat["id"],))
        chat["messages"] = cursor.fetchall()

    return jsonify(chats)

@app.route("/chats", methods=["POST"])
def create_chat():
    data = request.json

    cursor.execute(
    "INSERT INTO chats (project, title) VALUES (%s, %s)",
    (data["project"], data["title"])
)
    database.commit()

    chat_id = cursor.lastrowid

    return jsonify({"id": chat_id})

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

@app.route("/register", methods=["POST"])
def register():
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
    

@app.route("/login", methods=["POST"])
def login():
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


        
if __name__ == "__main__":
    app.run(debug=True,use_reloader=False)
