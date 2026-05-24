import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

const DrillDownPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { field, row } = location.state || {};
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (field && row?.unique_key) fetchDrillData();
    }, [field, row]);

    const fetchDrillData = async () => {
        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/drilldown`, { field, row });
            setData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleExport = () => {
        const url = `${process.env.REACT_APP_API_URL}/api/data/export-drilldown?field=${field}&unique_key=${encodeURIComponent(row.unique_key)}`;
        window.location.href = url;
    };

    const filteredData = data.filter(item => 
        Object.values(item).some(val => 
            val?.toString().toLowerCase().includes(searchTerm.toLowerCase())
        )
    );


    // 🔥 UPDATED SUM LOGIC
    const calculateTotal = () => {
        const rawSum = filteredData.reduce((sum, item) => {
            if (field === 'ptd') {
                // PTD ke liye 'val_in_rc' ka sum lena hai
                return sum + (parseFloat(item.val_in_rc) || 0);
            } else {
                // Open Commitment ke liye existing logic (KEUR column)
                return sum + (parseFloat(item.open_commitment_KEUR || 0));
            }
        }, 0);

        // 🔥 PTD ke liye 1000 se divide karein, Open Com ke liye wahi rehne dein
        return field === 'ptd' ? (rawSum / 1000) : rawSum;
    };

    const totalValue = calculateTotal();

    return (
        <div className="p-8 bg-[#f8fafc] min-h-screen font-sans">
            
            {/* HEADER */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${field === 'ptd' ? 'bg-emerald-500' : 'bg-blue-600'} text-white shadow-lg`}>
                        {field === 'ptd' ? '📈' : '⏳'}
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                            {field === 'ptd' ? 'PTD Drilldown' : 'Open Commitment Drilldown'}
                        </h1>
                        <p className="text-slate-500 text-[12px] font-bold uppercase">{row?.unique_key}</p>
                    </div>
                </div>

                {/* SEARCH BOX */}
                <div className="relative flex-1 max-w-md mx-4">
                    <span className="absolute left-4 top-2.5 text-slate-600 text-sm">🔍</span>
                    <input 
                        type="text" 
                        placeholder="Search in transactions..." 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2">
                    <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold text-[13px] uppercase shadow-md transition-all">📥 Export</button>
                    <button onClick={() => navigate(-1)} className="bg-slate-800 hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-[13px] uppercase shadow-md transition-all">⬅️ Back</button>
                </div>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[13px] font-bold text-slate-600 uppercase">Filtered Records</p>
                    <p className="text-lg font-black text-slate-800">{filteredData.length}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[13px] font-bold text-slate-600 uppercase">Drill Sum (KEUR)</p>
                    <p className="text-lg font-black text-blue-600">{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <p className="text-[13px] font-bold text-slate-600 uppercase">LOA Name</p>
                    <p className="text-[13px] font-black text-emerald-600 uppercase truncate" title={row?.loa_name}>
                        {row?.loa_name || 'N/A'}
                    </p>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                {loading ? (
                    <div className="p-20 text-center font-bold text-slate-400 animate-pulse">Loading...</div>
                ) : filteredData.length > 0 ? (
                    <div className="overflow-auto max-h-[60vh] custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-blue-900 text-white text-[13px] font-black uppercase tracking-widest z-20">
                                <tr>
                                    {Object.keys(filteredData[0]).map((key) => (
                                        <th key={key} className="p-4 border-b border-slate-800">{key.replace(/_/g, ' ')}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-[14px] text-slate-600">
                                {filteredData.map((item, index) => (
                                    <tr key={index} className="border-b border-slate-50 hover:bg-blue-50/40 transition-colors">
                                        {/* 🔥 Logic: Har cell ko check karein ki kya wo highlight hona chahiye */}
                                        {Object.entries(item).map(([key, val], i) => {
                                            // Check if this is the target column
                                            const isTargetColumn = (key === 'val_in_rep_cur' || key === 'val_in_rc');
                                            
                                            return (
                                                <td 
                                                    key={i} 
                                                    className="p-4 whitespace-nowrap"
                                                    style={isTargetColumn ? { backgroundColor: '#bae6fd', fontWeight: 'bold', color: '#0369a1' } : {}}
                                                >
                                                    {val === null ? '-' : val.toString()}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-20 text-center text-slate-300 italic">No matching transactions found.</div>
                )}
            </div>
        </div>
    );
};

export default DrillDownPage;