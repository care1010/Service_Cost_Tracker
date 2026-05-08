import React from 'react';

const KpiCards = ({ data }) => {
    const cards = [
        { label: 'ASBL SM %', value: data?.asbl_sm || '0.00', color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'PTD SM %', value: data?.ptd_sm || '0.00', color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'EAC SM %', value: data?.eac_sm || '0.00', color: 'text-purple-600', bg: 'bg-purple-50' },
    ];

    return (
        <div className="grid grid-cols-3 gap-4 h-full">
            {cards.map((card, i) => (
                <div
                    key={i}
                    className="group bg-white p-4 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-center relative overflow-hidden transition-transform duration-300 hover:scale-105"
                >
                    <div className={`absolute -right-2 -top-2 w-12 h-12 rounded-full ${card.bg} opacity-40`}></div>
                    <span className="text-grey-400 text-[13px] font-bold uppercase tracking-widest mb-1">
                        {card.label}
                    </span>
                    <span className={`text-2xl font-black ${card.color}`}>
                        {card.value}%
                    </span>
                </div>
            ))}
        </div>
    );
};

export default KpiCards;