import React, { useState } from 'react';
import axios from 'axios';

const AddProjectAutomation = () => {
    const [pasteData, setPasteData] = useState('');
    const [loading, setLoading] = useState(false);

    const handleProcess = async () => {
        if (!pasteData.trim()) return alert("Please paste data from Excel first!");

        setLoading(true);
        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/add-project-automation`, {
                rawData: pasteData
            });
            alert(res.data.message);
            setPasteData('');
        } catch (err) {
            alert("Error: " + (err.response?.data?.error || "Failed to process data"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto mt-10 p-8 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Add New Project</h2>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Excel Copy-Paste Automation</p>
                </div>
                <div className="bg-blue-50 text-blue-600 p-3 rounded-2xl text-2xl">🚀</div>
            </div>

            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-sky-400 rounded-[2rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                <textarea
                    className="relative w-full h-80 p-6 rounded-[2rem] border border-slate-200 bg-slate-50/50 text-sm font-mono outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
                    placeholder="Copy rows from Excel (including headers) and paste them here..."
                    value={pasteData}
                    onChange={(e) => setPasteData(e.target.value)}
                ></textarea>
            </div>

            <div className="flex justify-center gap-4 mt-8">
                <button 
                    onClick={handleProcess}
                    disabled={loading}
                    className={`px-12 py-4 rounded-2xl font-bold text-white shadow-xl transition-all ${loading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 shadow-blue-100'}`}
                >
                    {loading ? "Processing..." : "Confirm & Save Project"}
                </button>
                <button 
                    onClick={() => setPasteData('')}
                    className="px-12 py-4 rounded-2xl font-bold text-slate-400 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                    Clear
                </button>
            </div>

            <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-amber-700 text-[11px] leading-relaxed">
                    <strong>Note:</strong> Ensure your Excel columns match: <code className="bg-white px-1 rounded">BU</code>, <code className="bg-white px-1 rounded">CT_Description</code>, <code className="bg-white px-1 rounded">LOA_ID</code>, <code className="bg-white px-1 rounded">LOA_Name</code>, and <code className="bg-white px-1 rounded">WBS1...WBS10</code>.
                </p>
            </div>
        </div>
    );
};

export default AddProjectAutomation;