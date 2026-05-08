import React, { useState } from 'react';
import './Sidebar.css';
import logo from '../assets/OIP.jpg';

const Sidebar = ({ activeTab, setActiveTab }) => {
const [openMenu, setOpenMenu] = useState(false);

  const menuItems = [
    { id: 'summary', label: 'Summary View' },
    { id: 'add-project', label: 'Add Project' },
    { id: 'ptd', label: 'PTD' },
    { id: 'asbl', label: 'ASBL' },
    { id: 'dashboard', label: 'Dashboard' },
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
        <div className="avatar">N</div>
        <div>
          <div className="email">neha.sain.ext@nokia.com</div>
          <div className="role">SUPER ADMIN</div>
        </div>
      </div>

      <div className="divider"></div>

      <div className="menu-item">🛠 Admin Panel</div>
      <div className="menu-item">🚪 Sign Out</div>

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