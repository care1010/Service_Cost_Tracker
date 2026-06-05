import React, { useState, useEffect } from 'react';
import axios from 'axios';
import $ from 'jquery';
import 'select2';
import 'select2/dist/css/select2.min.css';
import { HiOutlineDocumentDownload } from "react-icons/hi";
import './AsblAutomation.css';
import Swal from 'sweetalert2';

const AsblAutomation = () => {
    const [pasteData, setPasteData] = useState('');
    const [loading, setLoading] = useState(false);
    const [loaOptions, setLoaOptions] = useState([]);
    const [selectedLoa, setSelectedLoa] = useState('');
    const [projectData, setProjectData] = useState([]);
    const [showAll, setShowAll] = useState(false);

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
            .on('change', (e) => setSelectedLoa(e.target.value));
    }, [loaOptions]);

    useEffect(() => {
        if (selectedLoa) {
            axios
                .get(
                    `${process.env.REACT_APP_API_URL}/api/data/project-details?loa_name=${selectedLoa}`
                )
                .then(res => {
                    setProjectData(res.data);
                    // 🔥 Check if all ASBL values are zero
                    const hasActiveValues = res.data.some(
                        row => Math.abs(row.asbl) > 0.01
                    );

                    // 🔥 Show alert if no active values
                    if (!hasActiveValues && res.data.length > 0) {
                        Swal.fire({
                            icon: 'info',
                            title: 'No Active Categories',
                            html: `
                                All ASBL values for this LOA are currently 
                                <b>0 or less than 0.01</b>.
                                <br/><br/>
                                Please click the 
                                <b>"Showing All"</b> toggle button 
                                to view all categories.
                            `,
                            confirmButtonText: 'Got it',
                            confirmButtonColor: '#4169e1'
                        });
                    }
                });
        } else {

            setProjectData([]);
        }
    }, [selectedLoa]);

    const handleAsblChange = (index, newValue) => {
        const updatedData = projectData.map((item, i) => {
            if (i === index) {
                return {
                    ...item,
                    asbl: newValue
                };
            }
            return item;
        });
        setProjectData(updatedData);
    };

    // 🔥 RESTORED: Template Download Function
    const handleDownloadTemplate = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/download-asbl-template`;
    };

    const handleManualSave = async () => {
        if (!selectedLoa) {
            return alert("Please select a project first");
        }
        setLoading(true);
        try {
            // 🔥 Save API
            const res = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/update-manual-asbl`,
                {
                    loa_name: selectedLoa,
                    updates: projectData
                }
            );
            // Immediately fetch fresh updated data
            const refresh = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/data/project-details?loa_name=${selectedLoa}`
            );

            // Update state with fresh DB values
            const refreshedData = [...refresh.data];
            // Respect current toggle mode
            if (!showAll) {
                const filtered = refreshedData.filter(
                    row => Math.abs(row.asbl) > 0.01
                );
                setProjectData(filtered);
            } else {
                setProjectData(refreshedData);
            }
            //  Success popup AFTER refresh
            alert(res.data.message);

        } catch (err) {
            alert(
                "Save failed: " +
                (
                    err.response?.data?.error ||
                    "Server Error"
                )
            );
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
                `${process.env.REACT_APP_API_URL}/api/data/project-details?loa_id=${selectedLoa}`
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
            <div className="bg-white/95 backdrop-blur-md rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.05)] 
            p-6 border border-slate-100 transition-all duration-300">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">

                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                            Update <span className="text-emerald-600">ASBL</span>
                        </h2>
                    </div>

                    {/* Export Template Button */}
                    <button
                        onClick={handleDownloadTemplate}
                        className="group text-white px-4 py-2 rounded-2xl shadow-md 
                        flex items-center gap-2 transition-all duration-300 
                        hover:scale-105 hover:shadow-xl"
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

                {/* Info Box */}
                <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 mb-5">
                    <p className="text-[15px] text-amber-700 leading-relaxed">
                        <span className="font-black uppercase">
                            Note:
                        </span>{" "}
                        Please use the exported template before uploading or pasting ASBL data.
                    </p>
                </div>

                {/* Paste Instruction */}
                <div className="mb-3">
                    <span className="text-slate-700 text-sm font-bold uppercase tracking-wide">
                        Option-1:
                    </span>

                    <span className="text-slate-500 text-sm mt-1">
                         `Paste the copied Excel data below to process bulk ASBL updates.
                    </span>
                </div>

                {/* Textarea */}
                <textarea
                    className="w-full h-36 p-4 rounded-[1.5rem] border border-slate-200 
                    bg-slate-50 text-sm outline-none transition-all duration-300
                    focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400
                    placeholder:text-slate-400"
                    placeholder="Paste Excel data here..."
                    value={pasteData}
                    onChange={(e) => setPasteData(e.target.value)}
                />

                {/* Process Button */}
                <div className="flex justify-end mt-5">
                    <button
                        onClick={handleBulkUpdate}
                        className="group text-white px-5 py-2.5 rounded-2xl shadow-md 
                        flex items-center gap-2 transition-all duration-300 
                        hover:scale-105 hover:shadow-xl"
                        style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                        }}
                    >
                        <span className="text-lg transition-transform duration-300 group-hover:translate-x-[2px]">
                            🚀
                        </span>

                        <span className="text-sm font-black">
                            Submit
                        </span>
                    </button>
                </div>

            </div>

                {/* SECTION 2: EDITABLE MATRIX */}
                <div className="bg-white/95 backdrop-blur-md rounded-[2rem] 
                shadow-[0_8px_30px_rgb(0,0,0,0.05)] p-6 border border-slate-100">

                    {/* Header */}
                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-5 mb-6">

                        <div>
                            
                            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
                                <span className="text-slate-700 text-sm font-bold uppercase tracking-wide">
                                    OPTION-2:
                                </span>{" "}

                                Select the <span className="font-bold text-blue-600">LOA Name</span>
                                from the dropdown below to update ASBL values manually.

                                <br />

                                <span className="text-slate-500 text-[13px]">
                                    The table will initially display only active categories.
                                    Use the toggle button to switch between active-only and all categories view.
                                </span>
                            </p>
                        </div>

                        {/* Right Controls */}
                        <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">

                            {/* Project Dropdown */}
                            <div className="w-full md:w-[260px]">
                                <select id="loa-select" className="select2-dropdown">
                                    <option value="">Select Project...</option>

                                    {loaOptions.map(name => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Toggle + Save */}
                            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">

                                {/* Toggle Button */}
                                <button
                                    onClick={() => setShowAll(!showAll)}
                                    className="group text-white px-4 py-2 rounded-xl shadow-sm 
                                    flex items-center gap-2 transition-all duration-300 
                                    hover:scale-105 hover:shadow-md"
                                    style={{
                                        background: 'linear-gradient(135deg, #4169e1, #3157c9)',
                                    }}
                                >
                                    <span className="text-sm">
                                        {showAll ? "📂" : "📊"}
                                    </span>

                                    <span className="text-[11px] font-black uppercase tracking-wide">
                                        {showAll ? "Active ASBL" : "All Categories"}
                                    </span>
                                </button>

                                {/* Save Button */}
                                {projectData.length > 0 && (
                                    <button
                                        onClick={handleManualSave}
                                        className="group text-white px-4 py-2 rounded-xl shadow-sm 
                                        flex items-center gap-2 transition-all duration-300 
                                        hover:scale-105 hover:shadow-md"
                                        style={{
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                        }}
                                    >
                                        <span className="text-sm">
                                            💾
                                        </span>

                                        <span className="text-[11px] font-black uppercase tracking-wide">
                                            Save Changes
                                        </span>
                                    </button>
                                )}

                            </div>

                        </div>
                    </div>

                    {/* Table */}
                    {displayData.length > 0 ? (

                        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 shadow-sm">

                            <table className="w-full text-left text-[14px] border-collapse">

                                <thead className="bg-gradient-to-r from-slate-800 to-slate-700 text-white uppercase tracking-wider">
                                    <tr>
                                        <th className="p-4 font-black border-r border-slate-700">
                                            LOA ID / Name
                                        </th>

                                        <th className="p-4 font-black border-r border-slate-700">
                                            Cost/Revenue
                                        </th>

                                        <th className="p-4 font-black border-r border-slate-700">
                                            Category
                                        </th>

                                        <th className="p-4 text-center w-40 font-black">
                                            ASBL
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>

                                    {displayData.map((row, i) => (

                                        <tr
                                            key={i}
                                            className="border-b border-slate-100 
                                            hover:bg-blue-50/40 transition-all duration-200"
                                        >

                                            {/* LOA */}
                                            <td className="p-4 font-black text-blue-900 bg-slate-50/50 border-r border-slate-100">

                                                {i === 0
                                                    ? `${row.loa_id} - ${row.loa_name}`
                                                    : ""
                                                }

                                            </td>

                                            {/* Cost Revenue */}
                                            <td className="p-4 font-bold text-slate-500 border-r border-slate-100">

                                                {i === 0 || row.cost_revenue !== displayData[i - 1].cost_revenue
                                                    ? row.cost_revenue
                                                    : ""
                                                }

                                            </td>

                                            {/* Category */}
                                            <td className="p-4 text-slate-600 font-semibold border-r border-slate-100">
                                                {row.categories}
                                            </td>

                                            {/* Input */}
                                            <td className="p-2 text-right bg-white">

                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={row.asbl}
                                                    onChange={(e) =>
                                                        handleAsblChange(
                                                            projectData.indexOf(row),
                                                            e.target.value
                                                        )
                                                    }

                                                    className="w-full p-2.5 border border-slate-200 
                                                    rounded-xl text-right font-mono font-black 
                                                    text-blue-600 bg-slate-50
                                                    focus:border-blue-500 focus:ring-4 
                                                    focus:ring-blue-100 outline-none transition-all"
                                                />

                                            </td>

                                        </tr>
                                    ))}

                                </tbody>

                            </table>

                        </div>

                    ) : (

                        <div className="text-center py-24 border-2 border-dashed 
                        border-slate-200 rounded-[2rem] bg-slate-50/50">

                            <div className="text-5xl mb-4">
                                📊
                            </div>

                            <p className="text-slate-400 text-lg font-bold">
                                No Project Selected
                            </p>

                            <p className="text-slate-300 text-sm mt-2">
                                Select a project to view and edit ASBL values
                            </p>

                        </div>

                    )}
                </div>
        </div>
    );
};

export default AsblAutomation;