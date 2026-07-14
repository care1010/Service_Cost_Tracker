import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

const DrillDownPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { field, row, filters } = location.state || {};
    
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100);

    const fetchData = async () => {
        if (!row?.loa_id || !row?.categories) {
            console.error("Missing Row Data from Table:", row);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        setLoading(true);
        
        try {
            const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
            const res = await axios.post(
                `${API_URL}/api/data/drilldown`,
                { field, row, filters },
                { signal: controller.signal }
            );
            setData(res.data);
        } catch (err) {
            if (err.name !== "CanceledError") {
                console.error("Fetch Data Error:", err);
            }
        } finally {
            setLoading(false);
        }
        return () => controller.abort();
    };
    
    useEffect(() => {
        fetchData();
    }, [field, row, filters]);

    const filteredData = useMemo(() => {
        return data.filter(item =>
            Object.values(item).some(val =>
                String(val ?? "").toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [data, searchTerm]);

    const calculateTotal = () => {
        return filteredData.reduce((sum, item) => {
            const val = field === "ptd"
                ? parseFloat(item.ptd_val || 0)
                : parseFloat(item.oc_val || 0);
            return sum + val;
        }, 0);
    };

    const handleExport = () => {
        const params = new URLSearchParams({
            field,
            loa_id: row?.loa_id,
            categories: row?.categories,
            filters: JSON.stringify(filters || {}) 
        });
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/export-drilldown?${params.toString()}`;
    };

    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    const isPTD = field === 'ptd';

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-8">
            
            {/* 🚀 TOP HEADER SECTION (Title Left, KPIs Right) */}
            <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-6 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
                
                {/* LEFT: Back Button + Title + Subtitle */}
                <div>
                    <button 
                        onClick={() => navigate(-1)} 
                        className="group flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors mb-3 w-fit"
                    >
                        <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-xs font-bold uppercase tracking-wider">Back to Dashboard</span>
                    </button>
                    
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner ${isPTD ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isPTD ? '📈' : '⏳'}
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                            {isPTD ? 'PTD Details' : 'Commitment Details'}
                        </h1>
                    </div>

                    {/* Compact Subtitle Pille Layout */}
                    <div className="flex items-center flex-wrap gap-2 mt-3 text-xs font-bold">
                        <span className="bg-slate-800 text-white px-3 py-1 rounded-md shadow-sm">
                            {row?.loa_id || 'N/A'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-md border border-slate-200 truncate max-w-[250px]" title={row?.loa_name}>
                            {row?.loa_name || 'N/A'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-md border border-blue-100">
                            {row?.categories || 'N/A'}
                        </span>
                    </div>
                </div>

                {/* RIGHT: Compact KPI Cards */}
                <div className="flex flex-wrap items-center gap-3">
                    
                    {/* Total Value */}
                    <div className={`flex flex-col justify-center px-5 py-3 rounded-2xl border-2 ${isPTD ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'} min-w-[160px]`}>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isPTD ? 'text-emerald-600' : 'text-blue-600'}`}>
                            Total Value (KEUR)
                        </span>
                        <span className={`text-2xl font-black tabular-nums ${isPTD ? 'text-emerald-700' : 'text-blue-700'}`}>
                            {calculateTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* Total Records */}
                    <div className="flex flex-col justify-center px-5 py-3 rounded-2xl bg-white border border-slate-200 shadow-sm min-w-[130px]">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Records Found
                        </span>
                        <span className="text-2xl font-black tabular-nums text-slate-800">
                            {filteredData.length.toLocaleString('en-IN')}
                        </span>
                    </div>
                </div>

            </div>

            {/* 🚀 TABLE CONTROLS */}
            <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50">
                    
                    {/* Search & Rows Dropdown */}
                    <div className="flex items-center flex-wrap gap-4">
                        <div className="relative">
                            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input 
                                type="text" 
                                placeholder="Search in records..." 
                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all w-64 shadow-sm"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
                            <span className="text-xs font-bold text-slate-500 uppercase">Show</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setRowsPerPage(e.target.value === "ALL" ? (filteredData.length || data.length) : Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                            >
                                <option value="100">100</option>
                                <option value="200">200</option>
                                <option value="500">500</option>
                                <option value="ALL">ALL</option>
                            </select>
                        </div>
                    </div>
                    
                    {/* Export Button */}
                    <button 
                        onClick={handleExport} 
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wide transition-all shadow-md active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Excel
                    </button>
                </div>

                {/* 🚀 DATA TABLE */}
                <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                    <table className="w-full">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-slate-100 border-b border-slate-200 shadow-sm">
                                {data.length > 0 && Object.keys(data[0]).map((key, index) => (
                                    <th 
                                        key={key} 
                                        className={`px-4 py-3 text-left text-[11px] font-black text-slate-500 uppercase tracking-wider whitespace-nowrap ${index === 0 ? 'pl-6' : ''}`}
                                    >
                                        {key.replace(/_/g, ' ')}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-[13px] font-medium text-slate-600 bg-white">
                            {currentRows.length > 0 ? currentRows.map((item, index) => (
                                <tr key={index} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    {Object.entries(item).map(([key, val], i) => {
                                        // 💡 Target Column Highlight Logic
                                        const isTargetColumn = key === 'ptd_val' || key === 'oc_val';
                                        return (
                                            <td 
                                                key={i} 
                                                className={`px-4 py-3 whitespace-nowrap ${i === 0 ? 'pl-6' : ''} ${isTargetColumn ? 'bg-sky-50 font-black text-blue-700 border-x border-sky-100' : ''}`}
                                            >
                                                {val === null ? '-' : val.toString()}
                                            </td>
                                        );
                                    })}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={data.length > 0 ? Object.keys(data[0]).length : 1} className="p-16 text-center">
                                        {loading ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                <span className="text-slate-500 font-bold text-sm">Fetching detailed records...</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 font-medium italic">No records found matching your search.</span>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 🚀 PAGINATION FOOTER */}
                {filteredData.length > 0 && (
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                            Showing <span className="text-slate-700">{indexOfFirstRow + 1}</span> - <span className="text-slate-700">{Math.min(indexOfLastRow, filteredData.length)}</span> of <span className="text-slate-700">{filteredData.length}</span>
                        </p>
                        
                        <div className="flex items-center gap-1.5">
                            <button 
                                disabled={currentPage === 1} 
                                onClick={() => setCurrentPage(1)}
                                className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-40 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                            </button>
                            <button 
                                disabled={currentPage === 1} 
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-40 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            
                            <div className="flex items-center px-2 gap-1">
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${
                                                currentPage === pageNum
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-slate-500 hover:bg-slate-200'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>
                            
                            <button 
                                disabled={currentPage >= totalPages} 
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-40 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                            </button>
                            <button 
                                disabled={currentPage >= totalPages} 
                                onClick={() => setCurrentPage(totalPages)}
                                className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-blue-600 disabled:opacity-40 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DrillDownPage;