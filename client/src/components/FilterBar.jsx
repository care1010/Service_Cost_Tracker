import React, { useEffect } from 'react';
import $ from 'jquery';
import 'select2';
import 'select2/dist/css/select2.min.css';

const FilterBar = ({ filters, options, onFilterChange, onReset }) => {
    const filterConfigs = [
        { label: 'WBS', name: 'wbs' },
        { label: 'Customer', name: 'customer' },
        { label: 'LOA ID', name: 'loa_id' },
        { label: 'LOA Name', name: 'loa_name' },
        { label: 'Active/Inactive', name: 'active_inactive' },
        { label: 'Period', name: 'period' },
    ];


    useEffect(() => {
    const selects = $('.select2-dropdown').select2({
        width: '100%',
        placeholder: "Search..."
    });

        // 2. Handle Change Event
        selects.on('change', (e) => {
            const { name, value } = e.target;
            onFilterChange(name, value);
        });

        // 3. Sync Select2 with React State (Zaroori for Reset button)
        filterConfigs.forEach(cfg => {
            $(`select[name="${cfg.name}"]`).val(filters[cfg.name] || 'All').trigger('change.select2');
        });

        return () => {
            selects.off('change');
            // selects.select2('destroy'); // Optional: React re-render issues se bachne ke liye ise comment rakhein
        };
    }, [options]); // Jab options ya filters badlein, Select2 update ho

    return (
        <div className="bg-white p-4 rounded-[1.5rem] mb-4 shadow-sm border border-slate-50">
            <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-slate-800 font-bold text-xs flex items-center gap-2 uppercase tracking-widest">
                    <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
                    Filters
                </h3>
                <button 
                    onClick={onReset} 
                    className="text-[13px] font-bold text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-100 px-3 py-1 rounded-full transition-all"
                >
                    🔄 Reset Filters
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {filterConfigs.map((cfg) => (
                    <div key={cfg.name} className="flex flex-col">
                        <label className="text-[12px] font-bold text-grey-400 mb-1 ml-1 uppercase">{cfg.label}</label>
                        <select
                            className="select2-dropdown" // Class for Select2
                            name={cfg.name}
                            value={filters[cfg.name] || 'All'}
                            onChange={(e) => onFilterChange(cfg.name, e.target.value)}
                        >
                            <option value="All">All</option>
                            {options[cfg.name]?.map((opt, i) => (
                                <option key={i} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FilterBar;