import { useState, useEffect } from "react";
import "./Sidebar.css";
import renameIcon from "../assets/rename.png";
import pinIcon from "../assets/pin.png";
import deleteIcon from "../assets/delete.png";
import addIcon from "../assets/ajouter.png";

function Sidebar({
  conversations,
  setCurrentChatId,
  handleNewChat,
  currentChatId,
  setConversations
}) {
  const [hoveredChatId, setHoveredChatId] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // 🗑️ DELETE
  const handleDelete = async (id) => {
    await fetch(`http://127.0.0.1:5000/chats/${id}`, {
      method: "DELETE"
    });

    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (currentChatId === id) setCurrentChatId(null);
  };

  // ✏️ RENAME
  const handleRename = async (chat) => {
    const newTitle = prompt("Nouveau nom du chat:");
    if (!newTitle) return;

    await fetch(`http://127.0.0.1:5000/chats/${chat.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        pinned: chat.pinned
      })
    });

    setConversations((prev) =>
      prev.map((c) =>
        c.id === chat.id ? { ...c, title: newTitle } : c
      )
    );
  };

  // 📌 PIN
  const handlePin = async (chat) => {
    await fetch(`http://127.0.0.1:5000/chats/${chat.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: chat.title,
        pinned: !chat.pinned
      })
    });

    setConversations((prev) =>
      prev.map((c) =>
        c.id === chat.id ? { ...c, pinned: !c.pinned } : c
      )
    );
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>DevOnboard</h2>
      </div>

      <button className="new-chat" onClick={handleNewChat}>
        <img src={addIcon} alt="add" className="add-icon" />
        Nouveau Chat
      </button>

      <div className="history">
        <p>Historique</p>

        {conversations.map((chat) => (
          <div
            key={chat.id}
            className={`history-item ${
              currentChatId === chat.id ? "active" : ""
            }`}
            onMouseEnter={() => setHoveredChatId(chat.id)}
            onMouseLeave={() => setHoveredChatId(null)}
          >
            <span onClick={() => setCurrentChatId(chat.id)}>
              {chat.title}
              {chat.pinned && (
                <img src={pinIcon} alt="pinned" className="pin-icon" />
              )}
            </span>

            {hoveredChatId === chat.id && (
              <div
                className="menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                }}
              >
                ⋯
              </div>
            )}

            {openMenuId === chat.id && (
              <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                <div
                  className="dropdown-item"
                  onClick={() => handleRename(chat)}
                >
                  <img src={renameIcon} alt="rename" />
                  <span>Renommer</span>
                </div>

                <div
                  className="dropdown-item"
                  onClick={() => handlePin(chat)}
                >
                  <img src={pinIcon} alt="pin" />
                  <span>
                    {chat.pinned
                      ? "Désépingler"
                      : "Épingler"}
                  </span>
                </div>

                <div
                  className="dropdown-item danger"
                  onClick={() => handleDelete(chat.id)}
                >
                  <img src={deleteIcon} alt="delete" />
                  <span>Supprimer</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;