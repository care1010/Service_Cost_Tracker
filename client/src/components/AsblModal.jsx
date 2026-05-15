import React, { useState } from 'react';
import { HiOutlineDocumentDownload } from "react-icons/hi";

const AsblModal = ({ isOpen, onClose, onSubmit }) => {
    const [pasteData, setPasteData] = useState('');

    if (!isOpen) return null;

    const handleDownloadTemplate = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/download-template`;
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Paste Your Excel Data Here</h2>
                    <button
                        onClick={handleDownloadTemplate}
                        className="group text-white px-4 py-2 rounded-2xl shadow-md 
                        flex items-center gap-2 transition-all duration-300 
                        hover:scale-105 hover:shadow-xl ml-4"
                        style={{
                            background: 'linear-gradient(135deg, #4169e1, #3157c9)',
                        }}
                    >
                        <span className="text-lg transition-transform duration-300 group-hover:-translate-y-[1px]">
                            <HiOutlineDocumentDownload />
                        </span>

                        <span className="text-sm font-black">
                            Export Template
                        </span>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex-1">
                    <p className="text-slate-400 text-xs mb-4 font-medium">
                        Copy the entire table data (including headers if applicable) from Excel and paste it below.
                    </p>
                    <textarea
                        className="w-full h-64 p-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                        placeholder="Paste data from Excel here..."
                        value={pasteData}
                        onChange={(e) => setPasteData(e.target.value)}
                    ></textarea>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-center gap-4">
                    <button 
                        onClick={() => onSubmit(pasteData)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-100 transition-all"
                    >
                        Process Data
                    </button>
                    <button 
                        onClick={onClose}
                        className="bg-rose-500 hover:bg-rose-600 text-white px-10 py-2.5 rounded-2xl font-bold text-sm shadow-lg shadow-rose-100 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AsblModal;