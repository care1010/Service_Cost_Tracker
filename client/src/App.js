import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import SummaryView from './pages/SummaryView';
import AddProject from './pages/AddProject';
import PtdAutomation from './pages/PtdAutomation'; // 🔥 YEH IMPORT MISSING THA
import AsblAutomation from './pages/AsblAutomation';
import Dashboard from './pages/Dashboard';

function App() {
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div className="flex bg-slate-50 min-h-screen">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 ml-64 p-8 bg-[#fcfcfd] min-h-screen overflow-x-hidden">
        
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            NI India <span className="text-blue-600">Cost Tracker</span>
          </h1>
        </div>

        {/* Dynamic Content */}
        {activeTab === 'summary' && <SummaryView />}
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