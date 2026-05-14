import { useEffect, useState } from "react";
import "./ProjectSelector.css";
import AddProjectModal from "./AddProjectModal";
import EditProjectModal from "./EditProjectModal";
import { FiLogOut } from "react-icons/fi";

function ProjectSelector({ setProject, logout }) {
  const [projects, setProjects] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(null);
  const [learningStatus, setLearningStatus] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // ✅ CORRECTION: Récupérer l'utilisateur correctement
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userName = user.name || "Utilisateur";
  const userId = user.id || user.user_id || null;  // ✅ Essayer les deux formats
  const token = localStorage.getItem("token");  // ✅ Récupérer le token aussi

  // ✅ Debug: Afficher dans la console pour vérifier
  console.log("User from localStorage:", user);
  console.log("UserId:", userId);
  console.log("Token:", token);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Charger les projets
  const loadProjects = () => {
    fetch("http://127.0.0.1:5000/projects", {
      headers: {
        "Authorization": token ? `Bearer ${token}` : "",
        "Content-Type": "application/json"
      }
    })
      .then((res) => res.json())
      .then((data) => setProjects(data))
      .catch((err) => console.error(err));
  };

  // Supprimer un projet
  const deleteProject = async (projectName) => {
    try {
      const response = await fetch("http://127.0.0.1:5000/delete_project", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          project_name: projectName,
          confirm: true
        }),
      });

      const data = await response.json();

      if (response.ok) {
        loadProjects();
        setShowDeleteConfirm(null);
        console.log(`Projet "${projectName}" supprimé avec succès`);
      } else {
        console.error("Erreur:", data.error);
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
      alert("Erreur lors de la suppression du projet");
    }
  };

  // Modifier un projet
  const editProject = async (projectName, projectData) => {
    try {
      console.log("Modification du projet:", projectName, "avec data:", projectData);
      
      const response = await fetch(`http://127.0.0.1:5000/projects/${projectName}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(projectData),
      });

      const data = await response.json();

      if (response.ok) {
        loadProjects();
        setShowEditForm(null);
        alert("Projet modifié avec succès !");
      } else {
        console.error("Erreur:", data.error);
        alert(`Erreur: ${data.error}`);
      }
    } catch (error) {
      console.error("Erreur lors de la modification:", error);
      alert("Erreur lors de la modification du projet");
    }
  };

  // ✅ CORRECTION: Vérifier l'utilisateur avant d'appeler l'API
  const checkLearningStatus = async (projectName) => {
    console.log("checkLearningStatus - userId:", userId, "projectName:", projectName);
    
    if (!userId) {
      console.warn("No user ID found, cannot check learning status");
      return null;
    }
    
    try {
      const response = await fetch(`http://127.0.0.1:5000/get-learning-progress/${userId}/${projectName}`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        }
      });
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
          if (status && status.exists) {
            statuses[projectName] = status;
          }
        }
        setLearningStatus(statuses);
      };
      
      loadAllStatuses();
    } else {
      console.log("Cannot load statuses - userId:", userId, "projects count:", Object.keys(projects).length);
    }
  }, [projects, userId]);

  // Charger les projets au montage du composant
  useEffect(() => {
    loadProjects();
  }, []);

  // ✅ CORRECTION: Gérer le clic sur le bouton d'apprentissage
  const handleLearningClick = async (project) => {
    console.log("handleLearningClick - userId:", userId, "project:", project);
    
    if (!userId) {
      console.error("User not logged in - No userId found");
      alert("Veuillez vous reconnecter pour accéder à cette fonctionnalité");
      return;
    }
    
    try {
      const response = await fetch(`http://127.0.0.1:5000/get-learning-progress/${userId}/${project.name}`, {
        headers: {
          "Authorization": token ? `Bearer ${token}` : "",
        }
      });
      const data = await response.json();
      
      if (data.exists) {
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
        setProject({ ...project, action: "learn" });
      }
    } catch (error) {
      console.error("Error:", error);
      setProject({ ...project, action: "learn" });
    }
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className="sidebar">
        <h2 className="logo">AI Onboarding</h2>
        <p className="menu active">Projets</p>
        <div style={{ flex: 1 }} />
        <div className="user-profile">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-role">Développeur</span>
          </div>
          <button className="logout-btn" onClick={logout} title="Se déconnecter">
            <FiLogOut size={18} />
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="main">
        <div className="top-bar">
          <h1 className="title">Modules disponibles</h1>
          <button className="new-project" onClick={() => setShowForm(true)}>
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
                  <div className="card-actions">
                    <button
                      className="edit-project-btn"
                      onClick={() => setShowEditForm({ name, ...data })}
                      title="Modifier le projet"
                    >
                      ✏️
                    </button>
                    <button
                      className="delete-project-btn"
                      onClick={() => setShowDeleteConfirm(name)}
                      title="Supprimer le projet"
                    >
                      🗑️
                    </button>
                  </div>
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

      {/* Popup pour ajouter un projet */}
      {showForm && (
        <div className="modal-overlay">
          <AddProjectModal
            close={() => setShowForm(false)}
            refreshProjects={loadProjects}
          />
        </div>
      )}

      {/* Popup pour modifier un projet */}
      {showEditForm && (
        <div className="modal-overlay">
          <EditProjectModal
            project={showEditForm}
            close={() => setShowEditForm(null)}
            onSave={editProject}
          />
        </div>
      )}

      {/* Popup de confirmation de suppression */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="delete-confirm-modal">
            <h3>Confirmer la suppression</h3>
            <p>
              Êtes-vous sûr de vouloir supprimer le projet <strong>"{showDeleteConfirm}"</strong> ?
            </p>
            <div className="delete-modal-buttons">
              <button
                className="cancel-delete-btn"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Annuler
              </button>
              <button
                className="confirm-delete-btn"
                onClick={() => deleteProject(showDeleteConfirm)}
              >
                Oui, supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectSelector;