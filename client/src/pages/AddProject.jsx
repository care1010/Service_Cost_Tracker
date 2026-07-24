import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const AddProject = () => {
    const [mode, setMode] = useState('new'); 
    const [inputMethod, setInputMethod] = useState('paste'); // 🔥 'paste' or 'file' input method toggle
    const [pasteData, setPasteData] = useState('');
    const [selectedFile, setSelectedFile] = useState(null); // 🔥 For selected file storage
    const [loading, setLoading] = useState(false);

    const handleDownloadTemplate = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/download-project-template`;
    };

    const handleFileSelect = (e) => {
        setSelectedFile(e.target.files[0]);
    };

    const handleProcess = async () => {
        if (inputMethod === 'paste') {
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
                html: 'Updating MySQL & Refreshing Dashboard',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            setLoading(true);

            try {
                const res = await axios.post(
                    `${process.env.REACT_APP_API_URL}/api/data/process-project-paste`,
                    { rawText: pasteData, mode } // 🔥 'mode' parameter pass kiya
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
        } else {
            // 🔥 FILE UPLOAD METHOD
            if (!selectedFile) {
                return Swal.fire({
                    icon: 'warning',
                    title: 'No File Selected',
                    text: 'Please select an Excel file first!',
                    confirmButtonColor: '#2563eb'
                });
            }

            Swal.fire({
                title: mode === 'new' ? 'Processing Excel File...' : 'Adding WBS to Existing Project...',
                html: 'Uploading and parsing Excel dataset',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            setLoading(true);

            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('mode', mode); // 🔥 'mode' form data mein append kiya

            try {
                const res = await axios.post(
                    `${process.env.REACT_APP_API_URL}/api/data/upload-project-file`,
                    formData,
                    {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );

                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: res.data.message,
                    confirmButtonColor: '#16a34a'
                });

                setSelectedFile(null);

            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'Failed',
                    text: err.response?.data?.error || 'Failed to upload and process file',
                    confirmButtonColor: '#dc2626'
                });
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="p-8 max-w-5xl mx-auto relative">
            <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
                
                {/* MODERN NAVIGATION TABS */}
                <div className="flex border-b border-slate-100 bg-slate-50/50">
                    <button
                        onClick={() => { setMode('new'); setPasteData(''); setSelectedFile(null); }}
                        className={`flex-1 py-5 text-center font-black text-base border-b-4 transition-all duration-200 ${
                            mode === 'new' 
                                ? 'border-blue-600 text-blue-600 bg-white' 
                                : 'border-transparent text-slate-400 hover:text-slate-700'
                        }`}
                    >
                        🆕 Add New Project
                    </button>
                    <button
                        onClick={() => { setMode('existing'); setPasteData(''); setSelectedFile(null); }}
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
                                ? "NOTE:- Upload the template file or copy-paste data to Add Project"
                                : "NOTE:- Upload the file or copy-paste containing existing LOA ID to automatically append WBS"}
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

                {/* Input Method Toggle Selector */}
                <div className="px-8 pt-6 flex gap-6 justify-center">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-600 select-none">
                        <input
                            type="radio"
                            name="inputMethod"
                            value="paste"
                            checked={inputMethod === 'paste'}
                            onChange={() => setInputMethod('paste')}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        📝 Paste Excel Data
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-sm text-slate-600 select-none">
                        <input
                            type="radio"
                            name="inputMethod"
                            value="file"
                            checked={inputMethod === 'file'}
                            onChange={() => setInputMethod('file')}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        📁 Upload Excel File
                    </label>
                </div>

                <div className="p-8">
                    {inputMethod === 'paste' ? (
                        /* Textarea view */
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
                    ) : (
                        /* Styled Upload Dropzone View */
                        <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-[2rem] p-10 transition-all bg-slate-50/50 flex flex-col items-center justify-center gap-3 cursor-pointer relative h-80">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleFileSelect}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span className="text-sm font-bold text-blue-600">Click or drag & drop template file here</span>
                            <span className="text-xs text-slate-400">Supported formats: .xlsx, .xls</span>
                            
                            {selectedFile && (
                                <div className="mt-4 px-4 py-2 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-2">
                                    <span className="text-xs font-bold text-blue-800">{selectedFile.name}</span>
                                </div>
                            )}
                        </div>
                    )}
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
                        onClick={() => { setPasteData(''); setSelectedFile(null); }}
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