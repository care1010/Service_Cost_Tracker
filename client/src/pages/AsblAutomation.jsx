import React, { useState, useEffect } from 'react';
import axios from 'axios';
import $ from 'jquery';
import 'select2';
import 'select2/dist/css/select2.min.css';
import { HiOutlineDocumentDownload } from "react-icons/hi";
import './AsblAutomation.css';
import Swal from 'sweetalert2';

const AsblAutomation = () => {
    const [activeTab, setActiveTab] = useState('bulk'); // 🔥 'bulk', 'manual' or 'new_category'
    const [pasteData, setPasteData] = useState('');
    const [loading, setLoading] = useState(false);
    const [loaOptions, setLoaOptions] = useState([]);
    const [selectedLoa, setSelectedLoa] = useState('');
    const [projectData, setProjectData] = useState([]);
    const [showAll, setShowAll] = useState(false);
    const [originalProjectData, setOriginalProjectData] = useState([]);

    // 🔥 States for Option-3 dynamic WBS filters
    const [wbsOptions, setWbsOptions] = useState([]);
    const [selectedWbsType, setSelectedWbsType] = useState('All');
    const [selectedWbs, setSelectedWbs] = useState('All');

    useEffect(() => {
        axios.get(`${process.env.REACT_APP_API_URL}/api/data/filter-options`).then(res => {
            if (res.data && res.data.loa_name) {
                setLoaOptions(res.data.loa_name);
            }
        });
    }, []);

    useEffect(() => {
        const selectEl = $('#loa-select');
        selectEl.select2({ placeholder: "Search LOA Name...", width: '100%', allowClear: true })
            .on('change', (e) => {
                setSelectedLoa(e.target.value);
                // Reset WBS filters when LOA changes
                setSelectedWbsType('All');
                setSelectedWbs('All');
            });
    }, [loaOptions, activeTab]);

    useEffect(() => {
        if (selectedLoa) {
            axios.get(`${process.env.REACT_APP_API_URL}/api/data/project-details?loa_name=${selectedLoa}`)
                .then(res => {
                    const dataWithOriginal = res.data.map(row => ({
                        ...row,
                        original_asbl: row.asbl
                    }));
                    setProjectData(dataWithOriginal);
                    setOriginalProjectData(dataWithOriginal);
                });
        } else {
            setProjectData([]);
        }
    }, [selectedLoa]);

    // 🔥 Fetch dynamic WBS options for Option-3
    useEffect(() => {
        if (selectedLoa && activeTab === 'new_category') {
            axios.get(`${process.env.REACT_APP_API_URL}/api/data/project-wbs-options?loa_name=${selectedLoa}`)
                .then(res => {
                    setWbsOptions(res.data || []);
                })
                .catch(console.error);
        } else {
            setWbsOptions([]);
        }
    }, [selectedLoa, activeTab]);

    const handleAsblChange = (index, newValue) => {
        const updatedData = projectData.map((item, i) => {
            if (i === index) {
                return { ...item, asbl: newValue };
            }
            return item;
        });
        setProjectData(updatedData);
    };

    const handleDownloadTemplate = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/download-asbl-template`;
    };

    const handleManualSave = async () => {
        if (!selectedLoa) {
            return Swal.fire({
                icon: "warning",
                title: "No Project Selected",
                text: "Please select a project first."
            });
        }

        const changedRows = projectData.filter(row =>
            Number(row.asbl) !== Number(row.original_asbl)
        );

        if (changedRows.length === 0) {
            return Swal.fire({
                icon: "warning",
                title: "No Changes Found",
                text: "Please modify ASBL value before saving."
            });
        }

        const confirm = await Swal.fire({
            title: "Save Changes?",
            text: `${changedRows.length} row(s) will be updated.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, Save",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#10b981"
        });

        if (!confirm.isConfirmed) return;

        setLoading(true);

        Swal.fire({
            title: "Saving...",
            text: "Updating ASBL values.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const res = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/update-manual-asbl`,
                {
                    loa_name: selectedLoa,
                    updates: changedRows
                }
            );

            const refresh = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/data/project-details?loa_name=${selectedLoa}`
            );

            const refreshedData = refresh.data.map(row => ({
                ...row,
                original_asbl: row.asbl
            }));

            setProjectData(refreshedData);
            setOriginalProjectData(refreshedData);

            await Swal.fire({
                icon: "success",
                title: "Saved Successfully",
                text: res.data.message,
                confirmButtonColor: "#10b981"
            });

        } catch (err) {
            Swal.fire({
                icon: "error",
                title: "Save Failed",
                text: err.response?.data?.error || "Server Error"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleBulkUpdate = async () => {
        if (!pasteData.trim()) {
            return Swal.fire({
                icon: "warning",
                title: "No Data Found",
                text: "Please paste data first."
            });
        }

        const result = await Swal.fire({
            title: "Submit Data?",
            text: "The pasted data will be processed and updated.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Yes, Submit",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#10b981"
        });

        if (!result.isConfirmed) return;

        setLoading(true);

        Swal.fire({
            title: "Processing...",
            text: "Please wait while data is being updated.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const res = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/process-asbl-update`,
                { rawText: pasteData }
            );

            await Swal.fire({
                icon: "success",
                title: "Update Successful",
                text: res.data.message
            });

            setPasteData('');

            if (selectedLoa) {
                const refresh = await axios.get(
                    `${process.env.REACT_APP_API_URL}/api/data/project-details?loa_name=${selectedLoa}`
                );
                setProjectData(refresh.data);
            }
        } catch (err) {
            Swal.fire({
                icon: "error",
                title: "Update Failed",
                text: err.response?.data?.error || "Update failed"
            });
        } finally {
            setLoading(false);
        }
    };

    // Extract unique WBS Types & Elements for Option-3 Dropdowns
    const uniqueWbsTypes = Array.from(new Set(wbsOptions.map(o => o.wbs_type).filter(Boolean)));
    const filteredWbsElements = wbsOptions
        .filter(o => selectedWbsType === 'All' || o.wbs_type === selectedWbsType)
        .map(o => o.wbs_element);

    // 🔥 Filter display data based on active tab
    const displayData = activeTab === 'new_category'
        ? projectData.filter(row => row.categories === 'New Category') // Option 3 only shows New Category
        : (showAll ? projectData : projectData.filter(row => Math.abs(row.asbl) > 0.01));

    return (
        <div className="p-6 bg-[#f8fafc] min-h-screen space-y-6 text-slate-800">
            
            {/* 🔥 THREE MODERN NAVIGATION TABS */}
            <div className="flex bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <button
                    onClick={() => { setActiveTab('bulk'); setSelectedLoa(''); }}
                    className={`flex-1 py-4 text-center font-black text-sm transition-all duration-200 ${
                        activeTab === 'bulk' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-slate-700 bg-white'
                    }`}
                >
                    📋 Option-1: Bulk Update (Paste)
                </button>
                <button
                    onClick={() => { setActiveTab('manual'); setSelectedLoa(''); }}
                    className={`flex-1 py-4 text-center font-black text-sm transition-all duration-200 ${
                        activeTab === 'manual' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-slate-700 bg-white'
                    }`}
                >
                    ✍️ Option-2: Manual Update (All Categories)
                </button>
                <button
                    onClick={() => { setActiveTab('new_category'); setSelectedLoa(''); }}
                    className={`flex-1 py-4 text-center font-black text-sm transition-all duration-200 ${
                        activeTab === 'new_category' 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-slate-400 hover:text-slate-700 bg-white'
                    }`}
                >
                    🎯 Option-3: New Category Update (Specific WBS)
                </button>
            </div>

            {/* TAB 1: BULK UPDATE */}
            {activeTab === 'bulk' && (
                <div className="bg-white/95 backdrop-blur-md rounded-[2rem] shadow-sm p-6 border border-slate-100">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                            Update <span className="text-emerald-600">ASBL</span> (Bulk)
                        </h2>
                        <button
                            onClick={handleDownloadTemplate}
                            className="group text-white px-4 py-2 rounded-2xl shadow-md flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-xl"
                            style={{ background: 'linear-gradient(135deg, #4169e1, #3157c9)' }}
                        >
                            <span className="text-lg transition-transform duration-300 group-hover:-translate-y-[1px]"><HiOutlineDocumentDownload /></span>
                            <span className="text-sm font-black">Export Template</span>
                        </button>
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-5">
                        <p className="text-[15px] text-amber-700 leading-relaxed"><span className="font-black uppercase">Note:</span> Please use the exported template before uploading or pasting ASBL data.</p>
                    </div>

                    <div className="mb-3">
                        <span className="text-slate-700 text-sm font-bold uppercase tracking-wide">Instructions:</span>
                        <span className="text-slate-500 text-sm mt-1"> Paste the copied Excel data below to process bulk ASBL updates.</span>
                    </div>

                    <textarea
                        className="w-full h-36 p-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 text-sm outline-none transition-all duration-300 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400"
                        placeholder="Paste Excel data here..."
                        value={pasteData}
                        onChange={(e) => setPasteData(e.target.value)}
                    />

                    <div className="flex justify-end mt-5">
                        <button onClick={handleBulkUpdate} className="group text-white px-5 py-2.5 rounded-2xl shadow-md flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-xl" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                            <span className="text-lg">🚀</span>
                            <span className="text-sm font-black">Submit</span>
                        </button>
                    </div>
                </div>
            )}

            {/* TAB 2 & 3: MANUAL UPDATES */}
            {(activeTab === 'manual' || activeTab === 'new_category') && (
                <div className="bg-white/95 backdrop-blur-md rounded-[2rem] shadow-sm p-6 border border-slate-100">
                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-5 mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                                {activeTab === 'manual' ? 'Manual ASBL Update' : 'New Category WBS-Specific Update'}
                            </h2>
                            <p className="text-slate-500 text-xs mt-1">
                                {activeTab === 'manual' 
                                    ? "Select LOA Name to load all categories and edit manually." 
                                    : "Select LOA Name, WBS Type and WBS to view and update ASBL under 'New Category'."}
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                            
                            {/* Project Dropdown */}
                            <div className="w-full md:w-[260px]">
                                <select id="loa-select" className="select2-dropdown">
                                    <option value="">Select Project...</option>
                                    {loaOptions.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* 🔥 Option-3 WBS Type & WBS dropdowns */}
                            {activeTab === 'new_category' && (
                                <>
                                    <div className="w-full md:w-[180px]">
                                        <select
                                            value={selectedWbsType}
                                            onChange={(e) => {
                                                setSelectedWbsType(e.target.value);
                                                setSelectedWbs('All');
                                            }}
                                            className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3 shadow-sm text-sm font-medium text-slate-700 outline-none"
                                        >
                                            <option value="All">All WBS Types</option>
                                            {uniqueWbsTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="w-full md:w-[180px]">
                                        <select
                                            value={selectedWbs}
                                            onChange={(e) => setSelectedWbs(e.target.value)}
                                            className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3 shadow-sm text-sm font-medium text-slate-700 outline-none"
                                        >
                                            <option value="All">All WBS Elements</option>
                                            {filteredWbsElements.map(wbs => (
                                                <option key={wbs} value={wbs}>{wbs}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                                {activeTab === 'manual' && (
                                    <button
                                        onClick={() => setShowAll(!showAll)}
                                        className="group text-white px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-md"
                                        style={{ background: 'linear-gradient(135deg, #4169e1, #3157c9)' }}
                                    >
                                        <span className="text-sm">{showAll ? "📂" : "📊"}</span>
                                        <span className="text-[11px] font-black uppercase tracking-wide">{showAll ? "Active ASBL" : "All Categories"}</span>
                                    </button>
                                )}

                                {projectData.length > 0 && (
                                    <button
                                        onClick={handleManualSave}
                                        className="group text-white px-4 py-2 rounded-xl shadow-sm flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-md"
                                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                                    >
                                        <span className="text-sm">💾</span>
                                        <span className="text-[11px] font-black uppercase tracking-wide">Save Changes</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Manual Table */}
                    {displayData.length > 0 ? (
                        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 shadow-sm">
                            <table className="w-full text-left text-[14px] border-collapse">
                                <thead className="bg-gradient-to-r from-slate-800 to-slate-700 text-white uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 font-black border-r border-slate-700">LOA ID / Name</th>
                                        <th className="p-4 font-black border-r border-slate-700">Cost/Revenue</th>
                                        <th className="p-4 font-black border-r border-slate-700">Category</th>
                                        <th className="p-4 text-center w-40 font-black">ASBL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayData.map((row, i) => (
                                        <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/40 transition-all duration-200">
                                            <td className="p-4 font-black text-blue-900 bg-slate-50/50 border-r border-slate-100">
                                                {i === 0 ? `${row.loa_id} - ${row.loa_name}` : ""}
                                            </td>
                                            <td className="p-4 font-bold text-slate-500 border-r border-slate-100">
                                                {i === 0 || row.cost_revenue !== displayData[i - 1].cost_revenue ? row.cost_revenue : ""}
                                            </td>
                                            <td className="p-4 text-slate-600 font-semibold border-r border-slate-100">
                                                {row.categories}
                                            </td>
                                            <td className="p-2 text-right bg-white">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={row.asbl}
                                                    onChange={(e) => handleAsblChange(projectData.indexOf(row), e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-xl text-right font-mono font-black text-blue-600 bg-slate-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-24 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
                            <div className="text-5xl mb-4">📊</div>
                            <p className="text-slate-400 text-lg font-bold">No Project Selected</p>
                            <p className="text-slate-300 text-sm mt-2">Select a project to view and edit ASBL values</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AsblAutomation;