import { useEffect, useState } from "react";
import "./ProjectSelector.css";
import AddProjectModal from "./AddProjectModal";

function ProjectSelector({ setProject, logout }) {
  const [projects, setProjects] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [learningStatus, setLearningStatus] = useState({});

  // 👤 Read user from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userName = user.name || "Utilisateur";
  const userId = user.user_id || null;
  
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Charger les projets (UNE SEULE FOIS)
  const loadProjects = () => {
    fetch("http://127.0.0.1:5000/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .catch((err) => console.error(err));
  };

  // Vérifier pour chaque projet s'il a un plan d'apprentissage
  const checkLearningStatus = async (projectName) => {
    if (!userId) return null;
    
    try {
      const response = await fetch(`http://127.0.0.1:5000/get-learning-progress/${userId}/${projectName}`);
      const data = await response.json();
      
      if (data.exists) {
        return {
          exists: true,
          status: data.status,
          progress: data.progress_percentage || 0,
          lastAccessed: data.last_accessed
        };
      }
      return { exists: false };
    } catch (error) {
      console.error("Error checking learning status:", error);
      return { exists: false };
    }
  };

  // Charger les statuts d'apprentissage pour tous les projets
  useEffect(() => {
    if (userId && Object.keys(projects).length > 0) {
      const loadAllStatuses = async () => {
        const statuses = {};
        for (const projectName of Object.keys(projects)) {
          const status = await checkLearningStatus(projectName);
          if (status.exists) {
            statuses[projectName] = status;
          }
        }
        setLearningStatus(statuses);
      };
      
      loadAllStatuses();
    }
  }, [projects, userId]);

  // Charger les projets au montage du composant
  useEffect(() => {
    loadProjects();
  }, []);

  // Gérer le clic sur le bouton d'apprentissage
  const handleLearningClick = async (project) => {
    if (!userId) {
      console.error("User not logged in");
      return;
    }
    
    try {
      // Vérifier si un plan existe déjà
      const response = await fetch(`http://127.0.0.1:5000/get-learning-progress/${userId}/${project.name}`);
      const data = await response.json();
      
      if (data.exists) {
        // Plan existe - reprendre l'apprentissage
        setProject({ 
          ...project, 
          action: "continue_learning",
          learningData: {
            learningPlan: data.learning_path,
            pathId: data.path_id,
            status: data.status,
            completedSteps: data.completed_steps,
            progress: data.progress_percentage
          }
        });
      } else {
        // Pas de plan - créer un nouveau
        setProject({ ...project, action: "learn" });
      }
    } catch (error) {
      console.error("Error:", error);
      // Fallback: créer un nouveau plan
      setProject({ ...project, action: "learn" });
    }
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className="sidebar">
        <h2 className="logo">AI Onboarding</h2>

        <p className="menu active">Projets</p>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* 👤 User Profile */}
        <div className="user-profile">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-role">Développeur</span>
          </div>
          <button className="logout-btn" onClick={logout} title="Se déconnecter">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="main">
        <div className="top-bar">
          <h1 className="title">Modules disponibles</h1>

          <button
            className="new-project"
            onClick={() => setShowForm(true)}
          >
            + Ajouter Projet
          </button>
        </div>

        <div className="cards">
          {Object.entries(projects).map(([name, data], index) => {
            const learningInfo = learningStatus[name];
            const hasLearningPlan = learningInfo?.exists;
            const progress = learningInfo?.progress || 0;
            
            return (
              <div
                key={index}
                className={`card ${name === "flasky" ? "blue" : "green"}`}
              >
                <div className="card-header">
                  <h2>{name}</h2>
                  
                </div>

                <p className="desc">{data?.description}</p>

                <div className="badges">
                  {(Array.isArray(data?.technologies) ? data.technologies : []).map((tech, i) => (
                    <span key={i} className="badge">{tech}</span>
                  ))}
                </div>

                <button
                  className="chat-btn"
                  onClick={() =>
                    setProject({
                      name,
                      description: data?.description,
                      technologies: data?.technologies,
                      action: "chat",
                    })
                  }
                >
                  💬 Explorer le projet avec l'IA
                </button>

                <button
                  className={`learn-btn ${hasLearningPlan ? 'continue-btn' : 'new-btn'}`}
                  onClick={() => handleLearningClick({ name, description: data?.description, technologies: data?.technologies })}
                >
                  {hasLearningPlan ? (
                    <>
                      <span className="btn-icon">🔄</span>
                      Continuer votre apprentissage
                      {progress > 0 && (
                        <span className="btn-progress">{Math.round(progress)}%</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="btn-icon">🚀</span>
                      Créer un parcours d'apprentissage
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup */}
      {showForm && (
        <div className="modal-overlay">
          <AddProjectModal
            close={() => setShowForm(false)}
            refreshProjects={loadProjects}
          />
        </div>
      )}
    </div>
  );
}

export default ProjectSelector;