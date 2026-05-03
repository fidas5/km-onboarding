import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./ResetPassword.css";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Clear message after 5 seconds
  const clearMessage = () => {
    setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 5000);
  };

  const resetPassword = async () => {
    // Validation
    if (!password || !confirm) {
      setMessage({ type: "error", text: "Veuillez remplir tous les champs" });
      clearMessage();
      return;
    }

    if (password !== confirm) {
      setMessage({ type: "error", text: "Les mots de passe ne correspondent pas" });
      clearMessage();
      return;
    }

    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await fetch(
        `http://127.0.0.1:5000/reset-password/${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ password })
        }
      );

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: "Mot de passe modifié avec succès ! Redirection vers la connexion..." });
        clearMessage();
        
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } else {
        setMessage({ type: "error", text: data.error || data.message || "Une erreur est survenue" });
        clearMessage();
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erreur de connexion au serveur. Vérifiez que le backend est démarré." });
      clearMessage();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="reset-container">
      {/* Toast Message */}
      {message.text && (
        <div className={`reset-toast ${message.type}`}>
          <span className="reset-toast-icon">
            {message.type === "success" ? "✓" : "✗"}
          </span>
          <span className="reset-toast-text">{message.text}</span>
          <button 
            className="reset-toast-close" 
            onClick={() => setMessage({ type: "", text: "" })}
          >
            ×
          </button>
        </div>
      )}

      <div className="reset-card">
        <div className="reset-header">
          <div className="reset-icon">🔐</div>
          <h1>Réinitialiser mot de passe</h1>
          <p className="reset-subtitle">Entrez votre nouveau mot de passe</p>
        </div>

        <div className="reset-divider" />

        <div className="reset-form">
          <div className="reset-input-group">
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              placeholder="Entrez votre nouveau mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && resetPassword()}
              disabled={isLoading}
            />
          </div>

          <div className="reset-input-group">
            <label>Confirmer le mot de passe</label>
            <input
              type="password"
              placeholder="Confirmez votre nouveau mot de passe"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && resetPassword()}
              disabled={isLoading}
            />
          </div>

          <button 
            onClick={resetPassword} 
            disabled={isLoading}
            className={isLoading ? "loading" : ""}
          >
            {isLoading ? (
              <>
                <span className="reset-spinner"></span>
                Modification...
              </>
            ) : (
              "Modifier mot de passe"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;