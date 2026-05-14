import { useState } from "react";
import "./AddProjectModal.css";

function AddProjectModal({ close, refreshProjects }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [technologies, setTechnologies] = useState("");
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setError(null);
    
    // Check if it's a ZIP file
    if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.zip')) {
      setError("Seulement les fichiers ZIP sont acceptés");
      setFile(null);
      e.target.value = null;
      return;
    }
    
    // Max size 1GB
    const maxSize = 1024 * 1024 * 1024;
    if (selectedFile && selectedFile.size > maxSize) {
      setError(`Fichier trop volumineux (max 1GB). Votre fichier fait ${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB`);
      setFile(null);
      e.target.value = null;
      return;
    }
    
    setFile(selectedFile);
  };

  const handleSubmit = async () => {
    setError(null);
    
    // Validation
    if (!name.trim()) {
      setError("Le nom du projet est requis");
      return;
    }
    
    if (!description.trim()) {
      setError("La description est requise");
      return;
    }
    
    if (!technologies.trim()) {
      setError("Les technologies sont requises");
      return;
    }
    
    if (!file) {
      setError("Veuillez sélectionner un fichier ZIP");
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("description", description.trim());
    formData.append(
      "technologies",
      JSON.stringify(technologies.split(",").map(t => t.trim()).filter(t => t))
    );
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:5000/add-project", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'ajout du projet");
      }

      console.log("Success:", data);
      await refreshProjects();
      close();
    } catch (err) {
      console.error("Error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>📦 Ajouter un projet</h2>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <input
          type="text"
          placeholder="Nom du projet"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          disabled={isLoading}
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setError(null);
          }}
          disabled={isLoading}
        />

        <input
          type="text"
          placeholder="Technologies (ex: React, Node, Python)"
          value={technologies}
          onChange={(e) => {
            setTechnologies(e.target.value);
            setError(null);
          }}
          disabled={isLoading}
        />

        <input
          type="file"
          onChange={handleFileChange}
          disabled={isLoading}
          accept=".zip"
        />

        <button 
          onClick={handleSubmit} 
          disabled={isLoading || !file}
          className={isLoading ? "loading" : ""}
        >
          {isLoading ? (
            <>
              <span className="spinner"></span>
              Ajout en cours...
            </>
          ) : (
            "Valider"
          )}
        </button>
        
        <button onClick={close} disabled={isLoading}>
          Annuler
        </button>
      </div>
    </div>
  );
}

export default AddProjectModal;