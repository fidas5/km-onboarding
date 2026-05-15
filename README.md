# Documentation Technique - AI Onboarding

## Vue d'ensemble

**AI Onboarding** est une plateforme d'assistance conversationnelle intelligente dédiée à l'intégration et à la formation des développeurs sur des projets techniques.  
L'application utilise un système **RAG (Retrieval-Augmented Generation)** afin de fournir des réponses précises basées sur le contenu réel des projets.

### Objectifs principaux

- Assister les développeurs dans la compréhension et la prise en main de projets
- Fournir des réponses contextuelles basées sur la documentation et le code source
- Générer des plans d'apprentissage personnalisés selon le niveau de chaque développeur
- Centraliser les connaissances techniques de l'entreprise

---

# Architecture technique

## Stack technologique

| Composant | Technologie | Rôle |
|---|---|---|
| Backend | Flask (Python) | API REST et logique métier |
| Base relationnelle | MySQL | Utilisateurs, chats, messages, plans d'apprentissage |
| Base vectorielle | Chroma DB | Stockage et recherche sémantique des documents |
| Embeddings | Hugging Face (`all-MiniLM-L6-v2`) | Conversion texte → vecteurs numériques |
| LLM | Ollama + Llama 3 | Génération des réponses IA |
| Orchestration | LangChain | Pipeline RAG et gestion des chaînes |
| Frontend | React.js | Interface utilisateur |

---

# Structure du projet

```text
km-onboarding/
├── backend/
│   ├── app.py                  # API Flask (routes principales)
│   ├── chatbot.py              # Logique RAG et appels LLM
│   ├── config.py               # Configuration base de données
│   ├── scripts/
│   │   └── load_data.py        # Ingestion des projets dans Chroma DB
│
├── frontend/
│   └── src/                    # Application React
│
├── knowledge_base/             # Dossiers des projets (fichiers sources)
├── db/                         # Persistance Chroma DB (vecteurs)
└── database.sql                # Schéma MySQL
```

---

# Base de données (MySQL)

## Schéma principal

```sql
-- Utilisateurs et rôles
users (
    id,
    name,
    email,
    password,
    role_id,
    is_active,
    auth_token
)

roles (
    id,
    name -- admin, developer
)

-- Gestion des conversations
chats (
    id,
    user_id,
    project,
    title,
    pinned,
    created_at
)

messages (
    id,
    chat_id,
    role,
    content,
    created_at
)

-- Plans d'apprentissage
learning_paths (
    id,
    user_id,
    project,
    content,
    technologies,
    status,
    completed_steps,
    progress_percentage
)
```

---

# Modules Backend

## 1. Authentification et gestion des utilisateurs

### Fonctionnalités

- Création et gestion des comptes utilisateurs
- Invitations administrateur par e-mail
- Connexion sécurisée
- Réinitialisation du mot de passe
- Gestion des rôles (`admin`, `developer`)

### Cycle de création de compte

```text
Admin → Création employé → Email d'invitation →
Employé définit son mot de passe →
Activation du compte → Connexion à la plateforme
```

### Endpoints d'authentification

| Endpoint | Méthode | Description |
|---|---|---|
| `/login` | POST | Connexion utilisateur |
| `/register` | POST | Inscription via invitation |
| `/forgot-password` | POST | Demande de réinitialisation |
| `/reset-password/<token>` | POST | Réinitialisation mot de passe |

### Administration des employés

| Endpoint | Description |
|---|---|
| `/admin/invite` | Envoi d'invitation par email |
| `/admin/employees` | Liste des employés |
| `/admin/employees/<id>/toggle` | Activation / désactivation |
| `/admin/stats` | Statistiques globales |

---

# 2. Gestion des projets

## Ingestion d'un projet (`/add-project`)

### Processus complet

```text
1. Réception du fichier ZIP
2. Extraction dans knowledge_base/{project_name}/
3. Parcours récursif des fichiers
4. Chargement avec TextLoader
5. Découpage en chunks
6. Génération des embeddings
7. Stockage dans Chroma DB
```

### Paramètres de découpage

| Paramètre | Valeur |
|---|---|
| Taille chunk | 500 caractères |
| Chevauchement | 50 caractères |
| Dimension embeddings | 384 |

### Formats supportés

```text
.py, .java, .js, .md, .txt,
.html, .css, .json, .csv,
.xml, .yml
```

### Routes projets

| Endpoint | Méthode | Description |
|---|---|---|
| `/projects` | GET | Liste des projets |
| `/add-project` | POST | Ajout d'un projet |
| `/projects/<name>` | PUT | Modification projet |
| `/delete_project` | DELETE | Suppression projet |

