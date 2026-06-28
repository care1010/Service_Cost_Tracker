import React, { useEffect } from 'react';
import $ from 'jquery';
import 'select2';
import 'select2/dist/css/select2.min.css';
import { HiOutlineRefresh, HiOutlineFilter } from "react-icons/hi";

const FilterBar = ({ filters, options, onFilterChange, onReset }) => {

    const filterConfigs = [
        { label: 'BU', name: 'bu', span: 'lg:col-span-1' },
        { label: 'Customer', name: 'customer', span: 'lg:col-span-1' },
        { label: 'LOA ID', name: 'loa_id', span: 'lg:col-span-1' },
        { label: 'LOA Name', name: 'loa_name', span: 'lg:col-span-1' },
        { label: 'WBS', name: 'wbs', span: 'lg:col-span-1' },
        { label: 'WBS Type', name: 'wbs_type', span: 'lg:col-span-1' },
        { label: 'WBS Description', name: 'wbs_description', span: 'lg:col-span-1' },
        { label: 'Active/Inactive', name: 'active_inactive', span: 'lg:col-span-[0.8]' }, // ya lg:col-span-1
        { label: 'Period', name: 'period', span: 'lg:col-span-1' },
    ];

    useEffect(() => {

        const selects = $('.select2-dropdown').select2({
            width: '100%',
            placeholder: "Search...",
        });

        selects.on('change', (e) => {
            const { name, value } = e.target;
            onFilterChange(name, value);
        });

        filterConfigs.forEach(cfg => {
            $(`select[name="${cfg.name}"]`)
                .val(filters[cfg.name] || 'All')
                .trigger('change.select2');
        });

        return () => {
            selects.off('change');
        };

    }, [options]);

    return (
    <div className="bg-white/90 backdrop-blur-md p-3 rounded-[2rem] mb-4 
    shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200">

        {/* Filters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-12 gap-2 items-end">

            {filterConfigs.map((cfg) => (
                <div
                    key={cfg.name}
                    className={`${cfg.span} bg-slate-50/70 border border-slate-200 rounded-2xl p-1
                    transition-all duration-300 hover:shadow-md hover:border-blue-100`}
                >

                    <label className="text-[12px] font-black 
                    text-slate-600 mb-1 ml-1 uppercase tracking-wide block">
                        {cfg.label}
                    </label>

                    <select
                        className="select2-dropdown"
                        name={cfg.name}
                        value={filters[cfg.name] || 'All'}
                        onChange={(e) => onFilterChange(cfg.name, e.target.value)}
                    >
                        <option value="All">All</option>

                        {
    (cfg.name === 'period'
        ? options.period
            ?.filter(
                (p) =>
                    p &&
                    p !== '0-P' &&
                    /^\d{4}-P\d+$/.test(p)
            )
            ?.sort((a, b) => {

                const [yearA, periodA] = a.split('-P');
                const [yearB, periodB] = b.split('-P');

                // Year Descending
                if (Number(yearA) !== Number(yearB)) {
                    return Number(yearB) - Number(yearA);
                }

                // Period Descending
                return Number(periodB) - Number(periodA);
            })

        : options[cfg.name]
    )?.map((opt, i) => (

        <option key={i} value={opt}>
            {opt}
        </option>

    ))
}
                    </select>

                </div>
            ))}

            {/* Reset Button */}
            <div className="flex items-end">
                <button
                    onClick={onReset}
                    className="group text-white px-1 py-1 rounded-xl shadow-sm 
                    flex items-center justify-center gap-2 transition-all duration-300 
                    hover:scale-105 hover:shadow-md w-[70%] h-[70%] mb-3 ml-8"
                    style={{
                        background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                    }}
                >
                    <span className="text-sm transition-transform duration-300 group-hover:rotate-180">
                        <HiOutlineRefresh />
                    </span>

                    <span className="text-[15px] font-black tracking-wide uppercase">
                        Reset Filters
                    </span>
                </button>
            </div>

        </div>
    </div>
);
};

export default FilterBar;