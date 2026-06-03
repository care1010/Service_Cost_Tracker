import React from 'react';

const KpiCards = ({ data }) => {
    const asblValue =
    Number(data?.asbl_sm) === 0
        ? 'NA'
        : data?.asbl_sm || 'NA';

    const cards = [
        { label: 'ASBL SM %', value: asblValue, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'PTD SM %', value: data?.ptd_sm || '0.00', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'EAC SM %', value: data?.eac_sm || '0.00', color: 'text-purple-600', bg: 'bg-purple-50' },
    ];

    return (
        <div className="flex gap-3 h-full">
            {cards.map((card, i) => (
                <div
                    key={i}
                    className="group bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 
                    flex items-center justify-between min-w-[180px] relative overflow-hidden 
                    transition-all duration-300 hover:scale-105"
                >
                    {/* Background Circle */}
                    <div
                        className={`absolute -right-3 -top-3 w-10 h-10 rounded-full ${card.bg} opacity-40`}
                    ></div>

                    {/* Label */}
                    <span className="text-grey-500 text-[13px] font-semibold uppercase tracking-wide z-10">
                        {card.label}
                    </span>

                    {/* Value */}
                    <span className={`text-xl font-black ${card.color} z-10`}>
                        {card.value === 'NA'
                            ? 'NA'
                            : `${card.value}%`
                        }
                    </span>
                </div>
            ))}
        </div>
    );
};

export default KpiCards;