---

# 3. Assistant conversationnel (RAG)

## Architecture RAG

### Phase 1 : Recherche

```text
Question utilisateur
        ↓
Recherche vectorielle (Chroma DB - MMR)
        ↓
5 chunks les plus pertinents
+ filtrage par projet
```

### Phase 2 : Génération

```text
Contexte trouvé + Historique + Question
                    ↓
             PromptTemplate
                    ↓
       Llama 3 via Ollama
                    ↓
Réponse structurée + Sources citées
```

---

## Routes conversation

| Endpoint | Méthode | Description |
|---|---|---|
| `/ask` | POST | Question au chatbot (streaming) |
| `/chats` | POST | Créer une conversation |
| `/chats/<project>` | GET | Conversations d'un projet |
| `/messages` | POST | Ajouter un message |

---

## Paramètres de recherche (MMR)

```python
search_type = "mmr"

search_kwargs = {
    "lambda_mult": 0.7,
    "k": 5,
    "filter": {
        "project": project
    }
}
```

### Explication

| Paramètre | Description |
|---|---|
| `lambda_mult=0.7` | 70% pertinence / 30% diversité |
| `k=5` | Nombre maximal de résultats |
| `filter` | Filtrage par projet |

---

# 4. Plans d'apprentissage

## Génération automatique

Le système analyse le profil du développeur (niveau par technologie) puis génère automatiquement un plan structuré.

### Exemple de structure

```json
{
  "title": "Plan - Projet X",
  "modules": [
    {
      "title": "Module 1",
      "steps": [
        {
          "title": "Étape 1",
          "resources": [],
          "exercises": []
        }
      ]
    }
  ]
}
```

---

## Routes apprentissage

| Endpoint | Description |
|---|---|
| `/generate-path` | Génère un plan personnalisé |
| `/save-learning-progress` | Sauvegarde la progression |
| `/get-learning-progress/<user_id>/<project>` | Récupère la progression |

---

# Flux fonctionnels

## 1. Intégration d'un nouveau projet

```text
Admin → Upload ZIP → Extraction fichiers →
Ingestion Chroma DB → Projet disponible
```

## 2. Conversation avec l'assistant

```text
Développeur → Pose une question →
Recherche vectorielle →
Contexte →
LLM →
Réponse + Sources
```

## 3. Génération d'un plan d'apprentissage

```text
Développeur → Renseigne ses niveaux →
Analyse profil →
Génération plan →
Suivi progression
```

## 4. Cycle de vie employé

```text
Admin → Invitation email →
Employé crée son compte →
Connexion →
Formation assistée
```

---

# Configuration requise

## Backend

```bash
# Python 3.9+
pip install -r requirements.txt
```

### Variables d'environnement (`.env`)

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=...
DB_NAME=km_onboarding
DB_PORT=3306

MAIL_USERNAME=...
MAIL_PASSWORD=...
```

### Installation Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh

ollama pull llama3
```

---

## Frontend

```bash
# Node.js 18+
npm install
npm start
```

---

# Sécurité

| Élément | Implémentation |
|---|---|
| Mots de passe | Hashés avec Werkzeug |
| Authentification | Tokens Bearer (`secrets.token_urlsafe`) |
| Invitations | Tokens temporaires (7 jours) |
| CORS | Configuré pour le frontend |
| Routes admin | Décorateur `@admin_required` |

---

# Avantages du système RAG

- ✅ Réponses basées sur des documents réels
- ✅ Sources systématiquement citées
- ✅ Ajout de documents sans réentraînement
- ✅ Données locales et confidentielles (Ollama + Chroma DB)
- ✅ Recherche sémantique performante
- ✅ Assistance contextualisée par projet

---

# Technologies IA utilisées

## Embeddings

Le modèle :

```text
sentence-transformers/all-MiniLM-L6-v2
```

est utilisé pour transformer les documents en vecteurs numériques exploitables par Chroma DB.

## Modèle de langage

```text
Llama 3 via Ollama
```

permet la génération locale des réponses IA sans dépendance à des APIs externes.

---

# Conclusion

AI Onboarding permet de centraliser les connaissances techniques de l'entreprise et d'accompagner efficacement les développeurs dans leur montée en compétence grâce à :

- un assistant conversationnel intelligent,
- un moteur RAG contextualisé,
- des plans d'apprentissage personnalisés,
- et une architecture IA entièrement locale et sécurisée.