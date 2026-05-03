import { useState } from "react";
import "./Login.css";

import mail from "../assets/email.png";
import illustration from "../assets/illustration.png";
import secureIcon from "../assets/secure.png";
import aiIcon from "../assets/ai.png";
import rocket from "../assets/rocket.png";
import ecrire from "../assets/ecrire.png";

function Login({ setUser }) {
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  // Clear message after 5 seconds
  const clearMessage = () => {
    setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 5000);
  };

  // =========================
  // LOGIN / REGISTER
  // =========================
  const handleSubmit = async () => {
    // Validation
    if (!form.email || !form.password) {
      setMessage({ type: "error", text: "Veuillez remplir tous les champs" });
      clearMessage();
      return;
    }

    if (isRegister && !form.name) {
      setMessage({ type: "error", text: "Veuillez entrer votre nom complet" });
      clearMessage();
      return;
    }

    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const url = isRegister
        ? "http://127.0.0.1:5000/register"
        : "http://127.0.0.1:5000/login";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = await res.json();

      if (res.ok) {
        if (!isRegister) {
          localStorage.setItem("user", JSON.stringify(data));
          setUser(data);
          setMessage({ type: "success", text: "Connexion réussie ! Redirection..." });
        } else {
          setMessage({ type: "success", text: "Compte créé avec succès !" });
          clearMessage();
          setIsRegister(false);
          setForm({
            name: "",
            email: "",
            password: ""
          });
        }
      } else {
        setMessage({ type: "error", text: data.error || data.message || "Une erreur est survenue" });
        clearMessage();
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erreur de connexion au serveur" });
      clearMessage();
    } finally {
      setIsLoading(false);
    }
  };

  // =========================
  // FORGOT PASSWORD - Uses email from form
  // =========================
  const handleForgotPassword = async () => {
    // Check if email field is filled
    if (!form.email.trim()) {
      setMessage({ type: "error", text: "Veuillez entrer votre email dans le champ ci-dessus" });
      clearMessage();
      return;
    }

    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await fetch("http://127.0.0.1:5000/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email })
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: `Email de réinitialisation envoyé à ${form.email} ! Vérifiez votre boîte de réception.` });
        clearMessage();
        setShowForgotConfirm(false);
      } else {
        setMessage({ type: "error", text: data.message || data.error || "Email non trouvé" });
        clearMessage();
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erreur de connexion au serveur" });
      clearMessage();
    } finally {
      setIsLoading(false);
    }
  };

  // Show confirmation dialog before sending
  const confirmForgotPassword = () => {
    if (!form.email.trim()) {
      setMessage({ type: "error", text: "Veuillez entrer votre email dans le champ ci-dessus" });
      clearMessage();
      return;
    }
    setShowForgotConfirm(true);
  };

  return (
    <div className="login-container">
      {/* Success/Error Message Toast */}
      {message.text && (
        <div className={`message-toast ${message.type}`}>
          <span className="message-icon">
            {message.type === "success" ? "✓" : "✗"}
          </span>
          <span className="message-text">{message.text}</span>
          <button 
            className="message-close" 
            onClick={() => setMessage({ type: "", text: "" })}
          >
            ×
          </button>
        </div>
      )}

      {/* Forgot Password Confirmation Modal */}
      {showForgotConfirm && (
        <div className="modal-overlay" onClick={() => setShowForgotConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmation</h3>
            <p>Un email de réinitialisation sera envoyé à :</p>
            <div className="email-display">{form.email}</div>
            <p className="confirm-text">Voulez-vous continuer ?</p>
            <div className="modal-buttons">
              <button 
                className="btn-cancel" 
                onClick={() => setShowForgotConfirm(false)}
              >
                Annuler
              </button>
              <button 
                className="btn-submit" 
                onClick={handleForgotPassword}
                disabled={isLoading}
              >
                {isLoading ? "Envoi..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="login-card">
        {/* LEFT */}
        <div className="login-left">
          <img src={illustration} alt="illustration" />
        </div>

        {/* RIGHT */}
        <div className="login-right">
          <div className="header-block">
            <h1>
              <span className="blue">KM</span> Intelligent Platform
            </h1>
            <p className="subtitle">
              AI Onboarding des développeurs
            </p>
          </div>

          <div className="divider" />

          <div className="login-title-block">
            <h3>
              {isRegister ? "Créer un compte" : "Connexion"}
            </h3>
            <p className="small-text">
              Accédez à votre espace d'apprentissage intelligent
            </p>
          </div>

          {/* NAME (REGISTER ONLY) */}
          {isRegister && (
            <div className="input-box">
              <img src={ecrire} alt="name" />
              <input
                type="text"
                placeholder="Nom complet"
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
            </div>
          )}
          
          {/* EMAIL */}
          <div className="input-box">
            <img src={mail} alt="email" />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />
          </div>

          {/* PASSWORD */}
          <div className="input-box">
            <img src={secureIcon} alt="password" />
            <input
              type="password"
              placeholder="Mot de passe"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
              onKeyPress={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {/* BUTTON */}
          <button 
            onClick={handleSubmit} 
            disabled={isLoading}
            className={isLoading ? "loading" : ""}
          >
            {isLoading ? (
              <span className="spinner"></span>
            ) : (
              isRegister ? "Créer compte" : "Se connecter"
            )}
          </button>

          {/* LINKS */}
          <div className="links">
            {!isRegister && (
              <p className="forgot" onClick={confirmForgotPassword}>
                Mot de passe oublié ?
              </p>
            )}

            <div className="links-divider" />

            <p className="signup">
              {isRegister ? "Déjà un compte ?" : "Nouveau ici ?"}
              <span onClick={() => {
                setIsRegister(!isRegister);
                setMessage({ type: "", text: "" });
              }}>
                {" "}
                {isRegister ? "Connexion" : "Créer un compte"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* FEATURES */}
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

export default Login;