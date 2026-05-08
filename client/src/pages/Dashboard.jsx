import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const Dashboard = () => {
    const [buData, setBuData] = useState([]);
    const [loaData, setLoaData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [buRes, loaRes] = await Promise.all([
                    axios.get('http://localhost:5000/api/data/analytics-bu'),
                    axios.get('http://localhost:5000/api/data/analytics-loa')
                ]);
                setBuData(buRes.data);
                setLoaData(loaRes.data);
                setLoading(false);
            } catch (err) { console.error(err); setLoading(false); }
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-10 text-center font-bold">Loading Analytics...</div>;

    return (
        <div className="p-6 space-y-10 bg-[#f8fafc] min-h-screen">
            <h1 className="text-3xl font-black text-slate-800 mb-8">Executive <span className="text-blue-600">Analytics</span></h1>

            {/* --- BU WISE VIEW (Grouped Bar Chart) --- */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                <h2 className="text-xl font-bold text-slate-700 mb-6 flex items-center gap-2">
                    <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                    Business Unit (BU) Wise Performance
                </h2>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={buData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="bu" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)'}} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '20px'}} />
                            
                            {/* 3 Bars for each BU */}
                            <Bar dataKey="asbl" name="Total ASBL" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={30} />
                            <Bar dataKey="ptd" name="Total PTD" fill="#10b981" radius={[6, 6, 0, 0]} barSize={30} />
                            <Bar dataKey="eac" name="Total EAC" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- LOA NAME WISE VIEW --- */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                <h2 className="text-xl font-bold text-slate-700 mb-6 flex items-center gap-2">
                    <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                    Top 10 Projects (LOA Name) Analysis
                </h2>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={loaData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis dataKey="loa_name" type="category" width={150} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} />
                            <Tooltip contentStyle={{borderRadius: '15px'}} />
                            <Legend />
                            <Bar dataKey="asbl" name="ASBL" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="ptd" name="PTD" fill="#34d399" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;