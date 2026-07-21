import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import $ from 'jquery';
import 'select2';
import 'select2/dist/css/select2.min.css';
import './AsblAutomation.css';
import Swal from 'sweetalert2';
import { HiOutlineRefresh, HiOutlineTrendingUp } from "react-icons/hi";

const AsblAutomation = ({ user }) => {
    const [loading, setLoading] = useState(false);
    const [selectedWbsType, setSelectedWbsType] = useState('');
    const [filteredProjects, setFilteredProjects] = useState([]); 
    const [selectedLoa, setSelectedLoa] = useState(''); 
    const [selectedLoaId, setSelectedLoaId] = useState(''); 
    const [projectData, setProjectData] = useState([]);

    const WBS_TYPES_MASTER = ["Project", "AMC", "Warranty/Other"];

    // Format customers for backend
    const customersStr = user?.allowedCustomers ? user.allowedCustomers.join(',') : '';
    console.log("User:", user);
console.log("Allowed Customers:", user?.allowedCustomers);
console.log("customersStr:", customersStr);

    const handleReset = () => {
        setSelectedWbsType('');
        setSelectedLoa('');
        setSelectedLoaId('');
        setProjectData([]);
        setFilteredProjects([]);
        $('#loa-name-select').val(null).trigger('change');
        $('#loa-id-select').val(null).trigger('change');
    };

    // 1. Fetch Projects List when WBS Type changes
    useEffect(() => {
        if (selectedWbsType) {
            axios.get(`${process.env.REACT_APP_API_URL}/api/data/filtered-projects`, {
                params: {
                    wbs_type: selectedWbsType,
                    type: user?.type || 'user',
                    allowedCustomers: customersStr
                }
            })
            .then(res => {
                const unique = Array.from(new Set(res.data.map(p => p.loa_id)))
                    .map(id => res.data.find(p => p.loa_id === id));
                setFilteredProjects(unique);
            })
            .catch(err => console.error("Filtered Projects Fetch Error:", err));
        } else {
            setFilteredProjects([]);
        }
        setSelectedLoa('');
        setSelectedLoaId('');
    }, [selectedWbsType, user, customersStr]);

    // 2. Select2 Initialization
    useEffect(() => {
        const setupSelect2 = (id, type) => {
            const el = $(id);
            el.select2({ 
                placeholder: `Select ${type}...`, 
                width: '100%', 
                allowClear: true,
                dropdownParent: el.parent(), 
                dropdownAutoWidth: false 
            }).on('change', (e) => {
                const val = e.target.value;
                if (!val) {
                    if (type === 'Name') setSelectedLoa(''); else setSelectedLoaId('');
                    return;
                }
                if (type === 'Name') {
                    const match = filteredProjects.find(p => p.loa_name === val);
                    if (match) {
                        setSelectedLoa(match.loa_name);
                        setSelectedLoaId(match.loa_id);
                        $('#loa-id-select').val(match.loa_id).trigger('change.select2');
                    }
                } else {
                    const match = filteredProjects.find(p => p.loa_id === val);
                    if (match) {
                        setSelectedLoaId(match.loa_id);
                        setSelectedLoa(match.loa_name);
                        $('#loa-name-select').val(match.loa_name).trigger('change.select2');
                    }
                }
            });
        };

        setupSelect2('#loa-name-select', 'Name');
        setupSelect2('#loa-id-select', 'ID');

        return () => {
            $('#loa-name-select').select2('destroy');
            $('#loa-id-select').select2('destroy');
        };
    }, [filteredProjects]);

    // 3. Fetch Categories Data
    useEffect(() => {
        if (selectedLoa && selectedWbsType) {
            setLoading(true);
            axios.get(`${process.env.REACT_APP_API_URL}/api/data/project-details`, {
                params: { 
                    loa_name: selectedLoa, 
                    wbs_type: selectedWbsType,
                    type: user?.type || 'user',
                    allowedCustomers: customersStr
                }
            }).then(res => {
                setProjectData(res.data.map(row => ({ ...row, original_asbl: row.asbl })));
                setLoading(false);
            }).catch(() => setLoading(false));
        }
    }, [selectedLoa, selectedWbsType, user, customersStr]);

    const totalAsbl = useMemo(() => {
        return projectData.reduce((sum, row) => sum + (parseFloat(row.asbl) || 0), 0);
    }, [projectData]);

    const handleAsblChange = (index, newValue) => {
        const updatedData = [...projectData];
        updatedData[index].asbl = newValue;
        setProjectData(updatedData);
    };

    const handleManualSave = async () => {
        if (!selectedLoa || !selectedWbsType) return;
        const changedRows = projectData.filter(row => Number(row.asbl) !== Number(row.original_asbl));
        try {
            Swal.fire({ title: 'Saving...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            await axios.post(`${process.env.REACT_APP_API_URL}/api/data/update-manual-asbl`, {
                loa_name: selectedLoa,
                wbs_type: selectedWbsType,
                updates: changedRows
            });
            setProjectData(projectData.map(r => ({ ...r, original_asbl: r.asbl })));
            Swal.fire("Saved!", "ASBL updated successfully.", "success");
        } catch (err) { Swal.fire("Error", "Failed to save", "error"); }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen space-y-6">
            <span className="inline-block mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-medium text-slate-700 leading-6">
                <strong className="text-amber-700">Note:</strong> Enter budget for the specific WBS Type selected. Total = All categories sum.
            </span>
            
            <div className="bg-white rounded-[2rem] shadow-sm p-8 border border-slate-100">
                <div className="flex flex-wrap items-end gap-4 mb-8">
                    {/* WBS Type */}
                    <div className="w-full md:w-40">
                        <label className="text-[12px] font-black text-slate-400 uppercase mb-2 block tracking-tighter">1. WBS Type</label>
                        <select value={selectedWbsType} onChange={(e) => setSelectedWbsType(e.target.value)}
                            className="w-full bg-slate-100 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-blue-600 outline-none">
                            <option value="">-- Choose --</option>
                            {WBS_TYPES_MASTER.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* LOA ID */}
                    <div className="w-full md:w-56 relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-tight">2. LOA ID</label>
                        <select id="loa-id-select" disabled={!selectedWbsType}>
                            <option value="">Select ID...</option>
                            {filteredProjects.map(p => <option key={`id-${p.loa_id}`} value={p.loa_id}>{p.loa_id}</option>)}
                        </select>
                    </div>

                    {/* Project Name */}
                    <div className="w-full md:w-96 relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-tight">3. Project Name</label>
                        <select id="loa-name-select" disabled={!selectedWbsType}>
                            <option value="">Select Name...</option>
                            {filteredProjects.map(p => <option key={`name-${p.loa_id}`} value={p.loa_name}>{p.loa_name}</option>)}
                        </select>
                    </div>

                    {/* KPI BOX */}
                    <div className="w-full md:w-48 bg-blue-600 rounded-2xl p-3 text-white shadow-lg flex items-center gap-3">
                        <HiOutlineTrendingUp className="text-2xl opacity-50" />
                        <div>
                            <p className="text-[11px] font-bold uppercase opacity-80 leading-tight">Project ASBL</p>
                            <p className="text-lg font-black leading-tight tabular-nums">{totalAsbl.toLocaleString()} <span className="text-[10px]">KEUR</span></p>
                        </div>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        <button onClick={handleReset} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-500 font-bold text-[13px] uppercase flex items-center gap-1 hover:bg-slate-200">
                            <HiOutlineRefresh /> Reset
                        </button>
                        <button onClick={handleManualSave} className="px-6 py-2 rounded-xl bg-emerald-500 text-white font-black text-[13px] uppercase shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all">
                            Save
                        </button>
                    </div>
                </div>

                {/* TABLE */}
                {loading ? (
                    <div className="py-20 text-center animate-pulse text-slate-300 font-black uppercase text-xs">Fetching authorizing data...</div>
                ) : projectData.length > 0 ? (
                    <div className="overflow-hidden rounded-3xl border border-slate-100">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest">
                                <tr>
                                    <th className="p-4">LOA ID</th>
                                    <th className="p-4">Category</th>
                                    <th className="p-4 text-right">ASBL (KEUR)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectData.map((row, i) => {
                                    const isHighlighted = row.categories === "Not to considered" || row.categories === "I&C Services + DD Resources";
                                    return (
                                        <tr key={i} className="border-b border-slate-50 hover:bg-blue-50/30 transition-all">
                                            <td className="p-4 font-black text-blue-900">{i === 0 ? row.loa_id : ""}</td>
                                            <td className="p-4 font-bold text-slate-600" style={isHighlighted ? { color: '#ef4444', fontSize: '15px' } : {}}>{row.categories}</td>
                                            <td className="p-2 text-right">
                                                <input type="number" value={row.asbl}
                                                    onChange={(e) => handleAsblChange(i, e.target.value)}
                                                    className="w-32 p-2 border border-slate-100 rounded-lg text-right font-mono font-bold text-blue-600 bg-slate-50 focus:bg-white focus:border-blue-400 outline-none"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-24 text-center text-slate-300 font-bold border-2 border-dashed rounded-3xl uppercase tracking-widest">
                        {selectedWbsType ? "No projects found for your account access." : "Select WBS Type to view projects"}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AsblAutomation;