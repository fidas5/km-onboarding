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
  
  // Check if it's a ZIP file
  if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.zip')) {
    setError("Seulement les fichiers ZIP sont acceptés");
    setFile(null);
    e.target.value = null;
    return;
  }
  
  // Increase max size to 1GB (or remove the limit)
  const maxSize = 1024 * 1024 * 1024; // 1GB
  if (selectedFile && selectedFile.size > maxSize) {
    setError(`Fichier trop volumineux (max 1GB). Votre fichier fait ${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB`);
    setFile(null);
    e.target.value = null;
    return;
  }
  
  setFile(selectedFile);
  setError(null);
};

  const handleSubmit = async () => {
    // Validation
    if (!name || !description || !technologies || !file) {
      setError("Tous les champs sont obligatoires");
      return;
    }

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append(
      "technologies",
      JSON.stringify(technologies.split(",").map(t => t.trim()))
    );
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:5000/add-project", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'ajout");
      }

      const result = await response.json();
      console.log("Success:", result);
      
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
    <div className="modal">
      <h2>Ajouter Projet</h2>

      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      <input
        placeholder="Nom du projet"
        onChange={(e) => setName(e.target.value)}
        disabled={isLoading}
      />

      <textarea
        placeholder="Description"
        onChange={(e) => setDescription(e.target.value)}
        disabled={isLoading}
      />

      <input
        placeholder="Technologies (ex: React,Node)"
        onChange={(e) => setTechnologies(e.target.value)}
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
  );
}

export default AddProjectModal;