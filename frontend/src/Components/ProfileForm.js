import { useState } from "react";
import "./ProfileForm.css";

// images
import userIcon from "../assets/user.png";
import rocketIcon from "../assets/rocket.png";
import backIcon from "../assets/back.png";

function ProfileForm({ project, user, onNext, onBack }) {
  const [techLevels, setTechLevels] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Debug: Afficher l'utilisateur reçu
  console.log("ProfileForm - user received:", user);
  console.log("ProfileForm - project received:", project);

  const handleChange = (tech, level) => {
    setTechLevels({
      ...techLevels,
      [tech]: level
    });
  };

  const handleSubmit = async () => {
    // Vérifier que toutes les technologies ont un niveau sélectionné
    const missingTechs = project.technologies.filter(
      tech => !techLevels[tech] || techLevels[tech] === ""
    );
    
    if (missingTechs.length > 0) {
      setError(`Veuillez sélectionner un niveau pour: ${missingTechs.join(", ")}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    // ✅ CORRECTION: Récupérer l'ID correctement
    const userId = user?.id || user?.user_id;
    
    if (!userId) {
      setError("Utilisateur non identifié. Veuillez vous reconnecter.");
      setIsLoading(false);
      return;
    }

    // ✅ CORRECTION: Transformer les niveaux en anglais pour le backend
    const techLevelsForBackend = {};
    Object.entries(techLevels).forEach(([tech, level]) => {
      let mappedLevel = "";
      switch(level) {
        case "Débutant":
          mappedLevel = "none";
          break;
        case "Junior":
          mappedLevel = "junior";
          break;
        case "Intermédiaire":
          mappedLevel = "intermediate";
          break;
        case "Senior":
          mappedLevel = "senior";
          break;
        default:
          mappedLevel = "none";
      }
      techLevelsForBackend[tech] = mappedLevel;
    });

    console.log("Sending to backend:", {
      user_id: userId,
      project: project.name,
      technologies: techLevelsForBackend
    });

    try {
      const res = await fetch("http://127.0.0.1:5000/generate-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: userId,
          project: project.name,
          technologies: techLevelsForBackend
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erreur lors de la génération");
      }

      const data = await res.json();
      onNext(data.learning_path);
    } catch (err) {
      console.error("Error:", err);
      setError(err.message || "Une erreur s'est produite. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    return project.technologies.every(tech => 
      techLevels[tech] && techLevels[tech] !== ""
    );
  };

  return (
    <div className="modern-container">
      <div className="modern-card">

        {/* HEADER - Fixe */}
        <div className="header">
          <img src={userIcon} alt="user" className="avatar" />
          <h1>Ton niveau</h1>
          <span className="project-badge">{project.name}</span>
          <p className="subtitle">
            Sélectionne ton niveau actuel dans chaque technologie
          </p>
        </div>

        {/* ERROR MESSAGE */}
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {/* TECHNOLOGIES - SECTION AVEC SCROLL */}
        <div className="tech-list-container">
          <div className="tech-list">
            {project.technologies && project.technologies.length > 0 ? (
              project.technologies.map((tech, i) => (
                <div key={i} className="tech-card">
                  <div>
                    <h3>{tech}</h3>
                    <p className="tech-desc">Technologie</p>
                  </div>

                  <select 
                    onChange={(e) => handleChange(tech, e.target.value)}
                    disabled={isLoading}
                    value={techLevels[tech] || ""}
                  >
                    <option value="">Choisir</option>
                    <option value="Débutant">Débutant</option>
                    <option value="Junior">Junior</option>
                    <option value="Intermédiaire">Intermédiaire</option>
                    <option value="Senior">Senior</option>
                  </select>
                </div>
              ))
            ) : (
              <div className="error-message">
                <p>Aucune technologie trouvée pour ce projet.</p>
              </div>
            )}
          </div>
        </div>

        {/* BUTTONS - Fixe */}
        <div className="actions">
          <button 
            className="generate-btn" 
            onClick={handleSubmit}
            disabled={isLoading || !isFormValid()}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Génération en cours...
              </>
            ) : (
              <>
                <img src={rocketIcon} alt="generate" className="btn-icon" />
                Générer plan
              </>
            )}
          </button>

          <button 
            className="back-btn" 
            onClick={onBack}
            disabled={isLoading}
          >
            <img src={backIcon} alt="back" className="btn-icon" />
            Retour
          </button>
        </div>

        {/* PROGRESS INDICATOR */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-message">
              <div className="spinner-large"></div>
              <h3>Création de votre plan d'apprentissage...</h3>
              <p>Analyse de votre profil et génération du contenu personnalisé</p>
              <p className="small-text">Cela peut prendre quelques secondes</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ProfileForm;