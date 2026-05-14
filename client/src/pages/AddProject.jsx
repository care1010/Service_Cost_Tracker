import React, { useState } from 'react';
import axios from 'axios';

const AddProject = () => {
    const [pasteData, setPasteData] = useState('');
    const [loading, setLoading] = useState(false);

    const handleDownloadTemplate = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/download-project-template`;
    };

    const handleProcess = async () => {
        if (!pasteData.trim()) return alert("Please paste Excel data first!");
        setLoading(true);
        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/process-project-paste`, { rawText: pasteData });
            alert(res.data.message);
            setPasteData('');
        } catch (err) {
            alert(err.response?.data?.error || "Failed to process data");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto relative">
            {loading && (
                <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm text-white">
                    <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                    <h2 className="text-xl font-black tracking-tight text-center">Processing Excel Data...<br/><span className="text-sm font-normal text-slate-400">Updating MySQL & Refreshing Dashboard</span></h2>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Add Project or WBS Addition in existing Project</h2>
                        <p className="text-slate-400 text-xs font-medium mt-1 uppercase tracking-widest">Copy the data as per the defined template & paste below to Add Project or WBS </p>
                    </div>
                    {/* EXPORT TEMPLATE BUTTON */}
                    <button 
                        onClick={handleDownloadTemplate}
                        className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-lg shadow-sky-100 flex items-center gap-2"
                    >
                        📥 Export Template
                    </button>
                </div>

                <div className="p-8">
                    <textarea
                        className="w-full h-80 p-6 rounded-[2rem] border border-slate-200 bg-slate-50 text-sm font-mono outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none shadow-inner"
                        placeholder="Paste Excel data here (Headers: BU, CT_Description, Customer_L05, Project/AMC, LOA_ID, LOA_Name, Project View, WBS1...)"
                        value={pasteData}
                        onChange={(e) => setPasteData(e.target.value)}
                    ></textarea>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-center gap-6">
                    <button 
                        onClick={handleProcess}
                        disabled={loading}
                        className="px-12 py-4 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-100 transition-all active:scale-95"
                    >
                        Save
                    </button>
                    <button onClick={() => setPasteData('')} className="bg-white text-slate-500 px-8 py-4 rounded-2xl font-bold text-sm border border-slate-200 hover:bg-slate-100 transition-all">
                        Clear
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddProject;