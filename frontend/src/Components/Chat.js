import { useState, useRef, useEffect } from "react";
import "./Chat.css";
import Sidebar from "./Sidebar";
import ReactMarkdown from "react-markdown";

function Chat({
  project,
  setProject,
  conversations,
  setConversations,
  currentChatId,
  setCurrentChatId,
  handleNewChat,
  addMessage,
}) {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const currentChat = conversations.find((chat) => chat.id === currentChatId);
  const messages = currentChat ? currentChat.messages : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleAsk = async () => {
    if (!question.trim() || isLoading) return;

    let chatId = currentChatId;

    if (!chatId) {
      const title = question.length > 30 ? question.slice(0, 30) + "..." : question;

      const res = await fetch("http://127.0.0.1:5000/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, title }),
      });

      const data = await res.json();
      chatId = data.id;

      const newChat = { id: chatId, title, messages: [], pinned: false };
      setConversations((prev) => [...prev, newChat]);
      setCurrentChatId(chatId);
    }

    const userMsg = { role: "user", content: question };
    await addMessage(chatId, userMsg);
    setQuestion("");
    setIsLoading(true);

    // Ajouter un message assistant temporaire avec un indicateur de chargement
    setConversations((prev) =>
      prev.map((chat) =>
        chat.id !== chatId
          ? chat
          : { ...chat, messages: [...chat.messages, { role: "assistant", content: "", isLoading: true }] }
      )
    );

    try {
      const res = await fetch("http://127.0.0.1:5000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, project, chat_id: chatId }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let botText = "";

      // Remplacer le message temporaire par un vrai message assistant
      setConversations((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat;
          const updatedMessages = [...chat.messages];
          // Remplacer le dernier message (temporaire) par un vrai message assistant
          updatedMessages[updatedMessages.length - 1] = { role: "assistant", content: "", isLoading: true };
          return { ...chat, messages: updatedMessages };
        })
      );

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        botText += decoder.decode(value);

        setConversations((prev) =>
          prev.map((chat) => {
            if (chat.id !== chatId) return chat;
            const updatedMessages = [...chat.messages];
            if (updatedMessages[updatedMessages.length - 1]) {
              updatedMessages[updatedMessages.length - 1].content = botText;
              updatedMessages[updatedMessages.length - 1].isLoading = false;
            }
            return { ...chat, messages: updatedMessages };
          })
        );
      }

      await fetch("http://127.0.0.1:5000/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, role: "assistant", content: botText }),
      });
    } catch (error) {
      console.error("Error:", error);
      // En cas d'erreur, mettre à jour le message d'erreur
      setConversations((prev) =>
        prev.map((chat) => {
          if (chat.id !== chatId) return chat;
          const updatedMessages = [...chat.messages];
          if (updatedMessages[updatedMessages.length - 1]) {
            updatedMessages[updatedMessages.length - 1].content = "❌ Désolé, une erreur s'est produite. Veuillez réessayer.";
            updatedMessages[updatedMessages.length - 1].isLoading = false;
          }
          return { ...chat, messages: updatedMessages };
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        conversations={conversations}
        setCurrentChatId={setCurrentChatId}
        handleNewChat={handleNewChat}
        currentChatId={currentChatId}
        setConversations={setConversations}
      />

      <div className="chat-wrapper">
        {/* Header */}
        <div className="chat-header">
          <button className="back-btn" onClick={() => setProject("")}>
            ⬅ Retour
          </button>
          <h2>{project}</h2>
        </div>

        {/* Messages */}
        <div className="chat-content">
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✦</div>
              <h1>Quel est le programme aujourd'hui ?</h1>
              <p className="empty-subtitle">
                Pose une question sur le projet <span>{project}</span>
              </p>

              <div className="chat-input-box">
                <input
                  type="text"
                  placeholder="Pose ta question..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isLoading && handleAsk()}
                  disabled={isLoading}
                />
                <button onClick={handleAsk} disabled={isLoading}>
                  {isLoading ? (
                    <span className="spinner-small"></span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  {msg.role === "assistant" && (
                    <div className="assistant-label">✦ AI</div>
                  )}
                  {msg.isLoading && !msg.content ? (
                    <div className="loading-spinner-container">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input bar — only shown when there are messages */}
        {messages.length > 0 && (
          <div className="chat-input-bar">
            <div className="chat-input-box">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Pose ta question..."
                onKeyDown={(e) => e.key === "Enter" && !isLoading && handleAsk()}
                disabled={isLoading}
              />
              <button onClick={handleAsk} disabled={isLoading}>
                {isLoading ? (
                  <span className="spinner-small"></span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;