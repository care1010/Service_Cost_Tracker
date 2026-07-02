import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const AddProject = () => {
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

        setLoading(true);

        try {

            const res = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/process-project-paste`,
                { rawText: pasteData }
            );

            await Swal.fire({
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
            {loading && (
                <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm text-white">
                    <div className="w-20 h-20 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
                    <h2 className="text-xl font-black tracking-tight text-center">Processing Excel Data...<br/><span className="text-sm font-normal text-slate-400">Updating MySQL & Refreshing Dashboard</span></h2>
                </div>
            )}

            <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-600">Add Project or WBS Addition in existing Project</h2>
                        <br></br>
                        <p className="text-orange-400 text-sm font-medium mt-1">NOTE:- Copy the data as per the defined template & paste below to Add Project or WBS </p>
                    </div>
                    {/* EXPORT TEMPLATE BUTTON */}
                    <button
                        onClick={handleDownloadTemplate}
                        className="bg-blue-600 hover:bg-blue-600 text-white px-6 py-2.5 rounded-2xl text-10px font-bold shadow-lg shadow-sky-100 flex items-center gap-2 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95"
                    >
                        📥 Export Template
                    </button>
                </div>

                <div className="p-8">
                    <textarea
                        className="w-full h-80 p-6 rounded-[2rem] border border-slate-200 bg-slate-50 text-sm font-mono outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none shadow-inner"
                        placeholder="Paste Excel data here (Headers: BU, CT_Description, LOA_ID, project_description, wbs_type, wbs, LOA_Name, Project View, WBS1...)"
                        value={pasteData}
                        onChange={(e) => setPasteData(e.target.value)}
                    ></textarea>
                </div>

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-center gap-6">

                    <button
                        onClick={handleProcess}
                        disabled={loading}
                        className="px-12 py-4 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-100 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add Project in Exiting Loa 
                    </button>

                    <button
                        onClick={handleProcess}
                        disabled={loading}
                        className="px-12 py-4 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-100 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save
                    </button>

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