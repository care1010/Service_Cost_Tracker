import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { DataGrid } from '@mui/x-data-grid';
import * as XLSX from "xlsx";
import { saveAs } from 'file-saver';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

const Dashboard = ({ user }) => {

    const [activeFilter, setActiveFilter] = useState('');

    const [buData, setBuData] = useState([]);
    const [loaData, setLoaData] = useState([]);

    // FILTER OPTIONS for YEARS, PERIODS, CUSTOMERS
    const [filterOptions, setFilterOptions] = useState({ years: [], periods: [], customers: [], loa_names: []});

    const [selectedYears, setSelectedYears] = useState([]);
    const [selectedPeriods, setSelectedPeriods] = useState([]);

    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

    const [showAllLoa, setShowAllLoa] = useState(false);
    const loaGraphRef = useRef();

    const [loading, setLoading] = useState(false);

    const yearRef = useRef();
    const periodRef = useRef();
    const customerRef = useRef();

    const [loaSearch, setLoaSearch] = useState('');
    const [showLoaDropdown, setShowLoaDropdown] = useState(false);
    const [selectedLoas, setSelectedLoas] = useState([]);

    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    const loaFilterRef = useRef();

    const [tableData, setTableData] = useState([]);
    const [tableView, setTableView] = useState('bu');

    const allowedCustomers = user?.allowedCustomers || [];

// fetching table data for BU and Cost
useEffect(() => {
    fetchTableData();
}, [tableView, selectedYears, selectedPeriods, selectedCustomers, selectedLoas]);

const fetchTableData = async () => {

    try {

        let endpoint = '';

        // BU TABLE
        if (tableView === 'bu') {
            endpoint = 'final-dashboard-table';
        }

        // LOA TABLE
        else if (tableView === 'loa') {
            endpoint = 'cost-view-table';
        }

        // CUSTOMER TABLE
        else if (tableView === 'customer') {
            endpoint = 'customer-view-table';
        }

        else if (tableView === 'bu-customer') {
            endpoint = 'bu-customer-view-table';
        }

        else if (tableView === 'customer-bu') {
            endpoint = 'customer-bu-view-table';
        }
        else if (tableView === 'negative-loa') {
            endpoint = 'negative-loa-table';
        }
        else if (tableView === 'customer-bu-loa') {
            endpoint = 'customer-bu-loa-view-table';
        }

        const years =
            selectedYears.join(',');

        const periods =
            selectedPeriods.join(',');

        const customers =
            selectedCustomers.join(',');

        const loa_names =
            selectedLoas.join(',');

        const res = await axios.get(
            `${process.env.REACT_APP_API_URL}/api/data/${endpoint}`,
            {
                params: {

                    years,
                    periods,
                    customers,
                    loa_names,

                    type: user?.type,

                    allowedCustomers:
                        allowedCustomers.join(',')
                }
            }
        );

        setTableData(res.data)

    } catch (err) {

        console.log(
            'Error fetching table:',
            err
        );
    }
};


const columnsToShow =

    // BU VIEW
    tableView === 'bu'
    ? [
        'bu',
        'asbl',
        'asbl_loa',
        'ptd',
        'open_commitment',
        'non_committed',
        'eac',
        'eac_vs_asbl'
    ]

    // BU + CUSTOMER VIEW
    : tableView === 'bu-customer'
    ? [
        'bu',
        'customer',
        'asbl',
        'asbl_loa',
        'ptd',
        'open_commitment',
        'non_committed',
        'eac',
        'eac_vs_asbl'
    ]

    // LOA VIEW
    : tableView === 'loa'
    ? [
        'bu',
        'customer',
        'loa_id',
        'loa_name',
        'asbl',
        'asbl_loa',
        'ptd',
        'open_commitment',
        'non_committed',
        'eac',
        'eac_vs_asbl'
    ]

    // CUSTOMER + BU VIEW
    : tableView === 'customer-bu'
    ? [
        'customer',
        'bu',
        'asbl',
        'asbl_loa',
        'ptd',
        'open_commitment',
        'non_committed',
        'eac',
        'eac_vs_asbl'
    ]

    : tableView === 'negative-loa'
    ? [
        'bu',
        'customer',
        'loa_id',
        'loa_name',
        'asbl',
        'asbl_loa',
        'ptd',
        'open_commitment',
        'eac',
        'eac_vs_asbl'
    ]

    // CUSTOMER + BU _ LOA VIEW
    : tableView === 'customer-bu-loa'
    ? [
        'customer',
        'bu',
        'loa_name',
        'asbl',
        'asbl_loa',
        'ptd',
        'open_commitment',
        'non_committed',
        'eac',
        'eac_vs_asbl'
    ]

    // CUSTOMER VIEW
    : [
        'customer',
        'asbl',
        'asbl_loa',
        'ptd',
        'open_commitment',
        'non_committed',
        'eac',
        'eac_vs_asbl'
    ];

<DataGrid rows={tableData} columns={columnsToShow} getRowId={(row) => row.BU}/>

const exportToExcel = () => {
  const worksheet = XLSX.utils.json_to_sheet(tableData);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Dashboard Table");

  XLSX.writeFile(workbook, "final_dashboard_table.xlsx");
};

    // =========================================
    // CLOSE DROPDOWN ON OUTSIDE CLICK
    // =========================================

    useEffect(() => {

        const handleClickOutside = (event) => {

            if (
                yearRef.current &&
                !yearRef.current.contains(event.target)
            ) {
                setShowYearDropdown(false);
            }

            if (
                periodRef.current &&
                !periodRef.current.contains(event.target)
            ) {
                setShowPeriodDropdown(false);
            }

            if (
                loaFilterRef.current &&
                !loaFilterRef.current.contains(event.target)
            ) {
                setShowLoaDropdown(false);
            }
            if (
                customerRef.current &&
                !customerRef.current.contains(event.target)
            ) {
                setShowCustomerDropdown(false);
            }

        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener(
                'mousedown',
                handleClickOutside
            );
        };

    }, []);

    // =========================================
    // FETCH FILTERS
    // =========================================

    useEffect(() => {
    const fetchFilters = async () => {
        try {
                const years =
                    selectedYears.join(',');

                const periods =
                    selectedPeriods.join(',');

                const customers =
                    selectedCustomers.join(',');

                const loa_names =
                    selectedLoas.join(',');

                const res = await axios.get(
                    `${process.env.REACT_APP_API_URL}/api/data/dashboard-filters`,
                    {
                        params: {
                            years,
                            periods,
                            customers,
                            loa_names,
                            type: user?.type,
                            allowedCustomers:
                            allowedCustomers.join(',')
                        }
                    }
                );
                setFilterOptions(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchFilters();
    }, [
        selectedYears,
        selectedPeriods,
        selectedCustomers,
        selectedLoas
    ]);

    // =========================================
    // FETCH DATA
    // =========================================

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                const years = selectedYears.join(',');
                const periods = selectedPeriods.join(',');
                const customers = selectedCustomers.join(',');
                const loa_names = selectedLoas.join(',');

                const [buRes, loaRes] = await Promise.all([

                    axios.get(
                        `${process.env.REACT_APP_API_URL}/api/data/analytics-bu`,
                        {
                            params: {
                                years,
                                periods,
                                customers,
                                loa_names,
                                showAll: showAllLoa,
                                type: user?.type,
                                allowedCustomers:
                                allowedCustomers.join(',')
                            }
                        }
                    ),

                    axios.get(
                        `${process.env.REACT_APP_API_URL}/api/data/analytics-loa`,
                        {
                            params: {
                                years,
                                periods,
                                customers,
                                loa_names,
                                showAll: showAllLoa,
                                type: user?.type,
                                allowedCustomers:
                                allowedCustomers.join(',')
                            }
                        }
                    )

                ]);

                setBuData(buRes.data);
                setLoaData(loaRes.data);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [selectedYears, selectedPeriods, selectedCustomers, selectedLoas, showAllLoa]);

    // =========================================
    // YEAR CHANGE
    // =========================================

    const handleYearChange = (year, checked) => {
        let updatedYears = [];
        if (checked) {
            updatedYears = [...selectedYears, year];
        } else {
            updatedYears = selectedYears.filter(
                (y) => y !== year
            );
        }

        setSelectedYears(updatedYears);

        // AUTO SYNC PERIODS
        if (updatedYears.length > 0) {
            const syncedPeriods =
                filterOptions.periods.filter((p) =>
                    updatedYears.some((y) =>
                        p.startsWith(y)
                    )
                );
            setSelectedPeriods(syncedPeriods);
        } else {
            setSelectedPeriods([]);
        }
    };

    // =========================================
    // PERIOD CHANGE
    // =========================================

    const handlePeriodChange = (period, checked) => {
        let updatedPeriods = [];
        if (checked) {
            updatedPeriods = [
                ...selectedPeriods,
                period
            ];
        } else {
            updatedPeriods =
                selectedPeriods.filter(
                    (p) => p !== period
                );
        }
        setSelectedPeriods(updatedPeriods);
        const syncedYears = [
            ...new Set(
                updatedPeriods.map(
                    (p) => p.split('-')[0]
                )
            )
        ];
        setSelectedYears(syncedYears);
    };

const filteredLoaOptions = loaData.filter((item) =>
    item.loa_name
        ?.toLowerCase()
        .includes(loaSearch.toLowerCase())
);

const resetAllFilters = () => {
    setSelectedYears([]);
    setSelectedPeriods([]);
    setSelectedCustomers([]);
    setSelectedLoas([]);
    setLoaSearch('');
    setShowAllLoa(false);
};

const totalASBL = buData.reduce(
    (sum, item) => sum + Number(item.asbl || 0),
    0
);

const totalPTD = buData.reduce(
    (sum, item) => sum + Number(item.ptd || 0),
    0
);

const totalEAC = buData.reduce(
    (sum, item) => sum + Number(item.eac || 0),
    0
);

const ptdCompletion =
    totalASBL > 0
        ? ((totalPTD / totalASBL) * 100).toFixed(1)
        : "0.0";

const eacCompletion =
    totalASBL > 0
        ? ((totalEAC / totalASBL) * 100).toFixed(1)
        : "0.0";

const displayLoaData = showAllLoa
    ? loaData
    : loaData.slice(0, 10);

    return (

        <div className="p-6 bg-slate-100 min-h-screen space-y-6">

            {/* HEADER */}
            <div className="bg-white rounded-[2rem] shadow-lg p-6 border border-slate-200">
                <div className="flex flex-col lg:flex-row lg:justify-between gap-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800">
                            Charts Analytics
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            Business Unit & Project Analysis
                        </p>
                    </div>

                    {/* FILTERS */}
                    <div className="flex flex-col md:flex-row gap-5">
                        {/* 1. Customer Filter */}
                        <div ref={customerRef} className="relative w-[260px]">

                            <p className="text-[11px] font-black uppercase text-slate-500 mb-2">
                                Select Customers
                            </p>

                            <button
                                onClick={() =>
                                    setShowCustomerDropdown(
                                        !showCustomerDropdown
                                    )
                                }
                                className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3 shadow-sm text-left"
                            >

                                <div className="flex items-center justify-between">

                                    <span className="text-sm font-medium text-slate-700">

                                        {selectedCustomers.length > 0
                                            ? `${selectedCustomers.length} Selected`
                                            : 'Choose Customers'}

                                    </span>

                                    <span>▼</span>

                                </div>

                            </button>

                            {showCustomerDropdown && (

                                <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 max-h-[260px] overflow-y-auto">

                                    <div className="flex justify-between mb-3">

                                        <button
                                            className="text-[10px] font-bold text-blue-600"
                                            onClick={() => {

                                                setSelectedCustomers(
                                                    filterOptions.customers
                                                );

                                            }}
                                        >
                                            Select All
                                        </button>

                                        <button
                                            className="text-[10px] font-bold text-red-500"
                                            onClick={() => {

                                                setSelectedCustomers([]);

                                            }}
                                        >
                                            Clear
                                        </button>

                                    </div>

                                    <div className="space-y-2">

                                        {filterOptions.customers.map((customer) => (

                                            <label
                                                key={customer}
                                                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
                                            >

                                                <input
                                                    type="checkbox"

                                                    checked={selectedCustomers.includes(customer)}

                                                    onChange={(e) => {

                                                        if (e.target.checked) {

                                                            setSelectedCustomers([
                                                                ...selectedCustomers,
                                                                customer
                                                            ]);

                                                        } else {

                                                            setSelectedCustomers(

                                                                selectedCustomers.filter(
                                                                    (x) => x !== customer
                                                                )

                                                            );

                                                        }

                                                    }}
                                                />

                                                <span className="text-sm font-medium text-slate-700">
                                                    {customer}
                                                </span>

                                            </label>

                                        ))}

                                    </div>

                                </div>

                            )}

                        </div>

                        {/* 1. YEAR FILTER */}

                        <div
                            ref={yearRef}
                            className="relative w-[260px]"
                        >

                            <p className="text-[11px] font-black uppercase text-slate-500 mb-2">
                                Select Years
                            </p>

                            <button
                                onClick={() =>
                                    setShowYearDropdown(
                                        !showYearDropdown
                                    )
                                }
                                className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3 shadow-sm text-left"
                            >

                                <div className="flex items-center justify-between">

                                    <span className="text-sm font-medium text-slate-700">

                                        {selectedYears.length > 0
                                            ? `${selectedYears.length} Selected`
                                            : 'Choose Years'}

                                    </span>

                                    <span>▼</span>

                                </div>

                            </button>

                            {showYearDropdown && (

                                <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 max-h-[260px] overflow-y-auto">

                                    <div className="flex justify-between mb-3">

                                        <button
                                            className="text-[10px] font-bold text-blue-600"
                                            onClick={() => {

                                                setSelectedYears(
                                                    filterOptions.years
                                                );

                                                setSelectedPeriods(
                                                    filterOptions.periods
                                                );

                                            }}
                                        >
                                            Select All
                                        </button>

                                        <button
                                            className="text-[10px] font-bold text-red-500"
                                            onClick={() => {

                                                setSelectedYears([]);
                                                setSelectedPeriods([]);

                                            }}
                                        >
                                            Clear
                                        </button>

                                    </div>

                                    <div className="space-y-2">

                                        {filterOptions.years.map((year) => (

                                            <label
                                                key={year}
                                                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
                                            >

                                                <input
                                                    type="checkbox"
                                                    checked={selectedYears.includes(year)}
                                                    onChange={(e) =>
                                                        handleYearChange(
                                                            year,
                                                            e.target.checked
                                                        )
                                                    }
                                                />

                                                <span className="text-sm font-medium text-slate-700">
                                                    {year}
                                                </span>

                                            </label>

                                        ))}

                                    </div>

                                </div>

                            )}

                        </div>

                        {/* 2. PERIOD FILTER */}

                        <div
                            ref={periodRef}
                            className="relative w-[260px]"
                        >

                            <p className="text-[11px] font-black uppercase text-slate-500 mb-2">
                                Select Periods
                            </p>

                            <button
                                onClick={() =>
                                    setShowPeriodDropdown(
                                        !showPeriodDropdown
                                    )
                                }
                                className="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3 shadow-sm text-left"
                            >

                                <div className="flex items-center justify-between">

                                    <span className="text-sm font-medium text-slate-700">

                                        {selectedPeriods.length > 0
                                            ? `${selectedPeriods.length} Selected`
                                            : 'Choose Periods'}

                                    </span>

                                    <span>▼</span>

                                </div>

                            </button>

                            {showPeriodDropdown && (

                                <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 max-h-[260px] overflow-y-auto">

                                    <button
                                            className="text-[10px] font-bold text-blue-600"
                                            onClick={() => {

                                                setSelectedYears(
                                                    filterOptions.years
                                                );

                                                setSelectedPeriods(
                                                    filterOptions.periods
                                                );

                                            }}
                                        >
                                            Select All
                                        </button>

                                        <button
                                            className="text-[10px] font-bold text-red-500 ml-7"
                                            onClick={() => {

                                                setSelectedYears([]);
                                                setSelectedPeriods([]);

                                            }}
                                        >
                                            Clear
                                        </button>

                                    <div className="space-y-2">

                                        {filterOptions.periods.map((period) => (

                                            <label
                                                key={period}
                                                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 cursor-pointer"
                                            >

                                                <input
                                                    type="checkbox"
                                                    checked={selectedPeriods.includes(period)}
                                                    onChange={(e) =>
                                                        handlePeriodChange(
                                                            period,
                                                            e.target.checked
                                                        )
                                                    }
                                                />

                                                <span className="text-sm font-medium text-slate-700">
                                                    {period}
                                                </span>

                                            </label>

                                        ))}

                                    </div>

                                </div>

                            )}

                        </div>

                        <button
                            onClick={resetAllFilters}
                            className="h-[52px] mt-6 px-5 rounded-2xl bg-red-500 text-white text-sm font-bold shadow-md hover:bg-red-600 transition-all
                            "
                        >Reset Filters
                        </button>

                    </div>

                </div>

            </div>

            
            {user?.type !== 'user' && (
            <div className="mt-6 bg-white p-4 rounded-xl shadow">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">Summary Table</h2>

                    <div className="flex justify-between items-center flex-wrap w-full">
                    {/* Left Side Buttons */}
                    
                    {/* Toggle Button for BU lvele table and Cost level table view */}
                    <div className="flex gap-3 flex-wrap mr-auto">

                        {/* BU TOGGLE */}

                        <button
                            onClick={() =>
                                setTableView(
                                    tableView === 'bu'
                                        ? 'bu-customer'
                                        : 'bu'
                                )
                            }
                            className={`
                                px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200

                                ${
                                    tableView === 'bu'
                                    || tableView === 'bu-customer'

                                        ? 'bg-blue-700 text-white shadow-lg scale-105'

                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }
                            `}
                        >

                            {
                                tableView === 'bu'
                                    ? 'BU + Customer View'
                                    : 'BU Only View'
                            }

                        </button>

                        {/* LOA VIEW */}

                        <button
                            onClick={() => setTableView('loa')}
                            className={`
                                px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200

                                ${
                                    tableView === 'loa'

                                        ? 'bg-green-700 text-white shadow-lg scale-105'

                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }
                            `}
                        >
                            BU+Customer+LOA View
                        </button>

                        </div>

                        {/* Right Side Buttons */}
                        <div className="flex gap-3 flex-wrap ml-8">

                        {/* CUSTOMER TOGGLE */}

                        <button
                            onClick={() =>
                                setTableView(
                                    tableView === 'customer'
                                        ? 'customer-bu'
                                        : 'customer'
                                )
                            }
                            className={`
                                px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200

                                ${
                                    tableView === 'customer'
                                    || tableView === 'customer-bu'

                                        ? 'bg-purple-700 text-white shadow-lg scale-105'

                                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }
                            `}
                        >

                            {
                                tableView === 'customer'
                                    ? 'Customer + BU View'
                                    : 'Customer Only View'
                            }

                        </button>

                        {/* customer-bu-LOA BUTTON */}
                        <button
                            onClick={() => setTableView('customer-bu-loa')}
                            className={`
                                px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200
                                ${
                                    tableView === 'customer-bu-loa'
                                        ? 'bg-red-700 text-white shadow-lg scale-105'
                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }
                            `}
                        >
                            Customer+BU+LOA View
                        </button>

                        {/* -ve LOA BUTTON */}
                        <button
                            onClick={() => setTableView('negative-loa')}
                            className={`
                                px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200
                                ${
                                    tableView === 'negative-loa'
                                        ? 'bg-red-700 text-white shadow-lg scale-105'
                                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }
                            `}
                        >
                            -ve LOA View
                        </button>
                        </div>


                    </div>
                    <button
                        onClick={exportToExcel}
                        className="
                            bg-blue-700 text-white
                            px-4 py-2 rounded-lg
                            ml-8
                            flex items-center gap-2
                            transition-all duration-200
                            hover:scale-105
                            hover:bg-blue-800 font-bold
                        "
                    >
                        <span>📥</span>
                        <span>Export</span>
                    </button>
                </div>

                <div className="overflow-auto max-h-[500px] border border-gray-200 rounded-xl">
                    <table className="min-w-full border border-gray-200 text-sm">

                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            {columnsToShow.map((col) => (
                            <th
                                key={col}
                                className="border px-3 py-2 text-left"
                            >
                                {
                                col
                                    .replaceAll('_', ' ')
                                    .toUpperCase()
                                }
                            </th>
                            ))}
                        </tr>
                    </thead>

                        <tbody>
                            {tableData &&
                            tableData.length > 0 ? (
                                tableData.map((row, index) => (
                                <tr
                                    key={index}
                                    className="hover:bg-gray-50"
                                >
                                    {columnsToShow.map((col) => (
                                    <td
                                        key={col}
                                        className="border px-3 py-2"
                                    >
                                        {row[col]}
                                    </td>
                                    ))}
                                </tr>
                                ))
                            ) : (
                                <tr>
                                <td
                                    colSpan={columnsToShow.length}
                                    className="text-center py-4 text-gray-500"
                                >
                                    No Data Found
                                </td>
                                </tr>
                            )}
                            </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* BU GRAPH */}

            <div className="bg-white rounded-[2rem] shadow-lg p-6 relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-[2rem]">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
                <h2 className="text-2xl font-black text-slate-800 mb-6">
                    Business Unit View
                </h2>

                <div className="flex gap-4 mb-6 flex-wrap">

    <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 min-w-[220px]">
        <div className="text-sm text-green-700 font-semibold">
            PTD Completion
        </div>

        <div className="text-3xl font-black text-green-600">
            {ptdCompletion}%
        </div>

        <div className="text-xs text-slate-500 mt-1">
            {totalPTD.toFixed(2)} / {totalASBL.toFixed(2)}
        </div>
    </div>

    <div className="bg-purple-50 border border-purple-200 rounded-2xl px-5 py-4 min-w-[220px]">
        <div className="text-sm text-purple-700 font-semibold">
            EAC Completion
        </div>

        <div className="text-3xl font-black text-purple-600">
            {eacCompletion}%
        </div>

        <div className="text-xs text-slate-500 mt-1">
            {totalEAC.toFixed(2)} / {totalASBL.toFixed(2)}
        </div>
    </div>

</div>

                <div className="w-full h-[420px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%" minWidth={300}>
                        <BarChart data={buData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="bu" />
                            <YAxis />

                            <Tooltip
    formatter={(value, name, props) => {
        const row = props.payload;

        if (name === "ptd") {
            const completion =
                row.asbl > 0
                    ? ((row.ptd / row.asbl) * 100).toFixed(1)
                    : "0.0";

            return [
                `${Number(value).toFixed(2)} (${completion}%)`,
                "PTD"
            ];
        }

        if (name === "eac") {
            const completion =
                row.asbl > 0
                    ? ((row.eac / row.asbl) * 100).toFixed(1)
                    : "0.0";

            return [
                `${Number(value).toFixed(2)} (${completion}%)`,
                "EAC"
            ];
        }

        return [
            Number(value).toFixed(2),
            name.toUpperCase()
        ];
    }}
/>

                            <Legend
                                formatter={(value) => value.toUpperCase()}
                            />

                            <Bar dataKey="asbl" fill="#2563eb">
                                <LabelList
                                    dataKey="asbl"
                                    position="top"
                                    formatter={(value) => Number(value).toFixed(2)}
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        fill: '#1e293b'
                                    }}
                                />
                            </Bar>

                            <Bar dataKey="ptd" fill="#10b981">
                                <LabelList
                                    dataKey="ptd"
                                    position="top"
                                    formatter={(value) => Number(value).toFixed(2)}
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        fill: '#1e293b'
                                    }}
                                />
                            </Bar>

                            <Bar dataKey="eac" fill="#8b5cf6">
                                <LabelList
                                    dataKey="eac"
                                    position="top"
                                    formatter={(value) => Number(value).toFixed(2)}
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        fill: '#1e293b'
                                    }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* LOA GRAPH */}

            <div
                ref={loaGraphRef}
                className="bg-white rounded-[2rem] shadow-lg p-6 relative"
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">
                            LOA Name View
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            ASBL • PTD • EAC Comparison
                        </p>
                    </div>
                    <div
                ref={loaFilterRef}
                className="relative"
            >

                <button
                    onClick={() =>
                        setShowLoaDropdown(!showLoaDropdown)
                    }
                    className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm"
                >
                    Filter LOA ▼
                </button>

                {showLoaDropdown && (

                    <div className="absolute right-0 mt-2 w-[320px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4">

                        {/* SEARCH */}

                        <input
                            type="text"
                            placeholder="Search LOA..."
                            value={loaSearch}
                            onChange={(e) =>
                                setLoaSearch(e.target.value)
                            }
                            className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm mb-4 outline-none focus:border-blue-500"
                        />

                        {/* ACTION BUTTONS */}

                        <div className="flex justify-between mb-3">

                            <button
                                className="text-[11px] font-bold text-blue-600"
                                onClick={() => {

                                    setSelectedLoas(
                                        filteredLoaOptions.map(
                                            (x) => x.loa_name
                                        )
                                    );

                                }}
                            >
                                Select All
                            </button>

                            <button
                                className="text-[11px] font-bold text-red-500"
                                onClick={() => {

                                    setSelectedLoas([]);

                                }}
                            >
                                Clear
                            </button>

                        </div>

                        {/* LOA LIST */}

                        <div className="max-h-[300px] overflow-y-auto space-y-2">

                            {filteredLoaOptions.map((item) => (

                                <label
                                    key={item.loa_name}
                                    className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded-xl cursor-pointer"
                                >

                                    <input
                                        type="checkbox"
                                        checked={selectedLoas.includes(item.loa_name)}
                                        onChange={(e) => {

                                            if (e.target.checked) {

                                                setSelectedLoas([
                                                    ...selectedLoas,
                                                    item.loa_name
                                                ]);

                                            } else {

                                                setSelectedLoas(

                                                    selectedLoas.filter(
                                                        (x) =>
                                                            x !== item.loa_name
                                                    )

                                                );

                                            }

                                        }}
                                    />

                                    <span className="text-sm text-slate-700 font-medium">
                                        {item.loa_name}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

                    {/* TOGGLE BUTTON */}
                    <button
                        onClick={() => {
                            setShowAllLoa(!showAllLoa);
                            setTimeout(() => {
                                loaGraphRef.current?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start'
                                });
                            }, 100);
                        }}
                        className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold shadow hover:bg-blue-700 transition-all"
                    >
                        {showAllLoa
                            ? 'Show Top 10'
                            : 'Show All LOAs'}

                    </button>

                </div>

                <div className="w-full max-h-[700px] overflow-y-auto pr-2">
                    <ResponsiveContainer width="100%" minWidth={300} height={showAllLoa ? loaData.length * 55: 700}>
                        <BarChart
                            data={
                                selectedLoas.length > 0
                                    ? displayLoaData.filter((item) =>
                                        selectedLoas.includes(item.loa_name)
                                    )
                                    : displayLoaData
                            }
                            layout="vertical"

                            barSize={18}
                            margin={{
                                top: 10,
                                right: 30,
                                left: 50,
                                bottom: 10
                            }}
                        >

                            <CartesianGrid
                                strokeDasharray="3 3"
                                horizontal={false}
                            />

                            <XAxis type="number" />

                            <YAxis
                                dataKey="loa_name"
                                type="category"
                                width={220}
                                tick={{
                                    fontSize: 11,
                                    fill: '#475569',
                                    fontWeight: 600
                                }}
                            />

                            <Tooltip formatter={(value, name) => [Number(value).toFixed(2), name.toUpperCase()]}/>

                            <Legend />

                            {/* ASBL */}

                            <Bar
                                dataKey="asbl"
                                fill="#2563eb"
                                name="ASBL"
                            >

                                <LabelList
                                    dataKey="asbl"
                                    position="right"
                                    formatter={(value) =>
                                        Number(value).toFixed(2)
                                    }
                                    style={{
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        fill: '#1e293b'
                                    }}
                                />

                            </Bar>

                            {/* PTD */}

                            <Bar
                                dataKey="ptd"
                                fill="#10b981"
                                name="PTD"
                            >

                                <LabelList
                                    dataKey="ptd"
                                    position="right"
                                    formatter={(value) =>
                                        Number(value).toFixed(2)
                                    }
                                    style={{
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        fill: '#1e293b'
                                    }}
                                />

                            </Bar>

                            {/* EAC */}

                            <Bar
                                dataKey="eac"
                                fill="#8b5cf6"
                                name="EAC"
                            >
                                <LabelList
                                    dataKey="eac"
                                    position="right"
                                    formatter={(value) =>
                                        Number(value).toFixed(2)
                                    }
                                    style={{
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        fill: '#1e293b'
                                    }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>

    );

};

export default Dashboard;