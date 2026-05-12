import React, { useState } from 'react';
import './Sidebar.css';
import logo from '../assets/OIP.jpg';

// 🔥 FIX: Yahan brackets ke andar 'user' aur 'onLogout' add kiya
const Sidebar = ({ activeTab, setActiveTab, user, onLogout }) => {
  const [openMenu, setOpenMenu] = useState(false);

  const menuItems = [
    { id: 'summary', label: 'Summary View' },
    { id: 'add-project', label: '+ Add Project' },
    { id: 'ptd', label: 'PTD' },
    { id: 'asbl', label: 'ASBL' },
    { id: 'dashboard', label: 'Dashboard-Graph' },
  ];

  return (
    <div className="sidebar-container">
      
      {/* LOGO */}
      <div className="logo-section">
        <img src={logo} alt="Logo" className="logo-image" />
      </div>
      
      {/* MENU */}
      <nav className="nav-menu">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      
      {/* PROFILE SECTION */}
      <div className="profile-section">
        <div 
          className="profile-icon"
          onClick={() => setOpenMenu(!openMenu)}
        >
          <span className="user-icon">👤</span>
        </div>

        {openMenu && (
          <div className="profile-card">
            
            <div className="profile-header">
              {/* 🔥 Dynamic Avatar (Email ka pehla letter) */}
              <div className="avatar">{user?.email?.charAt(0).toUpperCase() || 'U'}</div>
              <div>
                {/* 🔥 Dynamic Email aur Role */}
                <div className="email">{user?.email || 'User'}</div>
                <div className="role">{user?.type?.toUpperCase() || 'GUEST'}</div>
              </div>
            </div>

            <div className="divider"></div>

            {/* Admin Panel sirf Admin/Super Admin ko dikhega */}
            {(user?.type === 'admin' || user?.type === 'super_admin') && (
              <div className="menu-item">🛠 Admin Panel</div>
            )}

            {/* 🔥 SIGN OUT BUTTON (onLogout function ab defined hai) */}
            <div className="menu-item" onClick={onLogout} style={{cursor: 'pointer'}}>
              🚪 Sign Out
            </div>

            <div className="cancel-btn" onClick={() => setOpenMenu(false)}>
              Cancel
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;