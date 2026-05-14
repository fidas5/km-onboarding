import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate
} from "react-router-dom";
import { FiLoader } from "react-icons/fi";

import ProjectSelector from "./Components/ProjectSelector";
import Chat from "./Components/Chat";
import Login from "./Components/Login";
import Register from "./Components/Register";
import ProfileForm from "./Components/ProfileForm";
import LearningPage from "./Components/LearningPage";
import ModulesInteractifs from "./Components/ModulesInteractifs";
import ResetPassword from "./Components/ResetPassword";
import LearningPlan from "./Components/LearningPlan";
import AdminDashboard from "./Components/AdminDashboard";

const styles = {
  loading: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '1.2rem',
    color: '#60a5fa',
    background: '#0f172a',
    gap: '1rem'
  }
};

// ✅ Fonction helper pour les requêtes authentifiées
const fetchWithAuth = async (url, token, options = {}) => {
  const defaultOptions = {
    headers: {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : "",
      ...options.headers,
    },
    ...options,
  };
  return fetch(url, defaultOptions);
};

function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  if (loading) return <div style={styles.loading}><FiLoader size={40} className="spin" /><p>Chargement...</p></div>;
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function AdminRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  if (loading) return <div style={styles.loading}><FiLoader size={40} className="spin" /><p>Chargement...</p></div>;
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (user.role !== "admin") {
    return <Navigate to="/projects" replace />;
  }
  
  return children;
}

// Projects Page
function ProjectsPage() {
  const navigate = useNavigate();

  const handleSelectProject = (proj) => {
    if (proj.action === "learn") {
      navigate("/profile", { state: { project: proj } });
    } else if (proj.action === "continue_learning") {
      navigate("/learning-plan", { 
        state: { 
          project: proj,
          learningPlan: proj.learningData?.learningPlan,
          pathId: proj.learningData?.pathId,
          savedProgress: proj.learningData?.completedSteps,
          savedStatus: proj.learningData?.status
        } 
      });
    } else {
      navigate("/chat", { state: { project: proj } });
    }
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <ProjectSelector
      setProject={handleSelectProject}
      logout={logout}
    />
  );
}

// Profile Page
function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const project = location.state?.project;

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    if (!project) {
      navigate("/projects");
    }
  }, [project, navigate]);

  const handleNext = (learningPlan, pathId) => {
    navigate("/learning-plan", { 
      state: { 
        project, 
        learningPlan,
        pathId,
        isNewPlan: true 
      } 
    });
  };

  const handleBack = () => {
    navigate("/projects");
  };

  if (!project || !user) return null;

  return (
    <ProfileForm
      project={project}
      user={user}
      onNext={handleNext}
      onBack={handleBack}
    />
  );
}

// Learning Plan Page
function LearningPlanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [learningData, setLearningData] = useState(null);
  const token = localStorage.getItem("token");
  
  const { project, learningPlan, pathId, savedProgress, savedStatus, isNewPlan } = location.state || {};

  const loadSavedLearningPlan = async () => {
    try {
      const userId = user?.id || user?.user_id;
      const response = await fetchWithAuth(
        `http://127.0.0.1:5000/get-learning-progress/${userId}/${project.name}`,
        token
      );
      const data = await response.json();
      
      if (data.exists) {
        setLearningData({
          learningPlan: data.learning_path,
          pathId: data.path_id,
          savedProgress: data.completed_steps,
          savedStatus: data.status,
          progressPercentage: data.progress_percentage
        });
      } else {
        navigate("/projects");
      }
    } catch (error) {
      console.error("Error loading learning plan:", error);
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    if (!project) {
      navigate("/projects");
      return;
    }
    
    if (!isNewPlan && !learningPlan) {
      const userId = user?.id || user?.user_id;
      if (userId) {
        loadSavedLearningPlan();
      }
    } else {
      setLearningData({ learningPlan, pathId, savedProgress, savedStatus });
      setLoading(false);
    }
  }, [project, learningPlan, isNewPlan, navigate, user]);

  const handleComplete = async () => {
    try {
      const userId = user?.id || user?.user_id;
      await fetchWithAuth("http://127.0.0.1:5000/update-learning-status", token, {
        method: "POST",
        body: JSON.stringify({
          user_id: userId,
          project: project.name,
          status: "completed"
        })
      });
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
    }
  };

  const handleContinueToChat = () => {
    navigate("/chat", { state: { project } });
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <FiLoader size={40} className="spin" />
        <p>Chargement de votre plan d'apprentissage...</p>
      </div>
    );
  }

  if (!learningData || !learningData.learningPlan || !user) {
    return (
      <div style={styles.loading}>
        <p>Aucun plan d'apprentissage trouvé</p>
        <button onClick={() => navigate("/projects")}>Retour aux projets</button>
      </div>
    );
  }

  return (
    <LearningPlan
      learningPlan={learningData.learningPlan}
      project={project.name}
      userId={user?.id || user?.user_id}
      pathId={learningData.pathId}
      initialCompletedSteps={learningData.savedProgress}
      initialStatus={learningData.savedStatus}
      onComplete={handleComplete}
      onContinue={handleContinueToChat}
    />
  );
}

