import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import "./Login.css";

import mail from "../assets/email.png";
import illustration from "../assets/illustration.png";
import secureIcon from "../assets/secure.png";
import ecrire from "../assets/ecrire.png";
import aiIcon from "../assets/ai.png";
import rocket from "../assets/rocket.png";

function Register() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });

  useEffect(() => {
    if (!token) {
      navigate("/login");
    }
  }, [token, navigate]);

  // Fonction pour afficher un toast
  const showToast = (message, type = "error") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "" });
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name || !form.email || !form.password) {
      showToast("Veuillez remplir tous les champs", "error");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch("http://127.0.0.1:5000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token,
          name: form.name,
          email: form.email,
          password: form.password
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        showToast("Compte créé avec succès ! Redirection...", "success");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        showToast(data.error || "Erreur lors de l'inscription", "error");
      }
    } catch (error) {
      showToast("Erreur de connexion au serveur", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          <div className="toast-content">
            {toast.type === "success" ? (
              <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg className="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor"/>
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor"/>
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
          <button 
            className="toast-close" 
            onClick={() => setToast({ show: false, message: "", type: "" })}
          >
            ✕
          </button>
        </div>
      )}

      <div className="login-card">
        <div className="login-left">
          <img src={illustration} alt="illustration" />
        </div>

        <div className="login-right">
          <div className="header-block">
            <h1>
              <span className="blue">KM</span> Intelligent Platform
            </h1>
            <p className="subtitle">AI Onboarding des développeurs</p>
          </div>

          <div className="divider" />

          <div className="login-title-block">
            <h3>✨ Compléter mon inscription</h3>
            <p className="small-text">
              Entrez vos informations pour activer votre compte
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-box">
              <img src={ecrire} alt="name" />
              <input
                type="text"
                placeholder="Nom complet"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="input-box">
              <img src={mail} alt="email" />
              <input
                type="email"
                placeholder="Votre email (celui qui a reçu l'invitation)"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="input-box">
              <img src={secureIcon} alt="password" />
              <input
                type="password"
                placeholder="Mot de passe"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" disabled={isLoading}>
              {isLoading ? <span className="spinner"></span> : "Activer mon compte"}
            </button>
          </form>

          <div className="links">
            <div className="links-divider" />
            <p className="signup">
              Déjà un compte ?{" "}
              <span onClick={() => navigate("/login")}>
                Se connecter
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="features">
        <div className="feature-item">
          <img src={secureIcon} alt="secure" />
          <div>
            <strong>Sécurisé</strong>
            <p>Vos données sont protégées</p>
          </div>
        </div>

        <div className="feature-item">
          <img src={aiIcon} alt="ai" />
          <div>
            <strong>IA intelligente</strong>
            <p>Apprentissage personnalisé</p>
          </div>
        </div>

        <div className="feature-item">
          <img src={rocket} alt="rocket" />
          <div>
            <strong>Onboarding accéléré</strong>
            <p>Intégrez-vous plus vite</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;