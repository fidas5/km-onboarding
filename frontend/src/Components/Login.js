import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

import mail from "../assets/email.png";
import illustration from "../assets/illustration.png";
import secureIcon from "../assets/secure.png";
import aiIcon from "../assets/ai.png";
import rocket from "../assets/rocket.png";

function Login({ setUser }) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const showToast = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      showToast("error", "Veuillez remplir tous les champs");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password
        })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("token", data.token);
        
        if (data.role === "admin") {
          setUser(data.user);
          navigate("/admin");
        } else {
          setUser(data.user);
          navigate("/projects");
        }
        
        showToast("success", "Connexion réussie !");
      } else {
        showToast("error", data.error || "Email ou mot de passe incorrect");
      }
    } catch (error) {
      showToast("error", "Erreur de connexion au serveur");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      showToast("error", "Veuillez entrer votre email");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email })
      });

      const data = await res.json();

      if (res.ok) {
        showToast("success", `Email envoyé à ${form.email}`);
        setShowForgotConfirm(false);
      } else {
        showToast("error", data.message || "Email non trouvé");
      }
    } catch (error) {
      showToast("error", "Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
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

      {showForgotConfirm && (
        <div className="modal-overlay" onClick={() => setShowForgotConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmation</h3>
            <p>Un email de réinitialisation sera envoyé à :</p>
            <div className="email-display">{form.email}</div>
            <p className="confirm-text">Voulez-vous continuer ?</p>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={() => setShowForgotConfirm(false)}>
                Annuler
              </button>
              <button className="btn-submit" onClick={handleForgotPassword} disabled={isLoading}>
                {isLoading ? "Envoi..." : "Confirmer"}
              </button>
            </div>
          </div>
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
            <h3>Connexion</h3>
            <p className="small-text">Accédez à votre espace d'apprentissage</p>
          </div>

          <div className="input-box">
            <img src={mail} alt="email" />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="input-box">
            <img src={secureIcon} alt="password" />
            <input
              type="password"
              placeholder="Mot de passe"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          <button onClick={handleLogin} disabled={isLoading}>
            {isLoading ? <span className="spinner"></span> : "Se connecter"}
          </button>

          <div className="links">
            <p className="forgot" onClick={() => setShowForgotConfirm(true)}>
              Mot de passe oublié ?
            </p>

            <div className="links-divider" />

           
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

export default Login;