import ReactMarkdown from "react-markdown";
import "./LearningPage.css";
import skipIcon from "../assets/skip.png";
import startIcon from "../assets/start.png";


function LearningPage({ path, user, project, onSkip, onContinue }) {

  const updateStatus = async (status) => {
    await fetch("http://127.0.0.1:5000/update-learning-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: user.user_id,
        project: project.name,
        status
      })
    });
  };

  return (
    <div className="learning-container">

      <div className="learning-card">

        {/* HEADER */}
        <div className="header">
          <h1>Ton plan d’apprentissage</h1>
          <p className="project">
            Projet : <span>{project.name}</span>
          </p>
        </div>

        {/* CONTENT */}
        <div className="learning-content">
          <ReactMarkdown>{path}</ReactMarkdown>
        </div>

        

        {/* ACTIONS */}
        <div className="actions">
  <button
    className="skip-btn"
    onClick={() => {
      updateStatus("skipped");
      onSkip();
    }}
  >
    <img src={skipIcon} alt="skip" className="btn-icon" />
    Skip
  </button>

  <button
    className="start-btn"
    onClick={() => {
      updateStatus("in_progress");
      onContinue();
    }}
  >
    <img src={startIcon} alt="start" className="btn-icon" />
    Commencer apprentissage
  </button>
</div>

      </div>
    </div>
  );
}

export default LearningPage;