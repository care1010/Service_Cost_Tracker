import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'; // 🔥 useNavigate add kiya
import Sidebar from './components/Sidebar';
import SummaryView from './pages/SummaryView';
import AddProject from './pages/AddProject';
import PtdAutomation from './pages/PtdAutomation';
import AsblAutomation from './pages/AsblAutomation';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import DrillDownPage from './pages/DrillDownPage';
import MyAccess from './pages/MyAccess';
import Logs from './pages/Logs';
import ERPResource from './pages/ERPResource';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const location = useLocation(); 

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  // 🔥 Role Protection: Agar role 'user' hai, to galti se bhi admin page open nahi ho sakega
    useEffect(() => {
      if (user) {
        if (user.type === 'user' && activeTab === 'admin') {
          setActiveTab('summary');
        }
      }
    }, [activeTab, user]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('summary');
  };

  // Jab login success ho, tab user set karne ke sath-sath activeTab ko 'summary' par redirect karein
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setActiveTab('summary'); 
  };

  if (!user) {
    return <Login onLoginSuccess={(userData) => setUser(userData)} />;
  }

  // 🔥 Logic: Agar URL '/drilldown' hai, toh main tabs chhupa do
  const isDrillDown = location.pathname === '/drilldown';

  return (
    <div className="flex bg-slate-50 min-h-screen">
      {!isDrillDown && (
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={handleLogout} />
      )}

      <main className={`flex-1 ${isDrillDown ? 'ml-0' : ''} p-8 bg-[#fcfcfd] min-h-screen overflow-x-hidden`}
        style={!isDrillDown ? { marginLeft: '130px', width: "calc(100vw - 130px)" } : {}}>
        
        {!isDrillDown && (
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                    Financial Services <span className="text-blue-600">Cost Tracker Platform</span>
                </h1>
            </div>
        )}

        <Routes>
          {/* Main Tabs Logic */}
          <Route path="/" element={
            <>
              {activeTab === 'summary' && <SummaryView user={user} />}
              {activeTab === 'add-project' && <AddProject user={user} />}
              {activeTab === 'ptd' && <PtdAutomation />}
              {activeTab === 'asbl' && <AsblAutomation user={user} />}
              {activeTab === 'dashboard' && <Dashboard user={user} />}
              {activeTab === 'erp_resource' && <ERPResource />}
              {/* 🔥 Sirf admin ya super_admin hi is component ko load kar payenge */}
              {activeTab === 'admin' && (user?.type === 'super_admin' || user?.type === 'admin') && (
                <AdminPanel user={user} onBack={() => setActiveTab('summary')} />
              )}
              {activeTab === 'my-access' && (<MyAccess user={user} /> )}
              {activeTab === 'logs' && (<Logs /> )}
              
              {/* Under Development Placeholder */}
              {['ftc'].includes(activeTab) && (
                <div className="bg-white p-20 rounded-xl shadow text-center border-2 border-dashed border-gray-200">
                  <h2 className="text-xl font-bold text-gray-700 capitalize">{activeTab} Page</h2>
                  <p className="text-gray-400 mt-2">This module is under development.</p>
                </div>
              )}
            </>
          } />

          {/* 🔥 Drilldown Route (Alag se) */}
          <Route path="/drilldown" element={<DrillDownPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;