import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./LearningPlan.css";

function LearningPlan({ learningPlan, project, userId, onComplete, onContinue, pathId: initialPathId }) {
  const navigate = useNavigate();
  const [modules, setModules] = useState([]);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [expandedModule, setExpandedModule] = useState(null);
  const [expandedStep, setExpandedStep] = useState(null);
  const [globalProgress, setGlobalProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [pathId, setPathId] = useState(initialPathId);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Charger le plan et la progression sauvegardée
  useEffect(() => {
    loadSavedProgress();
  }, [userId, project]);

  const loadSavedProgress = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:5000/get-learning-progress/${userId}/${project}`);
      const data = await response.json();
      
      if (data.exists) {
        if (data.learning_path) {
          if (data.learning_path.modules) {
            setModules(data.learning_path.modules);
          } else if (typeof data.learning_path === 'string') {
            const parsed = parseLearningPlanToModules(data.learning_path);
            setModules(parsed);
          }
        }
        
        if (data.completed_steps && data.completed_steps.length > 0) {
          setCompletedSteps(new Set(data.completed_steps));
        }
        
        setPathId(data.path_id);
        
        if (data.progress_percentage > 0 && data.progress_percentage < 100) {
          showToastMessage(`Reprise du plan: ${Math.round(data.progress_percentage)}% complété`, "info");
        }
      } else if (learningPlan) {
        if (learningPlan.modules) {
          setModules(learningPlan.modules);
        } else if (typeof learningPlan === 'string') {
          const parsed = parseLearningPlanToModules(learningPlan);
          setModules(parsed);
        } else if (Array.isArray(learningPlan)) {
          setModules(learningPlan);
        }
      }
    } catch (error) {
      console.error("Error loading progress:", error);
      if (learningPlan) {
        if (learningPlan.modules) {
          setModules(learningPlan.modules);
        } else if (typeof learningPlan === 'string') {
          const parsed = parseLearningPlanToModules(learningPlan);
          setModules(parsed);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const parseLearningPlanToModules = (text) => {
    const modules = [];
    modules.push({
      id: "module_1",
      title: "Plan d'apprentissage",
      description: text.substring(0, 200),
      estimated_time: "Variable",
      steps: extractStepsFromText(text)
    });
    return modules;
  };

  const extractStepsFromText = (text) => {
    const steps = [];
    const lines = text.split('\n').filter(l => l.trim().match(/^\d+\.|\•|\-/));
    lines.forEach((line, idx) => {
      steps.push({
        id: `step_${idx + 1}`,
        title: line.replace(/^\d+\.|\•|\-/, '').trim().substring(0, 100),
        description: line,
        resources: [],
        exercises: []
      });
    });
    return steps;
  };

  // Sauvegarder la progression automatiquement
  useEffect(() => {
    if (completedSteps.size > 0 && modules.length > 0 && !isLoading) {
      const timer = setTimeout(() => {
        saveProgressToBackend();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [completedSteps]);

  const saveProgressToBackend = async () => {
    if (!userId || !project) return;
    
    setIsSaving(true);
    try {
      const response = await fetch("http://127.0.0.1:5000/save-learning-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          project: project,
          completed_steps: [...completedSteps],
          status: globalProgress === 100 ? "completed" : "in_progress"
        })
      });
      
      if (response.ok) {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const showToastMessage = (message, type = "success") => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Calculer le progrès total
  useEffect(() => {
    const totalSteps = modules.reduce((acc, module) => acc + (module.steps?.length || 0), 0);
    const progress = totalSteps > 0 ? (completedSteps.size / totalSteps) * 100 : 0;
    setGlobalProgress(progress);
    
    // Vérifier si le plan est complété à 100%
    if (progress === 100 && totalSteps > 0) {
      saveProgressToBackend();
      showToastMessage("🎉 Félicitations! Vous avez complété ce plan d'apprentissage!", "success");
      if (onComplete) {
        onComplete();
      }
    }
  }, [completedSteps, modules]);

  const toggleStep = (stepId) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const toggleModule = (moduleId) => {
    setExpandedModule(expandedModule === moduleId ? null : moduleId);
  };

  const toggleStepDetail = (stepId) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  const getModuleProgress = (module) => {
    const totalSteps = module.steps?.length || 0;
    if (totalSteps === 0) return 0;
    const completed = module.steps.filter(step => completedSteps.has(step.id)).length;
    return (completed / totalSteps) * 100;
  };

  const getTotalSteps = () => {
    return modules.reduce((acc, module) => acc + (module.steps?.length || 0), 0);
  };

  const getCompletedStepsCount = () => {
    return completedSteps.size;
  };

  const handleResetProgress = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir réinitialiser toute votre progression ?")) {
      setCompletedSteps(new Set());
      await saveProgressToBackend();
      showToastMessage("Progression réinitialisée", "info");
    }
  };

  const handleBackToProjects = () => {
    navigate("/projects");
  };

  // Fonction pour afficher un exercice correctement (objet ou string)
  const renderExercise = (exercise, index) => {
    // Si c'est une string, l'afficher simplement
    if (typeof exercise === 'string') {
      return <li key={index}>{exercise}</li>;
    }
    
    // Si c'est un objet avec les propriétés attendues
    if (typeof exercise === 'object' && exercise !== null) {
      return (
        <li key={index} className="exercise-item">
          <strong>{exercise.title || `Exercice ${index + 1}`}</strong>
          <p className="exercise-instructions">{exercise.instructions}</p>
          {exercise.expected_output && (
            <div className="exercise-expected">
              <span className="expected-label">✅ Résultat attendu :</span>
              <pre className="expected-output">
                {typeof exercise.expected_output === 'object' 
                  ? JSON.stringify(exercise.expected_output, null, 2)
                  : exercise.expected_output}
              </pre>
            </div>
          )}
          {exercise.hint && (
            <div className="exercise-hint">
              💡 <span className="hint-label">Astuce :</span> {exercise.hint}
            </div>
          )}
        </li>
      );
    }
    
    // Fallback
    return <li key={index}>{String(exercise)}</li>;
  };

  // Fonction pour afficher une ressource correctement (objet ou string)
  const renderResource = (resource, index) => {
    // Si c'est une string
    if (typeof resource === 'string') {
      return <li key={index}>{resource}</li>;
    }
    
    // Si c'est un objet avec url et title
    if (typeof resource === 'object' && resource !== null) {
      const url = resource.url || resource.link;
      const title = resource.title || resource.name || 'Ressource';
      const type = resource.type ? ` [${resource.type}]` : '';
      
      if (url) {
        return (
          <li key={index}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {title}{type}
            </a>
          </li>
        );
      }
      return <li key={index}>{title}{type}</li>;
    }
    
    return <li key={index}>{String(resource)}</li>;
  };

  if (isLoading) {
    return (
      <div className="learning-plan-container">
        <div className="loading-state">
          <div className="spinner-large"></div>
          <h2>Chargement de votre plan...</h2>
          <p>Récupération de votre progression sauvegardée</p>
        </div>
      </div>
    );
  }

  if (!modules || modules.length === 0) {
    return (
      <div className="learning-plan-container">
        <div className="error-state">
          <h2>⚠️ Génération du plan en cours</h2>
          <p>Votre plan d'apprentissage personnalisé est en cours de création...</p>
          <div className="spinner"></div>
          <button className="back-to-projects-btn" onClick={handleBackToProjects}>
            ← Retour aux projets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="learning-plan-container">
      {/* Toast Notification */}
      {showToast && (
        <div className={`toast-notification ${toastType}`}>
          <span className="toast-icon">
            {toastType === "success" ? "✓" : toastType === "info" ? "ℹ" : "⚠"}
          </span>
          <span className="toast-message">{toastMessage}</span>
        </div>
      )}

      {/* Bouton retour fixe en haut à gauche */}
      <button className="back-to-projects-fixed" onClick={handleBackToProjects} title="Retour aux projets">
        ←
      </button>

      {/* En-tête avec progression */}
      <div className="plan-header">
        <h1>📚 Plan d'apprentissage</h1>
       
        <div className="progress-section">
          <div className="progress-stats-top">
            <span className="stats-badge">
              🎯 {getCompletedStepsCount()} / {getTotalSteps()} étapes
            </span>
            <span className="stats-badge">
              📦 {modules.length} modules
            </span>
          </div>
          
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${globalProgress}%` }}
            >
              <span className="progress-text">{Math.round(globalProgress)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="modules-container">
        {modules.map((module, idx) => {
          const moduleProgress = getModuleProgress(module);
          const isExpanded = expandedModule === module.id;
          
          return (
            <div key={module.id || idx} className="module-card">
              <div 
                className="module-header"
                onClick={() => toggleModule(module.id)}
              >
                <div className="module-title-section">
                  <div className="module-icon">
                    {isExpanded ? "📖" : "📘"}
                  </div>
                  <div className="module-info">
                    <h3>Module {idx + 1}: {module.title}</h3>
                    {module.estimated_time && (
                      <span className="module-time">⏱️ {module.estimated_time}</span>
                    )}
                  </div>
                </div>
                
                <div className="module-stats">
                  <div className="mini-progress-container">
                    <div className="mini-progress">
                      <div className="mini-progress-fill" style={{ width: `${moduleProgress}%` }} />
                    </div>
                    <span className="module-progress-text">{Math.round(moduleProgress)}%</span>
                  </div>
                  <button className="expand-btn">
                    {isExpanded ? "▼" : "▶"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="module-content">
                  {module.description && (
                    <p className="module-description">{module.description}</p>
                  )}
                  
                  <div className="steps-container">
                    <h4 className="steps-title">📝 Étapes à réaliser</h4>
                    {module.steps && module.steps.length > 0 ? (
                      module.steps.map((step, stepIdx) => {
                        const isCompleted = completedSteps.has(step.id);
                        const isExpandedStep = expandedStep === step.id;
                        
                        return (
                          <div key={step.id || stepIdx} className={`step-item ${isCompleted ? "completed-step" : ""}`}>
                            <div className="step-header">
                              <div className="step-checkbox">
                                <input
                                  type="checkbox"
                                  checked={isCompleted}
                                  onChange={() => toggleStep(step.id)}
                                  id={`step_${step.id}`}
                                />
                                <label 
                                  htmlFor={`step_${step.id}`}
                                  className={isCompleted ? "completed" : ""}
                                >
                                  <span className="step-number">Étape {stepIdx + 1}</span>
                                  <span className="step-title">{step.title}</span>
                                </label>
                              </div>
                              <button 
                                className="step-details-btn"
                                onClick={() => toggleStepDetail(step.id)}
                              >
                                {isExpandedStep ? "▲ Masquer" : "▼ Voir détails"}
                              </button>
                            </div>
                            
                            {isExpandedStep && (
                              <div className="step-details">
                                {step.description && (
                                  <div className="detail-section">
                                    <h5>📋 Description</h5>
                                    <p>{step.description}</p>
                                  </div>
                                )}
                                
                                {/* Exemple concret */}
                                {step.concrete_example && (
                                  <div className="detail-section">
                                    <h5>💡 Exemple concret</h5>
                                    <pre className="concrete-example">
                                      {typeof step.concrete_example === 'object' 
                                        ? JSON.stringify(step.concrete_example, null, 2)
                                        : step.concrete_example}
                                    </pre>
                                  </div>
                                )}
                                
                                {/* Ressources - CORRIGÉ */}
                                {step.resources && step.resources.length > 0 && (
                                  <div className="detail-section">
                                    <h5>📖 Ressources</h5>
                                    <ul className="resources-list">
                                      {step.resources.map((resource, i) => renderResource(resource, i))}
                                    </ul>
                                  </div>
                                )}
                                
                                {/* Exercices - CORRIGÉ */}
                                {step.exercises && step.exercises.length > 0 && (
                                  <div className="detail-section">
                                    <h5>💪 Exercices</h5>
                                    <ul className="exercises-list">
                                      {step.exercises.map((exercise, i) => renderExercise(exercise, i))}
                                    </ul>
                                  </div>
                                )}

                                {/* Critère de validation */}
                                {step.validation_criteria && (
                                  <div className="detail-section">
                                    <h5>✅ Critère de validation</h5>
                                    <p className="validation-criteria">{step.validation_criteria}</p>
                                  </div>
                                )}

                                {/* Tips pour débutants */}
                                {step.tips && step.tips.length > 0 && (
                                  <div className="detail-section">
                                    <h5>💡 Astuces</h5>
                                    <ul className="tips-list">
                                      {step.tips.map((tip, i) => (
                                        <li key={i}>{tip}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="no-steps">Aucune étape détaillée pour ce module.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LearningPlan;