import { useLocation } from "react-router-dom";
import { useState } from "react";
import "./ModulesInteractifs.css";

function ModulesInteractifs() {
  const location = useLocation();

  const { path, project } = location.state || {};

  // =========================
  // ✅ SAFE PARSING MODULES
  // =========================
  let modules = [];

  try {
    if (Array.isArray(path)) {
      modules = path;
    } 
    else if (typeof path === "string") {
      modules = JSON.parse(path);
    } 
    else if (path?.learning_path) {
      modules = Array.isArray(path.learning_path)
        ? path.learning_path
        : JSON.parse(path.learning_path);
    }
  } catch (e) {
    console.error("Erreur parsing modules:", e);
    modules = [];
  }

  const [checked, setChecked] = useState({});
  const [openTab, setOpenTab] = useState({});

  // toggle module
  const toggle = (id) => {
    setChecked((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // change tab
  const setTab = (moduleId, tab) => {
    setOpenTab((prev) => ({
      ...prev,
      [moduleId]: tab
    }));
  };

  const total = modules.length;
  const done = Object.values(checked).filter(Boolean).length;
  const progress = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="modules-container">
      <div className="modules-card">

        <h1>📚 Modules interactifs</h1>
        <p>Projet : <b>{project?.name}</b></p>

        {/* PROGRESS */}
        <div className="progress-bar">
          <div style={{ width: `${progress}%` }} />
        </div>
        <p>{progress}% complété</p>

        {/* MODULES */}
        <div className="modules-list">

          {modules.map((m, i) => {
            const tab = openTab[i] || "explication";

            return (
              <div key={i} className="module-item">

                {/* TITLE */}
                <div className="module-title" onClick={() => toggle(i)}>
                  <input type="checkbox" checked={!!checked[i]} readOnly />
                  <h3>{m.title}</h3>
                </div>

                {/* CONTENT */}
                {checked[i] && (
                  <div className="module-content">

                    {/* TABS */}
                    <div className="tabs">
                      <button
                        className={tab === "explication" ? "active" : ""}
                        onClick={() => setTab(i, "explication")}
                      >
                        📘 Explication
                      </button>

                      <button
                        className={tab === "exemples" ? "active" : ""}
                        onClick={() => setTab(i, "exemples")}
                      >
                        💡 Exemples
                      </button>

                      <button
                        className={tab === "tickets" ? "active" : ""}
                        onClick={() => setTab(i, "tickets")}
                      >
                        🎯 Tickets
                      </button>
                    </div>

                    {/* TAB CONTENT */}
                    {tab === "explication" && (
                      <p>{m.explication}</p>
                    )}

                    {tab === "exemples" && (
                      <ul>
                        {m.exemples?.map((ex, j) => (
                          <li key={j}>{ex}</li>
                        ))}
                      </ul>
                    )}

                    {tab === "tickets" && (
                      <ul>
                        {m.tickets?.map((t, j) => (
                          <li key={j}>{t}</li>
                        ))}
                      </ul>
                    )}

                  </div>
                )}

              </div>
            );
          })}

        </div>
      </div>
    </div>
  );
}

export default ModulesInteractifs;