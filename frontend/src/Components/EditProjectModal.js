import { useState } from "react";
import "./EditProjectModal.css";

function EditProjectModal({ project, close, onSave }) {
  const [projectName, setProjectName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [technologies, setTechnologies] = useState(
    Array.isArray(project.technologies) ? project.technologies.join(", ") : ""
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const updatedData = {};
    
    if (projectName !== project.name) {
      updatedData.name = projectName;
    }
    
    if (description !== project.description) {
      updatedData.description = description;
    }
    
    const techArray = technologies
      .split(",")
      .map(tech => tech.trim())
      .filter(tech => tech !== "");
    
    const originalTechArray = Array.isArray(project.technologies) ? project.technologies : [];
    
    if (JSON.stringify(techArray) !== JSON.stringify(originalTechArray)) {
      updatedData.technologies = techArray;
    }
    
    if (Object.keys(updatedData).length === 0) {
      close();
      return;
    }
    
    // Utiliser le NOM du projet (pas l'ID)
    onSave(project.name, updatedData);
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-header">
          <h2>✏️ Modifier le projet</h2>
          <button className="close-modal-btn" onClick={close}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Nom du projet</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="ex: Flasky, ReactApp, ..."
              required
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez brièvement votre projet..."
              rows="4"
            />
          </div>
          
          <div className="form-group">
            <label>Technologies (séparées par des virgules)</label>
            <input
              type="text"
              value={technologies}
              onChange={(e) => setTechnologies(e.target.value)}
              placeholder="Python, React, Docker, PostgreSQL, ..."
            />
            <small className="input-hint">
              💡 Exemple: Python, FastAPI, MongoDB, React
            </small>
          </div>
          
          <div className="edit-modal-buttons">
            <button type="button" className="cancel-edit-btn" onClick={close}>
              Annuler
            </button>
            <button type="submit" className="save-edit-btn">
              💾 Enregistrer les modifications
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProjectModal;