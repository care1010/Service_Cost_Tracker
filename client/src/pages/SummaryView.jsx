import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import KpiCards from '../components/KpiCards';
import AsblModal from '../components/AsblModal';
import ReviewChanges from './ReviewChanges';
import Swal from 'sweetalert2';
import { HiOutlineFilter, HiOutlineViewGrid, HiOutlineSearch, HiOutlineRefresh } from "react-icons/hi";

const SummaryView = ({ user }) => {
    // 1. SAARE STATES (Hamesha sabse upar)
    const [filters, setFilters] = useState({
        bu: 'All', customer: 'All', loa_id: 'All', loa_name: 'All',  wbs: 'All', active_inactive: 'Active', period: 'All'
    });
    const [options, setOptions] = useState({});
    const [kpiData, setKpiData] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showAll, setShowAll] = useState(false); 
    const [loading, setLoading] = useState(false);
    const [isReviewMode, setIsReviewMode] = useState(false);
    const [collapseView, setCollapseView] = useState(false);
    const [negativeLoaView, setNegativeLoaView] = useState(false);

    //  1. Review Button Click Handler
    const handleReviewClick = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/check-pending-changes`);
            
            if (res.data.count > 0) {
                setIsReviewMode(true); // Agar changes hain toh Review page par bhejien
            } else {
                // 🔥 2. No Changes Popup
                Swal.fire({
                    icon: 'info',
                    title: 'No Changes',
                    text: 'No changes to show on Review.',
                    confirmButtonColor: '#3b82f6',
                    background: '#ffffff',
                    customClass: { popup: 'rounded-[2rem]' }
                });
            }
        } catch (err) {
            console.error("Check failed", err);
        }
    };

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

            const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/filter-options?${params.toString()}`);
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
        bu: 'All', customer: 'All', loa_id: 'All', loa_name: 'All', wbs: 'All', active_inactive: 'Active', period: 'All' 
    });

    const handleKpiUpdate = useCallback((data) => {
        setKpiData(data);
    }, []);

    const handleFullExport = async () => {

    const result = await Swal.fire({
        title: 'Select Export View',
        text: 'Choose which view you want to export',
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,

        confirmButtonText: 'Export at Cost Level',
        denyButtonText: 'Export at Cost Element Level',

        confirmButtonColor: '#16a34a',
        denyButtonColor: '#4169e1',
        cancelButtonColor: '#6b7280'
    });

    let exportCollapseView = false;

    if (result.isConfirmed) {
        // Collapse View Export
        exportCollapseView = true;
    }
    else if (result.isDenied) {
        // Expand View Export
        exportCollapseView = false;
    }
    else {
        return;
    }

    const exportUrl = new URL(
        `${process.env.REACT_APP_API_URL}/api/data/export-excel`
    );

    const userType = user?.type || 'user';

    const allowedCustomers =
        Array.isArray(user?.allowedCustomers)
            ? user.allowedCustomers.join(',')
            : user?.allowedCustomers || '';

    exportUrl.searchParams.append(
        'type',
        userType
    );

    exportUrl.searchParams.append(
        'allowedCustomers',
        allowedCustomers
    );

    exportUrl.searchParams.append(
        'showAll',
        showAll
    );

    // 👇 Popup se selected view bhejenge
    exportUrl.searchParams.append(
        'collapseView',
        exportCollapseView
    );

    Object.keys(filters).forEach(key => {

        if (
            filters[key]
            &&
            filters[key] !== 'All'
        ) {
            exportUrl.searchParams.append(
                key,
                filters[key]
            );
        }
    });

    window.location.href = exportUrl.toString();
};

const startExport = (exportCollapseView) => {

    const exportUrl = new URL(
        `${process.env.REACT_APP_API_URL}/api/data/export-excel`
    );

    const userType = user?.type || 'user';

    const allowedCustomers =
        Array.isArray(user?.allowedCustomers)
            ? user.allowedCustomers.join(',')
            : user?.allowedCustomers || '';

    exportUrl.searchParams.append(
        'type',
        userType
    );

    exportUrl.searchParams.append(
        'allowedCustomers',
        allowedCustomers
    );

    exportUrl.searchParams.append(
        'showAll',
        showAll
    );

    exportUrl.searchParams.append(
        'collapseView',
        exportCollapseView
    );

    Object.keys(filters).forEach(key => {

        if (
            filters[key]
            &&
            filters[key] !== 'All'
        ) {
            exportUrl.searchParams.append(
                key,
                filters[key]
            );
        }
    });

    window.location.href =
        exportUrl.toString();
};

    const handleFullRefresh = async () => {

    const result = await Swal.fire({
        title: "Sync Database?",
        text: "This process may take 1-2 minutes.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Sync",
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: "Syncing Database...",
        text: "Please wait",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const res = await axios.post(
            `${process.env.REACT_APP_API_URL}/api/data/full-refresh`
        );

        await Swal.fire({
            icon: "success",
            title: "Sync Completed",
            text: res.data.message
        });

        window.location.reload();

    } catch (err) {
        Swal.fire({
            icon: "error",
            title: "Sync Failed",
            text: "Something went wrong"
        });
    }
};

    const handleNegativeLOA = () => {
        // parent rows only
        const filteredData = tableData.filter(row => {
            const value = Number(row["EAC vs ASBL"]) || 0;
            return value <= 0 && Number(row["ASBL"]) > 0;
        });
        setNegativeLOAData(filteredData);
        setShowNegativeLOA(true);
    };

    const handleAsblSubmit = (data) => {
        setIsModalOpen(false);
    };

    // 4. LOGIC CALCULATIONS
    const queryParams = new URLSearchParams(filters);
    queryParams.append('showAll', showAll);
    queryParams.append('type', user?.type); // Role bhejien
    if (user?.allowedCustomers) {
        queryParams.append('allowedCustomers', user.allowedCustomers.join(',')); // Customers bhejien
}

    const dynamicApiUrl = collapseView
    ? `${process.env.REACT_APP_API_URL}/api/data/wbs-summary-collapse?${queryParams.toString()}`
    : `${process.env.REACT_APP_API_URL}/api/data/wbs-summary?${queryParams.toString()}`;

    const tableColumns = [
        { header: 'BU', field: 'bu' },
        { header: 'Customer', field: 'customer' },
        { header: 'LOA Name', field: 'loa_name' },
        { header: 'LOA ID', field: 'loa_id' },
        { header: 'Cost / Revenue', field: 'cost_revenue' },
        { header: 'Category', field: 'categories' },
        { header: 'ASBL', field: 'asbl' },
        { header: 'ASBL LOA', field: 'asbl_loa' },
        { header: 'PTD', field: 'ptd', clickable: true },
        { header: 'Open Commitment (KEUR)', field: 'open_commitment', clickable: true },
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
                    {/* Export Excel - Sabko dikhega */}
                    <button
                        onClick={handleFullExport}
                        className="group text-white px-4 py-2 rounded-2xl shadow-md 
                        flex items-center gap-2 transition-all duration-300 
                        hover:scale-105 hover:shadow-xl"
                        style={{
                            background: 'linear-gradient(135deg, #4169e1, #3157c9)',
                        }}
                    >
                        <span className="text-lg transition-transform duration-300 group-hover:-translate-y-[1px]">
                            📥
                        </span>

                        <div className="flex flex-col leading-tight text-left">
                            
                            <span className="text-sm font-black">
                                Export
                            </span>
                        </div>
                    </button>

                    {/* Toggle Categories - Sabko dikhega */}
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="group text-white px-4 py-2 rounded-2xl shadow-md 
                        flex items-center gap-2 transition-all duration-300 
                        hover:scale-105 hover:shadow-xl"
                        style={{
                            background: showAll
                                ? 'linear-gradient(135deg, #f97316, #ea580c)'   // Orange when active
                                : 'linear-gradient(135deg, #4169e1, #3157c9)', // Blue when inactive
                        }}
                    >
                        <span className="text-lg transition-transform duration-300 group-hover:-translate-y-[1px]">
                            {showAll ? <HiOutlineFilter /> : <HiOutlineViewGrid />}
                        </span>

                        <div className="flex flex-col leading-tight text-left">
                            <span className="text-sm font-black">
                                {showAll ? 'Active Categories' : 'All Categories'}
                            </span>
                        </div>
                    </button>

                {/*  ROLE CHECK: Sirf Admin/Super Admin ko dikhega */}
                    {(user?.type === 'admin' || user?.type === 'super_admin') && (
                        <>
                        {/* Review Changes Button */}
                            <button
                                onClick={handleReviewClick}
                                className="group text-white px-4 py-2 rounded-2xl shadow-md 
                                flex items-center gap-2 transition-all duration-300 
                                hover:scale-105 hover:shadow-xl"
                                style={{
                                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                }}
                            >
                                <span className="text-lg transition-transform duration-300 group-hover:-translate-y-[1px]">
                                    <HiOutlineSearch />
                                </span>

                                <div className="flex flex-col leading-tight text-left">
                                    <span className="text-sm font-black">
                                        Review
                                    </span>
                                </div>
                            </button>

                            {/* Full Sync Button */}
                            <button
                                onClick={handleFullRefresh}
                                className="group text-white px-4 py-2 rounded-2xl shadow-md 
                                flex items-center gap-2 transition-all duration-300 
                                hover:scale-105 hover:shadow-xl"
                                style={{
                                    background: 'linear-gradient(135deg, #1e293b, #000000)',
                                }}
                            >
                                <span className="text-lg transition-transform duration-300 group-hover:rotate-180">
                                    <HiOutlineRefresh />
                                </span>

                                <div className="flex flex-col leading-tight text-left">
                                    <span className="text-sm font-black">
                                        Sync Database
                                    </span>
                                </div>
                            </button>
                        </>
                    )}
                    
                </div>
            </div>

            <div className="rounded-[1.5rem] overflow-hidden shadow-xl border border-white bg-white">
                <DataTable title="" columns={tableColumns} apiUrl={dynamicApiUrl} filters={filters} onKpiUpdate={handleKpiUpdate} collapseView={collapseView} user={user} />
            </div>

            <AsblModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAsblSubmit} />
                <div className="mt-6 mb-4 px-4 py-3 border border-amber-200 rounded-lg text-sm text-slate-800 bg-amber-50">
                    <span className="font-bold text-amber-800">Note:</span>{" "}
                    This tool is to be used to track Services Cost "– EAC vs ASBL".
                    Please ignore revenue figures, as these figures are not validated.
                </div>

        </div>
    );
};

export default SummaryView;