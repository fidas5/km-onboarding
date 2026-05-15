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

  // ✅ FONCTION POUR NETTOYER ET PARSER LE JSON
  const safeParseLearningPath = (rawData) => {
    // Si c'est déjà un objet valide
    if (rawData && typeof rawData === 'object' && !rawData.includes) {
      if (rawData.modules && Array.isArray(rawData.modules)) {
        return rawData;
      }
    }
    
    // Si c'est une string, on nettoie et on parse
    if (typeof rawData === 'string') {
      let cleaned = rawData;
      
      // 1. Enlever les balises markdown code blocks
      cleaned = cleaned.replace(/```json\s*/g, '');
      cleaned = cleaned.replace(/```\s*/g, '');
      cleaned = cleaned.replace(/```/g, '');
      
      // 2. Enlever les espaces au début et fin
      cleaned = cleaned.trim();
      
      // 3. Trouver le premier { et le dernier }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      
      // 4. Nettoyer les virgules en trop
      cleaned = cleaned.replace(/,\s*}/g, '}');
      cleaned = cleaned.replace(/,\s*]/g, ']');
      
      // 5. Nettoyer les guillemets simples (si présents)
      // cleaned = cleaned.replace(/'/g, '"'); // À utiliser avec prudence
      
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.modules && Array.isArray(parsed.modules)) {
          return parsed;
        }
      } catch (e) {
        console.error("JSON parse error:", e);
        console.log("Problematic JSON:", cleaned.substring(0, 500));
      }
    }
    
    // Fallback: créer un plan par défaut
    console.warn("⚠️ Utilisation du plan par défaut");
    return {
      title: `Plan d'apprentissage - ${project.name}`,
      description: "Plan personnalisé pour maîtriser ce projet",
      total_estimated_hours: "Non défini",
      difficulty_level: "Personnalisé",
      modules: [
        {
          id: "module_1",
          title: "Découverte du projet",
          description: `Comprendre l'architecture et les composants principaux de ${project.name}`,
          estimated_time: "2-3 heures",
          steps: [
            {
              id: "step_1_1",
              title: "Installation et configuration",
              description: "Mettre en place l'environnement de développement",
              resources: [
                { type: "Documentation", title: "README du projet", url: "#" }
              ],
              exercises: []
            },
            {
              id: "step_1_2",
              title: "Compréhension de l'architecture",
              description: "Identifier les composants clés et leurs interactions",
              resources: [],
              exercises: []
            }
          ]
        },
        {
          id: "module_2",
          title: "Maîtrise des technologies",
          description: "Approfondir les compétences sur les technologies du projet",
          estimated_time: "4-5 heures",
          steps: [
            {
              id: "step_2_1",
              title: "Pratique des technologies principales",
              description: "Mettre en pratique les concepts appris",
              resources: [],
              exercises: []
            }
          ]
        }
      ]
    };
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

    const userId = user?.id || user?.user_id;
    
    if (!userId) {
      setError("Utilisateur non identifié. Veuillez vous reconnecter.");
      setIsLoading(false);
      return;
    }

    // Transformer les niveaux en anglais pour le backend
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
      
      // ✅ CORRECTION: Nettoyer et parser le learning_path avant de l'utiliser
      const cleanLearningPath = safeParseLearningPath(data.learning_path);
      
      console.log("✅ Cleaned learning path:", cleanLearningPath);
      onNext(cleanLearningPath);
      
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

        <div className="header">
          <img src={userIcon} alt="user" className="avatar" />
          <h1>Ton niveau</h1>
          <span className="project-badge">{project.name}</span>
          <p className="subtitle">
            Sélectionne ton niveau actuel dans chaque technologie
          </p>
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

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