import React, { useState, useEffect } from 'react';
import axios from 'axios';
import $ from 'jquery';
import 'select2';
import 'select2/dist/css/select2.min.css';

const AsblAutomation = () => {
    const [pasteData, setPasteData] = useState('');
    const [loading, setLoading] = useState(false);
    const [loaOptions, setLoaOptions] = useState([]);
    const [selectedLoa, setSelectedLoa] = useState('');
    const [projectData, setProjectData] = useState([]);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        axios.get('http://localhost:5000/api/data/filter-options').then(res => {
            if (res.data && res.data.loa_id) setLoaOptions(res.data.loa_id);
        });
    }, []);

    useEffect(() => {
        const selectEl = $('#loa-select');
        selectEl.select2({ placeholder: "Search LOA ID...", width: '100%', allowClear: true })
            .on('change', (e) => setSelectedLoa(e.target.value));
    }, [loaOptions]);

    useEffect(() => {
        if (selectedLoa) {
            axios.get(`http://localhost:5000/api/data/project-details?loa_id=${selectedLoa}`)
                .then(res => setProjectData(res.data));
        } else {
            setProjectData([]);
        }
    }, [selectedLoa]);

    const handleAsblChange = (index, newValue) => {
        const updatedData = [...projectData];
        updatedData[index].asbl = newValue;
        setProjectData(updatedData);
    };

    // 🔥 RESTORED: Template Download Function
    const handleDownloadTemplate = () => {
        window.location.href = 'http://localhost:5000/api/data/download-asbl-template';
    };

    const handleManualSave = async () => {
    if (!selectedLoa) return alert("Please select a project first");
    
    setLoading(true);
    try {
        const res = await axios.post('http://localhost:5000/api/data/update-manual-asbl', {
            loa_id: selectedLoa,
            updates: projectData // Saari rows bhej rahe hain
        });
        
        alert(res.data.message);
        
        // 🔥 Refresh local table data to confirm sync
        const refresh = await axios.get(`http://localhost:5000/api/data/project-details?loa_id=${selectedLoa}`);
        setProjectData(refresh.data);
        
    } catch (err) {
        alert("Save failed: " + (err.response?.data?.error || "Server Error"));
    } finally {
        setLoading(false);
    }
};

    const handleBulkUpdate = async () => {
        if (!pasteData.trim()) return alert("Paste data first!");
        setLoading(true);
        try {
            const res = await axios.post('http://localhost:5000/api/data/process-asbl-update', { rawText: pasteData });
            alert(res.data.message);
            setPasteData('');
            if (selectedLoa) {
                const refresh = await axios.get(`http://localhost:5000/api/data/project-details?loa_id=${selectedLoa}`);
                setProjectData(refresh.data);
            }
        } catch (err) { alert(err.response?.data?.error || "Update failed"); }
        finally { setLoading(false); }
    };

    // 🔥 Filter logic for Toggle
    const displayData = showAll ? projectData : projectData.filter(row => Math.abs(row.asbl) > 0.01);

    return (
        <div className="p-6 bg-[#f8fafc] min-h-screen space-y-6 text-slate-800">
            {loading && (
                <div className="fixed inset-0 z-[2000] bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                    <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="font-bold">Processing Data...</p>
                </div>
            )}

            {/* SECTION 1: PASTE AREA */}
            <div className="bg-white rounded-[2rem] shadow-lg p-6 border border-slate-100">
                <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                    <span className="w-2 h-5 bg-emerald-500 rounded-full"></span>
                    ASBL Bulk Paste
                </h2>

                <button 
                        onClick={handleDownloadTemplate}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2"
                    >
                        📥 Export ASBL Template
                    </button>

                <textarea className="w-full h-32 p-4 rounded-2xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Paste from Excel..." value={pasteData} onChange={(e) => setPasteData(e.target.value)}></textarea>
                <button onClick={handleBulkUpdate} className="mt-4 bg-emerald-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg hover:bg-emerald-700 transition-all">🚀 Process Paste</button>
                
            </div>

            {/* SECTION 2: EDITABLE MATRIX */}
            <div className="bg-white rounded-[2rem] shadow-lg p-8 border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    <div className="w-full md:w-1/3">
                        <select id="loa-select" className="select2-dropdown">
                            <option value="">Select Project...</option>
                            {loaOptions.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                    </div>
                    
                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                        <button onClick={() => setShowAll(!showAll)} className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${showAll ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>
                            {showAll ? "Showing All 54" : "Showing Active Only"}
                        </button>
                        {projectData.length > 0 && (
                            <button onClick={handleManualSave} className="bg-slate-800 text-white px-6 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-black transition-all">
                                💾 Save Changes
                            </button>
                        )}
                    </div>
                </div>

                {displayData.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="bg-slate-800 text-white uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 font-bold border-r border-slate-700">LOA ID / Name</th>
                                    <th className="p-4 font-bold border-r border-slate-700">Cost/Revenue</th>
                                    <th className="p-4 font-bold border-r border-slate-700">Category</th>
                                    <th className="p-4 text-right w-40">ASBL (Editable)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayData.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors">
                                        {/* 🔥 METADATA LOGIC: Hamesha pehli visible row mein dikhega */}
                                        <td className="p-4 font-black text-blue-900 bg-slate-50/50 border-r border-slate-100">
                                            {i === 0 ? `${row.loa_id} - ${row.loa_name}` : ""}
                                        </td>
                                        <td className="p-4 font-bold text-slate-500 border-r border-slate-100">
                                            {i === 0 || row.cost_revenue !== displayData[i-1].cost_revenue ? row.cost_revenue : ""}
                                        </td>
                                        <td className="p-4 text-slate-600 font-medium border-r border-slate-100">{row.categories}</td>
                                        <td className="p-2 text-right bg-white">
                                            <input 
                                                type="number" 
                                                step="0.01" // 🔥 Decimal support
                                                value={row.asbl} 
                                                onChange={(e) => handleAsblChange(projectData.indexOf(row), e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-right font-mono font-bold text-blue-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-24 text-slate-300 italic border-2 border-dashed border-slate-100 rounded-[2rem]">
                        Select a project to view and edit ASBL values
                    </div>
                )}
            </div>
        </div>
    );
};

export default AsblAutomation;