// Learning Page
function LearningPageRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const { project, learningPath } = location.state || {};

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    if (!project || !learningPath) {
      navigate("/projects");
    }
  }, [project, learningPath, navigate]);

  const handleContinue = () => {
    navigate("/chat", { state: { project } });
  };

  const handleSkip = () => {
    navigate("/chat", { state: { project } });
  };

  if (!project || !learningPath || !user) return null;

  return (
    <LearningPage
      path={learningPath}
      user={user}
      project={project}
      onSkip={handleSkip}
      onContinue={handleContinue}
    />
  );
}

// Chat Page
// Chat Page - Version corrigée
function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const token = localStorage.getItem("token");
  
  const project = location.state?.project;

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    
    if (!project) {
      navigate("/projects");
      return;
    }
  }, [project, navigate]);

  // Charger les conversations avec authentification
  useEffect(() => {
    if (!project || !token) return;

    const loadConversations = async () => {
      try {
        console.log("Loading conversations for project:", project.name);
        
        const response = await fetch(`http://127.0.0.1:5000/chats/${project.name}`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log("Conversations loaded:", data);
          
          if (Array.isArray(data)) {
            const formatted = data.map((chat) => ({
              id: chat.id,
              title: chat.title || "New Chat",
              pinned: Boolean(chat.pinned),
              messages: chat.messages || []
            }));
            setConversations(formatted);
            if (formatted.length > 0) {
              setCurrentChatId(formatted[0].id);
            }
          } else {
            setConversations([]);
          }
        } else {
          console.error("Failed to load conversations:", response.status);
          setConversations([]);
        }
      } catch (error) {
        console.error("Error loading chats:", error);
        setConversations([]);
      }
    };

    loadConversations();
  }, [project, token]);

  // ✅ CORRECTION: Fonction handleNewChat qui crée un vrai chat
const handleNewChat = async () => {
  if (!project || !token) {
    console.error("No project or token");
    return null;  // ✅ Retourner null
  }
  
  try {
    const title = `Chat ${new Date().toLocaleString()}`;
    
    const response = await fetch("http://127.0.0.1:5000/chats", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        project: project.name, 
        title: title 
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to create chat:", errorData);
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.id) {
      const newChat = {
        id: data.id,
        title: title,
        messages: [],
        pinned: false,
      };
      
      setConversations((prev) => [newChat, ...(Array.isArray(prev) ? prev : [])]);
      setCurrentChatId(data.id);
      
      return data.id;  // ✅ Retourner l'ID
    }
    return null;
  } catch (error) {
    console.error("Error creating chat:", error);
    return null;
  }
};

  const addMessage = async (chatId, message) => {
    // Ajouter localement
    setConversations((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: [...chat.messages, message]
        };
      })
    );

    // Sauvegarder sur le serveur
    try {
      await fetch("http://127.0.0.1:5000/messages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          role: message.role,
          content: message.content
        })
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const handleBackToProjects = () => {
    navigate("/projects");
  };

  if (!project || !user) return null;

  return (
    <Chat
      project={project.name}
      setProject={handleBackToProjects}
      conversations={conversations}
      setConversations={setConversations}
      currentChatId={currentChatId}
      setCurrentChatId={setCurrentChatId}
      handleNewChat={handleNewChat}
      addMessage={addMessage}
      logout={handleLogout}
    />
  );
}

// Login Page
function LoginPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (savedUser && token) {
      const user = JSON.parse(savedUser);
      if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/projects");
      }
    }
  }, [navigate]);

  const handleSetUser = (userData) => {
    // ✅ Stocker correctement l'utilisateur avec id
    const userToStore = {
      id: userData.user_id || userData.id,
      user_id: userData.user_id || userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role
    };
    localStorage.setItem("user", JSON.stringify(userToStore));
    
    if (userData.role === "admin") {
      navigate("/admin");
    } else {
      navigate("/projects");
    }
  };

  return <Login setUser={handleSetUser} />;
}

function ResetPasswordPage() {
  return <ResetPassword />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/modules" element={<ModulesInteractifs />} />
        
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/projects" element={
          <ProtectedRoute>
            <ProjectsPage />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        } />
        <Route path="/learning-plan" element={
          <ProtectedRoute>
            <LearningPlanPage />
          </ProtectedRoute>
        } />
        <Route path="/learning" element={
          <ProtectedRoute>
            <LearningPageRoute />
          </ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />
        
        <Route path="/admin" element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;