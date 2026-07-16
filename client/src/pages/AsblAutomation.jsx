import React, { useState, useEffect } from 'react';
import axios from 'axios';
import $ from 'jquery';
import 'select2';
import 'select2/dist/css/select2.min.css';
import './AsblAutomation.css';
import Swal from 'sweetalert2';

const AsblAutomation = () => {
    const [activeTab, setActiveTab] = useState('manual'); 
    const [loading, setLoading] = useState(false);
    const [loaOptions, setLoaOptions] = useState([]);
    const [selectedLoa, setSelectedLoa] = useState('');
    const [projectData, setProjectData] = useState([]);
    const [showAll, setShowAll] = useState(false);
    
    // 🔥 wbs_type initially empty
    const [selectedWbsType, setSelectedWbsType] = useState(''); 
    const [wbsOptions, setWbsOptions] = useState([]);
    const [selectedWbs, setSelectedWbs] = useState('All');

    const WBS_TYPES_MASTER = ["Project", "AMC", "Warranty/Other"];

    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_URL}/api/data/filter-options`).then(res => {
            if (res.data && res.data.loa_name) setLoaOptions(res.data.loa_name);
        });
    }, []);

    // Select2 Initialization with width control
    useEffect(() => {
        const selectEl = $('#loa-select');
        selectEl.select2({ 
            placeholder: "Search LOA Name...", 
            width: '100%', // Ye ab parent div (md:w-96) ki width lega
            allowClear: true 
        }).on('change', (e) => {
            setSelectedLoa(e.target.value);
            setSelectedWbs('All');
        });

        if (!selectedWbsType) {
            selectEl.prop('disabled', true); // Disable until type is selected
        } else {
            selectEl.prop('disabled', false);
        }

        return () => { if (selectEl.data('select2')) selectEl.select2('destroy'); };
    }, [loaOptions, activeTab, selectedWbsType]);

    useEffect(() => {
        if (selectedLoa && selectedWbsType) {
            setLoading(true);
            axios.get(`${process.env.REACT_APP_API_URL}/api/data/project-details`, {
                params: { loa_name: selectedLoa, wbs_type: selectedWbsType }
            }).then(res => {
                setProjectData(res.data.map(row => ({ ...row, original_asbl: row.asbl })));
                setLoading(false);
            }).catch(() => setLoading(false));

            if (activeTab === 'new_category') {
                axios.get(`${process.env.REACT_APP_API_URL}/api/data/project-wbs-options?loa_name=${selectedLoa}`)
                    .then(res => setWbsOptions(res.data || []));
            }
        } else {
            setProjectData([]);
        }
    }, [selectedLoa, selectedWbsType, activeTab]);

    const handleAsblChange = (index, newValue) => {
        const updatedData = [...projectData];
        updatedData[index].asbl = newValue;
        setProjectData(updatedData);
    };

    const handleManualSave = async () => {
        if (!selectedLoa || !selectedWbsType) return Swal.fire("Error", "Select Type and Project first.", "error");

        const changedRows = projectData.filter(row => Number(row.asbl) !== Number(row.original_asbl));
        if (changedRows.length === 0) return Swal.fire("Info", "No changes found.", "info");

        try {
            Swal.showLoading();
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/update-manual-asbl`, {
                loa_name: selectedLoa,
                wbs_type: selectedWbsType,
                updates: changedRows
            });
            
            // Re-fetch to confirm save
            const refresh = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/project-details`, {
                params: { loa_name: selectedLoa, wbs_type: selectedWbsType }
            });
            setProjectData(refresh.data.map(row => ({ ...row, original_asbl: row.asbl })));

            Swal.fire("Saved!", "ASBL updated in Summary and Dashboard.", "success");
        } catch (err) {
            Swal.fire("Error", "Save failed.", "error");
        }
    };

    const displayData = activeTab === 'new_category'
        ? projectData.filter(row => row.categories === 'New Category')
        : (showAll ? projectData : projectData.filter(row => Math.abs(row.asbl) > 0.01));

    return (
        <div className="p-6 bg-[#f8fafc] min-h-screen space-y-6">
            
            {/* TABS */}
            <div className="flex bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden max-w-2xl mx-auto">
                {['manual', 'new_category'].map(tab => (
                    <button key={tab} onClick={() => { setActiveTab(tab); setSelectedLoa(''); setSelectedWbsType(''); }}
                        className={`flex-1 py-3 font-black text-xs uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 bg-white'}`}>
                        {tab === 'manual' ? '✍️ Manual Update' : '🎯 New Category'}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-[2rem] shadow-sm p-8 border border-slate-100">
                <div className="flex flex-wrap items-end gap-4 mb-8">
                    
                    {/* 1. WBS Type */}
                    <div className="w-full md:w-56">
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-tighter">1. Select WBS Type</label>
                        <select
                            value={selectedWbsType}
                            onChange={(e) => { setSelectedWbsType(e.target.value); setSelectedLoa(''); }}
                            className="w-full bg-slate-50 border-2 border-blue-100 rounded-xl px-4 py-2 text-sm font-bold text-blue-700 outline-none focus:border-blue-500 transition-all"
                        >
                            <option value="">-- Choose Type --</option>
                            {WBS_TYPES_MASTER.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* 2. LOA Name (Select2) - Restricted Width */}
                    <div className="w-full md:w-96">
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-tighter">2. Project Description</label>
                        <div className="select2-container-wrapper">
                            <select id="loa-select">
                                <option value="">Select Project...</option>
                                {loaOptions.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <button onClick={() => setShowAll(!showAll)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold text-[10px] uppercase">
                            {showAll ? "📂 Active Only" : "📊 All Categories"}
                        </button>
                        <button onClick={handleManualSave} className="px-6 py-2 rounded-xl bg-emerald-500 text-white font-black text-[10px] uppercase shadow-lg shadow-emerald-100 hover:bg-emerald-600">
                            Save Changes
                        </button>
                    </div>
                </div>

                {/* TABLE AREA */}
                {loading ? (
                    <div className="py-20 text-center animate-pulse text-slate-300 font-black uppercase text-xs">Loading Data...</div>
                ) : projectData.length > 0 ? (
                    <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900 text-white">
                                <tr>
                                    <th className="p-4 uppercase text-[9px] tracking-widest">LOA ID</th>
                                    <th className="p-4 uppercase text-[9px] tracking-widest">Category</th>
                                    <th className="p-4 uppercase text-[9px] tracking-widest text-right">ASBL (KEUR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayData.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-50 hover:bg-blue-50/30 transition-all">
                                        <td className="p-4 font-black text-blue-900">{row.loa_id}</td>
                                        <td className="p-4 font-bold text-slate-600">{row.categories}</td>
                                        <td className="p-2 text-right">
                                            <input type="number" value={row.asbl}
                                                onChange={(e) => handleAsblChange(projectData.indexOf(row), e.target.value)}
                                                className="w-32 p-2 border border-slate-100 rounded-lg text-right font-mono font-bold text-blue-600 bg-slate-50 focus:bg-white focus:border-blue-400 outline-none"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-50/30 rounded-[2rem] border-2 border-dashed border-slate-100">
                        <p className="text-slate-400 font-bold text-sm">Please select WBS Type and Project to start editing</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AsblAutomation;