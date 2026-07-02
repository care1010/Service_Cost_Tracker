import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const AddProject = () => {
    // 🔥 Mode toggle: 'new' for adding new project, 'existing' for adding WBS to existing project
    const [mode, setMode] = useState('new'); 
    const [pasteData, setPasteData] = useState('');
    const [loading, setLoading] = useState(false);

    const handleDownloadTemplate = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/download-project-template`;
    };

    const handleProcess = async () => {
        if (!pasteData.trim()) {
            return Swal.fire({
                icon: 'warning',
                title: 'No Data Found',
                text: 'Please paste Excel data first!',
                confirmButtonColor: '#2563eb'
            });
        }

        // Show Native SweetAlert Loading Overlay
        Swal.fire({
            title: mode === 'new' ? 'Processing Excel Data...' : 'Adding WBS to Existing Project...',
            html: 'Updating the pasted data',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        setLoading(true);

        try {
            const res = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/process-project-paste`,
                { rawText: pasteData }
            );

            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: res.data.message,
                confirmButtonColor: '#16a34a'
            });

            setPasteData('');

        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Failed',
                text: err.response?.data?.error || 'Failed to process data',
                confirmButtonColor: '#dc2626'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto relative">

            <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                
                {/* 🔥 MODERN NAVIGATION TABS */}
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                    <button
                        onClick={() => { setMode('new'); setPasteData(''); }}
                        className={`flex-1 py-5 text-center font-black text-base border-b-4 transition-all duration-200 ${
                            mode === 'new' 
                                ? 'border-blue-600 text-blue-600 bg-white' 
                                : 'border-transparent text-slate-400 hover:text-slate-700'
                        }`}
                    >
                        🆕 Add New Project
                    </button>
                    <button
                        onClick={() => { setMode('existing'); setPasteData(''); }}
                        className={`flex-1 py-5 text-center font-black text-base border-b-4 transition-all duration-200 ${
                            mode === 'existing' 
                                ? 'border-blue-600 text-blue-600 bg-white' 
                                : 'border-transparent text-slate-400 hover:text-slate-700'
                        }`}
                    >
                        🔄 Add WBS in Existing LOA
                    </button>
                </div>

                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-600">
                            {mode === 'new' 
                                ? "Add Project (New LOA Entry)" 
                                : "Add WBS in Existing Project (LOA)"}
                        </h2>
                        <p className="text-orange-400 text-sm font-medium mt-1">
                            {mode === 'new'
                                ? "NOTE:- Copy the data as per the defined template & paste below to Add Project"
                                : "NOTE:- Paste the data containing existing LOA ID along with NEW WBS elements to automatically append them"}
                        </p>
                    </div>
                    {/* EXPORT TEMPLATE BUTTON */}
                    <button
                        onClick={handleDownloadTemplate}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl text-10px font-bold shadow-lg shadow-sky-100 flex items-center gap-2 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95"
                    >
                        📥 Export Template
                    </button>
                </div>

                <div className="p-8">
                    <textarea
                        className="w-full h-80 p-6 rounded-[2rem] border border-slate-200 bg-slate-50 text-sm font-mono outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none shadow-inner"
                        placeholder={
                            mode === 'new'
                                ? "Paste Excel data here (Headers: Business Division (BD), CT name (Reported Cust), Opportunity Code, Project Description, WBS Type, WBS, WBS Description, Merged)"
                                : "Paste Excel data with NEW WBS elements here (Headers: Business Division (BD), CT name (Reported Cust), Opportunity Code, Project Description, WBS Type, WBS, WBS Description, Merged)"
                        }
                        value={pasteData}
                        onChange={(e) => setPasteData(e.target.value)}
                    ></textarea>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-center gap-6">
                    {mode === 'new' ? (
                        <button
                            onClick={handleProcess}
                            disabled={loading}
                            className="px-12 py-4 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-100 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Save New Project
                        </button>
                    ) : (
                        <button
                            onClick={handleProcess}
                            disabled={loading}
                            className="px-12 py-4 rounded-2xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add WBS in Existing LOA
                        </button>
                    )}

                    <button
                        onClick={() => setPasteData('')}
                        className="px-8 py-4 rounded-2xl font-bold text-sm bg-slate-200 text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-700 shadow-sm transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95"
                    >
                        Clear
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddProject;