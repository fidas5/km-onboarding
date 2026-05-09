import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FiUsers, FiMail, FiFolder, FiMessageCircle, FiUserPlus, 
  FiEdit2, FiTrash2, FiPower, FiX, FiCheck, FiAlertCircle,
  FiUserCheck, FiUserX, FiLogOut
} from "react-icons/fi";
import { FaUserShield } from "react-icons/fa";
import "./AdminDashboard.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [stats, setStats] = useState({});
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("employees");
  const [adminUser, setAdminUser] = useState(null);

  const token = localStorage.getItem("token");

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 3000);
  };

  const loadEmployees = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/admin/employees", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const loadPendingInvitations = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/admin/pending-invitations", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setPendingInvitations(data);
    } catch (error) {
      console.error("Error loading invitations:", error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/admin/stats", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role !== "admin") {
      navigate("/projects");
      return;
    }
    setAdminUser(user);
    loadEmployees();
    loadPendingInvitations();
    loadStats();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail) {
      showToast("Veuillez entrer un email", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      showToast("Email invalide", "error");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:5000/admin/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail })
      });

      const data = await response.json();

      if (response.ok) {
        showToast(`Invitation envoyée à ${inviteEmail}`, "success");
        setInviteEmail("");
        setShowInviteModal(false);
        loadPendingInvitations();
        loadStats();
      } else {
        showToast(data.error, "error");
      }
    } catch (error) {
      showToast("Erreur lors de l'envoi", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (employee) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/admin/employees/${employee.id}/toggle`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        showToast(data.message, "success");
        loadEmployees();
        loadStats();
      }
    } catch (error) {
      showToast("Erreur", "error");
    }
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    
    try {
      const response = await fetch(`http://127.0.0.1:5000/admin/employees/${employeeToDelete.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (response.ok) {
        showToast("Employé supprimé", "success");
        loadEmployees();
        loadStats();
        setShowDeleteConfirm(false);
        setEmployeeToDelete(null);
      }
    } catch (error) {
      showToast("Erreur", "error");
    }
  };

  const handleCancelInvitation = async (invitation) => {
    if (window.confirm(`Annuler l'invitation pour ${invitation.email} ?`)) {
      try {
        const response = await fetch(`http://127.0.0.1:5000/admin/cancel-invitation/${invitation.id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (response.ok) {
          showToast("Invitation annulée", "success");
          loadPendingInvitations();
          loadStats();
        }
      } catch (error) {
        showToast("Erreur", "error");
      }
    }
  };

  const handleEditEmployee = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/admin/employees/${selectedEmployee.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: editName, email: editEmail })
      });
      
      if (response.ok) {
        showToast("Employé modifié", "success");
        setShowEditModal(false);
        loadEmployees();
      } else {
        const error = await response.json();
        showToast(error.error, "error");
      }
    } catch (error) {
      showToast("Erreur", "error");
    }
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setEditName(employee.name);
    setEditEmail(employee.email);
    setShowEditModal(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="admin-dashboard">
      {toast.show && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === "success" ? <FiCheck /> : <FiAlertCircle />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="admin-header">
        <div className="admin-logo">
          <FaUserShield size={28} color="#6366f1" />
          <h1>Administration</h1>
          <span className="admin-badge">AI-Onboarding2</span>
        </div>
        <div className="admin-actions">
          <div className="admin-user">
            <div className="admin-avatar">{adminUser?.name?.charAt(0) || "A"}</div>
            <span className="admin-name">{adminUser?.name || "Admin"}</span>
          </div>
          <button className="logout-btn-admin" onClick={handleLogout}>
            <FiLogOut /> Déconnexion
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><FiUsers /></div>
          <div className="stat-info">
            <h3>{stats.active_employees || 0}</h3>
            <p>Employés actifs</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FiMail /></div>
          <div className="stat-info">
            <h3>{stats.pending_invitations || 0}</h3>
            <p>Invitations en attente</p>
          </div>
        </div>
    
      </div>

      <div className="admin-tabs">
        <button 
          className={`tab-btn ${activeTab === "employees" ? "active" : ""}`}
          onClick={() => setActiveTab("employees")}
        >
          <FiUsers /> Employés
        </button>
        <button 
          className={`tab-btn ${activeTab === "invitations" ? "active" : ""}`}
          onClick={() => setActiveTab("invitations")}
        >
          <FiMail /> Invitations en attente
        </button>
      </div>

      {activeTab === "employees" && (
        <div className="admin-section">
          <div className="section-header">
            <h2>Gestion des employés</h2>
            <button className="invite-btn" onClick={() => setShowInviteModal(true)}>
              <FiUserPlus /> Inviter un employé
            </button>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Statut</th>
                  <th>Invité par</th>
                  <th>Date d'inscription</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-row">Aucun employé</td>
                  </tr>
                ) : (
                  employees.map(emp => (
                    <tr key={emp.id} className={!emp.is_active ? "inactive-row" : ""}>
                      <td>{emp.name || "-"}</td>
                      <td>{emp.email}</td>
                      <td>
                        <span className={`status-badge ${emp.is_active ? "active" : "inactive"}`}>
                          {emp.is_active ? <FiUserCheck /> : <FiUserX />}
                          {emp.is_active ? " Actif" : " Inactif"}
                        </span>
                      </td>
                      <td>{emp.invited_by_name || "-"}</td>
                      <td>{formatDate(emp.created_at)}</td>
                      <td className="action-buttons">
                        <button className="action-icon edit" onClick={() => openEditModal(emp)} title="Modifier">
                          <FiEdit2 />
                        </button>
                        <button className="action-icon toggle" onClick={() => handleToggleStatus(emp)} title={emp.is_active ? "Désactiver" : "Activer"}>
                          <FiPower />
                        </button>
                        <button className="action-icon delete" onClick={() => {
                          setEmployeeToDelete(emp);
                          setShowDeleteConfirm(true);
                        }} title="Supprimer">
                          <FiTrash2 />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "invitations" && (
        <div className="admin-section">
          <div className="section-header">
            <h2>Invitations en attente</h2>
            <button className="invite-btn" onClick={() => setShowInviteModal(true)}>
              <FiUserPlus /> Nouvelle invitation
            </button>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Invité par</th>
                  <th>Date d'envoi</th>
                  <th>Expire le</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-row">Aucune invitation en attente</td>
                  </tr>
                ) : (
                  pendingInvitations.map(inv => (
                    <tr key={inv.id}>
                      <td><FiMail /> {inv.email}</td>
                      <td>{inv.invited_by_name || "-"}</td>
                      <td>{formatDate(inv.created_at)}</td>
                      <td>{formatDate(inv.invitation_expires)}</td>
                      <td className="action-buttons">
                        <button className="action-icon delete" onClick={() => handleCancelInvitation(inv)} title="Annuler l'invitation">
                          <FiX /> Annuler
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="admin-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiUserPlus /> Inviter un employé</h2>
              <button className="modal-close" onClick={() => setShowInviteModal(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p>L'employé recevra un email avec un lien pour créer son compte.</p>
              <input
                type="email"
                placeholder="Email de l'employé"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="modal-input"
                autoFocus
              />
              <div className="modal-info">
                <span className="info-icon">ℹ️</span>
                <span>Un email sera envoyé avec un lien d'invitation valable 7 jours.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowInviteModal(false)}>Annuler</button>
              <button className="btn-submit" onClick={handleInvite} disabled={isLoading}>
                {isLoading ? "Envoi..." : <><FiMail /> Envoyer l'invitation</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="admin-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiEdit2 /> Modifier l'employé</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Nom"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="modal-input"
              />
              <input
                type="email"
                placeholder="Email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="modal-input"
              />
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Annuler</button>
              <button className="btn-submit" onClick={handleEditEmployee}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="admin-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="admin-modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiAlertCircle /> Confirmer la suppression</h2>
            </div>
            <div className="modal-body">
              <p>Êtes-vous sûr de vouloir supprimer <strong>{employeeToDelete?.name}</strong> ?</p>
              <p className="warning-text">Cette action est irréversible !</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Annuler</button>
              <button className="btn-delete" onClick={handleDeleteEmployee}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;