import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import KpiCards from '../components/KpiCards';
import AsblModal from '../components/AsblModal';
import ReviewChanges from './ReviewChanges';

const SummaryView = ({ user }) => {
    // 1. SAARE STATES (Hamesha sabse upar)
    const [filters, setFilters] = useState({
        wbs: 'All', customer: 'All', loa_id: 'All', loa_name: 'All', active_inactive: 'All', period: 'All'
    });
    const [options, setOptions] = useState({});
    const [kpiData, setKpiData] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showAll, setShowAll] = useState(true); 
    const [loading, setLoading] = useState(false);
    const [isReviewMode, setIsReviewMode] = useState(false);

    // 2. SAARE EFFECTS (Hooks order maintain karne ke liye)
    // SummaryView.jsx mein fetchOptions ko update karein

    useEffect(() => {
    const fetchOptions = async () => {
        try {
            const userType = user?.type || 'user';
            const customers = user?.allowedCustomers ? user.allowedCustomers.join(',') : '';
            
            // URLSearchParams use karna sabse safe hai
            const params = new URLSearchParams({
                ...filters,
                type: userType,
                allowedCustomers: customers
            });

            const res = await axios.get(`http://localhost:5000/api/data/filter-options?${params.toString()}`);
            setOptions(res.data);
        } catch (err) {
            console.error("Error fetching filter options:", err);
        }
    };

    if (user) {
        fetchOptions();
    }
}, [user, filters]); // Filters badalne par dropdowns refresh honge

    // 3. SAARE HANDLERS (useCallback hooks)
    const handleFilterChange = (name, value) => setFilters(prev => ({ ...prev, [name]: value }));
    
    const handleReset = () => setFilters({ 
        wbs: 'All', customer: 'All', loa_id: 'All', loa_name: 'All', active_inactive: 'All', period: 'All' 
    });

    const handleKpiUpdate = useCallback((data) => {
        setKpiData(data);
    }, []);

    const handleFullExport = () => {
        const exportUrl = new URL('http://localhost:5000/api/data/export-excel');
        exportUrl.searchParams.append('showAll', showAll);
        Object.keys(filters).forEach(key => {
            if (filters[key] && filters[key] !== 'All') exportUrl.searchParams.append(key, filters[key]);
        });
        window.location.href = exportUrl.toString();
    };

    const handleFullRefresh = async () => {
        if(!window.confirm("This will take 1-2 minutes. Are you sure?")) return;
        setLoading(true);
        try {
            const res = await axios.post('http://localhost:5000/api/data/full-refresh');
            alert(res.data.message);
            window.location.reload(); 
        } catch (err) { alert("Refresh failed"); }
        finally { setLoading(false); }
    };

    const handleAsblSubmit = (data) => {
        setIsModalOpen(false);
    };

    // 4. LOGIC CALCULATIONS
    const queryParams = new URLSearchParams(filters);
    queryParams.append('showAll', showAll);
    queryParams.append('type', user?.type); // 🔥 Role bhejien
    if (user?.allowedCustomers) {
        queryParams.append('allowedCustomers', user.allowedCustomers.join(',')); // 🔥 Customers bhejien
}

    const dynamicApiUrl = `http://localhost:5000/api/data/wbs-summary?${queryParams.toString()}`;

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
        { header: 'Non Committed', field: 'non_committed' },
        { header: 'EAC', field: 'eac' },
        { header: 'EAC vs ASBL', field: 'eac_vs_asbl' }
    ];

    // 🔥 5. CONDITIONAL RETURN (Hamesha saare hooks ke BAAD aana chahiye)
    if (isReviewMode) {
        return <ReviewChanges onBack={() => setIsReviewMode(false)} />;
    }

    // 6. FINAL UI RETURN
    return (
        <div className="p-5 bg-[#f8fafc] min-h-screen relative">
            {loading && (
                <div className="fixed inset-0 z-[3000] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white">
                    <div className="w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <h2 className="text-xl font-bold">Performing Full System Sync...</h2>
                </div>
            )}

            

            <FilterBar filters={filters} options={options} onFilterChange={handleFilterChange} onReset={handleReset} />
            
            <div className="flex flex-col lg:flex-row gap-4 mb-6 items-stretch">
                <div className="flex-1">
                    <KpiCards data={kpiData} />
                </div>
                
                <div className="flex gap-3">
                    <button onClick={handleFullExport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-3xl shadow-lg flex flex-col items-center justify-center transition-all min-w-[100px]">
                        <span className="text-xl mb-1">📥</span>
                        <span className="text-[10px] font-bold uppercase">Export</span>
                    </button>


                    <button onClick={() => setShowAll(!showAll)}
                        className={`px-5 rounded-3xl shadow-lg flex flex-col items-center justify-center transition-all ${showAll ? 'bg-orange-500 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
                    >
                        <span className="text-xl mb-1">{showAll ? '🎯' : '📂'}</span>
                        <span className="text-[10px] font-bold uppercase">{showAll ? 'Showing All' : 'All Categories'}</span>
                    </button>

                    <button onClick={() => setIsReviewMode(true)} className="bg-amber-500 hover:bg-amber-600 text-white px-5 rounded-3xl shadow-lg flex flex-col items-center justify-center transition-all min-w-[100px]">
                        <span className="text-xl mb-1">🔍</span>
                        <span className="text-[10px] font-bold uppercase">Review</span>
                    </button>

                    <button onClick={handleFullRefresh} className="bg-slate-800 hover:bg-black text-white px-5 rounded-3xl shadow-lg flex flex-col items-center justify-center transition-all min-w-[100px]">
                        <span className="text-xl mb-1">🔄</span>
                        <span className="text-[10px] font-bold uppercase">Full Sync</span>
                    </button>
                </div>
            </div>

            <div className="rounded-[1.5rem] overflow-hidden shadow-xl border border-white bg-white">
                <DataTable title="" columns={tableColumns} apiUrl={dynamicApiUrl} filters={filters} onKpiUpdate={handleKpiUpdate} />
            </div>

            <AsblModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAsblSubmit} />
        </div>
    );
};

export default SummaryView;