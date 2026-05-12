import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import SummaryView from './pages/SummaryView';
import AddProject from './pages/AddProject';
import PtdAutomation from './pages/PtdAutomation';
import AsblAutomation from './pages/AsblAutomation';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');

  // Check if user is already logged in
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

const handleLogout = () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      localStorage.removeItem('user'); // Browser se data hataya
      setUser(null); // State null ki (Isse automatic Login page aa jayega)
    }
  };

  if (!user) {
    return <Login onLoginSuccess={(userData) => setUser(userData)} />;
  }

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        onLogout={handleLogout} 
      />

      <main className="flex-1 ml-64 p-8 bg-[#fcfcfd] min-h-screen overflow-x-hidden">
        
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Financial Services <span className="text-blue-600">Cost Tracker Platform</span>
          </h1>
        </div>

        {/* Dynamic Content */}
        {activeTab === 'summary' && <SummaryView user={user} />}
        {activeTab === 'add-project' && <AddProject />}
        {activeTab === 'ptd' && <PtdAutomation />}
        {activeTab === 'asbl' && <AsblAutomation />}
        {activeTab === 'dashboard' && <Dashboard />}


        {/* Sirf un tabs ke liye jo abhi nahi bane hain */}
        {['ftc'].includes(activeTab) && (
          <div className="bg-white p-20 rounded-xl shadow text-center border-2 border-dashed border-gray-200">
            <div className="text-5xl mb-4 text-gray-300">🏗️</div>
            <h2 className="text-xl font-bold text-gray-700 capitalize">{activeTab} Page</h2>
            <p className="text-gray-400 mt-2">This module is under development.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;