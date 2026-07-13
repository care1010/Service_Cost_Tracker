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
    const [rowsPerPage] = useState(50);

    const fetchData = async () => {
        if (!row?.loa_id) return;
        const controller = new AbortController();
        setLoading(true);
        try {
            const res = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/drilldown`,
                {
                    field,
                    row,
                    filters
                },
                {
                    signal: controller.signal
                }
            );
            setData(res.data);
        } catch (err) {
            if (err.name !== "CanceledError") {
                console.error(err);
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
                String(val ?? "")
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase())
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
            wbs_type: filters?.wbs_type || 'All',
            wbs: filters?.wbs || 'All'
        });
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/export-drilldown?${params.toString()}`;
    };

    // Pagination Logic
    const indexOfLastRow = currentPage * rowsPerPage;
    const indexOfFirstRow = indexOfLastRow - rowsPerPage;
    const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);

    return (
        <div className="p-8 bg-[#f8fafc] min-h-screen">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm mb-6 flex justify-between items-center border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${field === 'ptd' ? 'bg-emerald-500' : 'bg-blue-600'}`}>
                        {field === 'ptd' ? '📈' : '⏳'}
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 uppercase">
                            {field === 'ptd' ? 'PTD Details' : 'Commitment Details'}
                        </h1>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{row?.loa_id} | {row?.categories}</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <input 
                        type="text" 
                        placeholder="Search..." 
                        className="bg-slate-50 border rounded-xl px-4 py-2 text-xs outline-none w-64"
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                    <button onClick={handleExport} className="bg-emerald-600 text-white px-5 py-2 rounded-xl font-bold text-[11px] uppercase transition-all hover:bg-emerald-700">📥 Export</button>
                    <button onClick={() => navigate(-1)} className="bg-slate-800 text-white px-5 py-2 rounded-xl font-bold text-[11px] uppercase">⬅️ Back</button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto max-h-[60vh]">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-900 text-white text-[11px] font-bold uppercase z-20">
                            <tr>
                                {data.length > 0 && Object.keys(data[0]).map(key => (
                                    <th key={key} className="p-4 border-b border-slate-800 whitespace-nowrap">{key.replace(/_/g, ' ')}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="text-[13px] text-slate-600">
                            {currentRows.length > 0 ? currentRows.map((item, index) => (
                                <tr key={index} className="border-b border-slate-50 hover:bg-slate-50">
                                    {Object.values(item).map((val, i) => (
                                        <td key={i} className="p-4 whitespace-nowrap">{val === null ? '-' : val.toString()}</td>
                                    ))}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={data.length > 0 ? Object.keys(data[0]).length : 1} className="p-20 text-center text-slate-400 italic">
                                        {loading ? "Fetching data from server..." : "No records found matching filters."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination UI */}
                <div className="p-4 bg-slate-50 flex justify-between items-center border-t">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Total Items: {filteredData.length}</span>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1 bg-white border rounded-lg text-xs disabled:opacity-50">Prev</button>
                        <span className="px-4 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded-lg">Page {currentPage} of {totalPages || 1}</span>
                        <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1 bg-white border rounded-lg text-xs disabled:opacity-50">Next</button>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex justify-end">
                <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-xl min-w-[200px]">
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-1">Total Drill Sum (KEUR)</p>
                    <p className="text-2xl font-black tabular-nums">
                        {calculateTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DrillDownPage;