import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import KpiCards from '../components/KpiCards';
import AsblModal from '../components/AsblModal';

const SummaryView = () => {
    const [filters, setFilters] = useState({
        wbs: 'All', customer: 'All', loa_id: 'All', loa_name: 'All', active_inactive: 'All', period: 'All'
    });
    const [options, setOptions] = useState({});
    const [kpiData, setKpiData] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showAll, setShowAll] = useState(false); // 🔥 Naya State

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/data/filter-options`);
                setOptions(res.data);
            } catch (err) { console.error("Error:", err); }
        };
        fetchOptions();
    }, []);

    const handleFilterChange = (name, value) => setFilters(prev => ({ ...prev, [name]: value }));
    const handleReset = () => setFilters({ wbs: 'All', customer: 'All', loa_id: 'All', loa_name: 'All', active_inactive: 'All', period: 'All' });
    const handleKpiUpdate = useCallback((data) => setKpiData(data), []);

    const queryParams = new URLSearchParams(filters).toString();
    // 🔥 FIX: dynamicApiUrl sirf ek baar declare kiya hai
    const dynamicApiUrl = `http://localhost:5000/api/data/wbs-summary?${queryParams}&showAll=${showAll}`;

    const tableColumns = [
        { header: 'BU', field: 'bu' },
        { header: 'Customer', field: 'customer' },
        { header: 'LOA Name', field: 'loa_name' },
        { header: 'LOA ID', field: 'loa_id' },
        { header: 'Cost/Revenue', field: 'cost_revenue' },
        { header: 'Category', field: 'categories' },
        { header: 'ASBL', field: 'asbl' },
        { header: 'ASBL LOA', field: 'asbl_loa' },
        { header: 'PTD', field: 'ptd' },
        { header: 'Open Com.', field: 'open_commitment' },
        { header: 'Non Committed', field: 'non_committed' }, // 🔥 Yeh editable banega
        { header: 'EAC', field: 'eac' },
        { header: 'EAC vs ASBL', field: 'eac_vs_asbl' }
    ];

const handleFullExport = () => {
        const exportUrl = new URL('http://localhost:5000/api/data/export-excel');
        Object.keys(filters).forEach(key => {
            if (filters[key] && filters[key] !== 'All') exportUrl.searchParams.append(key, filters[key]);
        });
        window.location.href = exportUrl.toString();
    };

const handleFullRefresh = async () => {
    if(!window.confirm("This will take 2-3 minutes. Are you sure?")) return;
    setLoading(true);
    try {
        const res = await axios.post('http://localhost:5000/api/data/full-refresh');
        alert(res.data.message);
        window.location.reload(); // Reload to see fresh data
    } catch (err) { alert("Refresh failed"); }
    finally { setLoading(false); }
};

const handleAsblSubmit = (data) => {
        console.log("Pasted Data:", data);
        // Abhi ke liye sirf console kar rahe hain, baad mein processing logic likhenge
        alert("Data received! Processing logic will be added in next step.");
        setIsModalOpen(false);
    };

    return (
        <div className="p-5 bg-[#f8fafc] min-h-screen">
            {/* --- TOP HEADER SECTION (Shifted Up) --- */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex justify-center items-center py-4">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-center relative group">
                        
                        <span className="text-slate-900">
                        Financial Services
                        </span>{' '}
                        
                        <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Cost Tracker Platform
                        </span>

                        {/* Animated underline */}
                        <span className="absolute left-1/2 -bottom-2 h-[3px] w-0 bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 group-hover:w-full group-hover:left-0"></span>
                        
                    </h1>
                    </div>
                
                {/* Compact Last Updated Tile */}
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                    <span className="text-[16px]">📅</span>
                    <div className="leading-tight">
                        <div className="text-[9px] font-bold text-slate-400 uppercase">Updated</div>
                        <div className="text-[11px] font-bold text-slate-700">{new Date().toLocaleDateString()}</div>
                    </div>
                </div>
            </div>

            {/* --- FILTERS (More Compact) --- */}
            <FilterBar filters={filters} options={options} onFilterChange={handleFilterChange} onReset={handleReset} />
            
            {/* --- KPI & EXCEL ROW --- */}
            <div className="flex flex-col lg:flex-row gap-4 mb-6 items-stretch">
                <div className="flex-1">
                    <KpiCards data={kpiData} />
                </div>
                
                {/* EXPORT BUTTON (KPIs ke side mein) */}
                {/* BUTTONS GROUP */}
                <div className="flex gap-3">
                    {/* Export Excel */}
                    <button onClick={handleFullExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-3xl shadow-lg shadow-emerald-100 flex flex-col items-center justify-center transition-all hover:-translate-y-1 min-w-[110px]">
                        <span className="text-xl mb-1">📥</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Export</span>
                    </button>

                    {/* Add ASBL Button */}
                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-3xl shadow-lg shadow-blue-100 flex flex-col items-center justify-center transition-all hover:-translate-y-1 min-w-[110px]"
                    >
                        <span className="text-xl mb-1">➕</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Add ASBL</span>
                    </button>

                    {/* UI mein button add karein (KPIs ke paas) */}
                    <button 
                        onClick={() => setShowAll(!showAll)}
                        className={`px-4 py-2 rounded-3xl font-bold text-[10px] uppercase transition-all ${showAll ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                    >
                        {showAll ? '🎯 Showing All' : '📂 All Categories'}
                    </button>

                    <button onClick={handleFullRefresh} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-3xl shadow-lg text-[10px] font-bold uppercase">
                        🔄 Full Sync from View
                    </button>
                </div>
            </div>

            {/* DataTable */}
            <div className="rounded-[1.5rem] overflow-hidden shadow-xl border border-white">
                <DataTable title="" columns={tableColumns} apiUrl={dynamicApiUrl} filters={filters} onKpiUpdate={handleKpiUpdate} />
            </div>

            {/* 🔥 ASBL MODAL */}
            <AsblModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                onSubmit={handleAsblSubmit} 
            />
        </div>
    );




//     return (
//         <div className="p-4 bg-gray-50 min-h-screen">
//             <FilterBar filters={filters} options={options} onFilterChange={(n, v) => setFilters({...filters, [n]: v})} onReset={() => setFilters({bu:'All', customer:'All', loa_id:'All', loa_name:'All', active_inactive:'All', period:'All'})} />
            
//             {/* 🔥 KPI CARDS SECTION */}
//             <KpiCards data={kpiData} />

//             <DataTable 
//                 title="" 
//                 columns={tableColumns} 
//                 apiUrl={dynamicApiUrl} 
//                 filters={filters}
                
//                 onKpiUpdate={handleKpiUpdate}
//             />
//         </div>
//     );
};

export default SummaryView;