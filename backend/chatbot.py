from langchain_chroma import Chroma
from langchain_ollama import OllamaLLM
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_core.messages import HumanMessage, AIMessage

from langchain_huggingface import HuggingFaceEmbeddings


embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

#  Charger la base vectorielle deja créée
db = Chroma(
    persist_directory="../db",
    embedding_function=embeddings,
    collection_name="projects_kb"
)

# Charger le modèle de langage Ollama pour générer les réponses à partir des documents récupérés
llm = OllamaLLM(model="llama3")


#Construction du Prompt
def build_prompt(lang):
    template = f"""
Tu es un assistant IA expert pour aider les développeurs.

IMPORTANT :
-Utilise l'historique pour comprendre le contexte
- Réponds STRICTEMENT en {lang}
- Ne change jamais de langue
- Ne jamais inventer d'informations
- Si la réponse n'est pas dans le contexte :
  dis "Je n'ai pas assez d'informations dans le contexte"

---

RÈGLES STRICTES DE FORMAT (OBLIGATOIRE) :
- Réponds uniquement en Markdown
- Utilise des titres (##)
- Fais des paragraphes courts (max 3 lignes)
- Ne jamais écrire un seul bloc de texte long
- Sépare toujours les sections avec des espaces

CODE :
- Tout code DOIT être dans des blocs ```langage
- Ne jamais mettre de code inline
- Toujours expliquer avant le code

STYLE :
- Réponse claire et directe
- Évite les phrases comme "dans votre projet..."
- Va à l’essentiel
- Donne des exemples concrets

---

Historique de conversation:
{{chat_history}}

Contexte:
{{context}}

Question:
{{question}}

Réponse structurée :
"""
    return PromptTemplate(
        template=template,
        input_variables=["context", "question", "chat_history"]
    )



#fonction pour récupérer l’historique depuis MySQL
def load_history_from_db(chat_id, database):
    if not chat_id:
        return []

    cursor = database.cursor(dictionary=True)
    cursor.execute(
        "SELECT role, content FROM messages WHERE chat_id=%s ORDER BY id ASC",
        (chat_id,)
    )
    messages = cursor.fetchall()

    history = []
    for msg in messages:
        if msg["role"] == "user":
            history.append(HumanMessage(content=msg["content"]))
        else:
            history.append(AIMessage(content=msg["content"]))

    return history


def format_history(messages):
    lines = []
    for msg in messages:
        if isinstance(msg, HumanMessage):
            lines.append(f"User: {msg.content}")
        else:
            lines.append(f"Assistant: {msg.content}")
    return "\n".join(lines)


def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)


def ask_question(query, lang, project, chat_id, database):
    # Load history
    history = load_history_from_db(chat_id, database)
    chat_history_str = format_history(history)

    # Retriever filtered by project
    retriever = db.as_retriever(
        search_type="mmr",
        search_kwargs={
            "lambda_mult": 0.7,  # 70% pertinence, 30% diversité ,
            # Pertinence = Les résultats doivent répondre DIRECTEMENT à la question
            # Diversité = Les résultats doivent apporter des informations DIFFÉRENTES
            "k": 5,  # Cherche dans TOUS les chunks, mais ne retourne que les 5 PLUS PERTINENTS
            "filter": {"project": project}  # Ne cherche que dans ce projet
        }
    )

    # Retrieve relevant docs
    docs = retriever.invoke(query)
    context = format_docs(docs)

    # Build prompt and call LLM
    prompt = build_prompt(lang)
    chain = prompt | llm | StrOutputParser()

    answer = chain.invoke({
        "question": query,
        "context": context,
        "chat_history": chat_history_str
    })

    # Format sources
    formatted_sources = []
    for doc in docs:
        source = doc.metadata.get("source", "Unknown")
        proj = doc.metadata.get("project", "Unknown")
        formatted_sources.append(f"[{proj}] {source}")

    return {
        "answer": answer,
        "sources": formatted_sources
    }


