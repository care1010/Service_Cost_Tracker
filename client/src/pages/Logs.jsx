import React, { useEffect, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const Logs = () => {

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showPending, setShowPending] = useState(false);
    const [pendingUsers, setPendingUsers] = useState([]);

    const [logSearch, setLogSearch] = useState('');
    const [pendingSearch, setPendingSearch] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {

            const res = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/data/user-activity-logs`
            );

            setLogs(res.data);

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingUsers = async () => {
        try {

            const res = await axios.get(
                `${process.env.REACT_APP_API_URL}/api/data/pending-users`
            );

            setPendingUsers(res.data);
            setShowPending(true);

        } catch (err) {
            console.error(err);
        }
    };

    const filteredLogs = logs.filter((row) =>
        Object.values(row).some((value) =>
            String(value)
                .toLowerCase()
                .includes(logSearch.toLowerCase())
        )
    );

    const filteredPendingUsers = pendingUsers.filter((user) =>
        `${user.email} ${user.type}`
            .toLowerCase()
            .includes(pendingSearch.toLowerCase())
    );

    const exportLogsToExcel = () => {

        const exportData = logs.map(row => ({
            User: row.user_email,
            BU: row.bu,
            Customer: row.customer,
            LOA: row.loa_name,
            LOA_ID: row.loa_id,
            Category: row.categories,
            Old_Value: row.old_value,
            New_Value: row.new_value,
            Month: row.month_year,
            Time: new Date(row.created_at).toLocaleString()
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            'User Logs'
        );

        const excelBuffer = XLSX.write(
            workbook,
            {
                bookType: 'xlsx',
                type: 'array'
            }
        );

        const file = new Blob(
            [excelBuffer],
            {
                type:
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );

        saveAs(
            file,
            `User_Logs_${new Date().toISOString().split('T')[0]}.xlsx`
        );
    };

    const exportPendingUsers = () => {

        const exportData = pendingUsers.map(user => ({
            Email: user.email,
            Role: user.type
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            'Pending Users'
        );

        const excelBuffer = XLSX.write(
            workbook,
            {
                bookType: 'xlsx',
                type: 'array'
            }
        );

        const file = new Blob(
            [excelBuffer],
            {
                type:
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        );

        saveAs(
            file,
            `Pending_Users_${new Date().toISOString().split('T')[0]}.xlsx`
        );
    };

    return (
        <div className="p-6">

            <div className="bg-white rounded-[2rem] shadow-lg p-6">

                {/* Header */}
                <div className="flex justify-between items-center mb-6">

                    <h1 className="text-3xl font-black text-slate-800">
                        User Activity Logs
                    </h1>

                    <div className="flex gap-3 mr-8">

                        <button
                            onClick={exportLogsToExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-lg font-bold text-sm"
                        >
                            Export Logs
                        </button>

                        <button
                            onClick={fetchPendingUsers}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg font-semibold text-sm"
                        >
                            Pending Users
                        </button>

                        <div className="mb-4">

                            <input
                                type="text"
                                placeholder="Search Logs..."
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                                className="w-full md:w-96 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                            />

                        </div>

                    </div>

                </div>

                {/* Pending Users Modal */}
                {showPending && (

                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">

                        <div className="bg-white rounded-[2rem] p-6 w-full max-w-4xl shadow-2xl">

                            <div className="flex justify-between items-center mb-6">

                                <h2 className="text-2xl font-black text-red-700">
                                    Pending Users
                                </h2>

                                <button
                                    onClick={() => setShowPending(false)}
                                    className="text-3xl font-bold"
                                >
                                    ×
                                </button>

                            </div>

                            <div className="flex justify-end items-start mb-1 mr-8 gap-4">

                                <button
                                    onClick={exportPendingUsers}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 h-12 rounded-lg text-sm font-semibold"
                                >
                                    Export Excel
                                </button>

                                <div className="mb-4 ml-4">

                                    <input
                                        type="text"
                                        placeholder="Search Pending Users..."
                                        value={pendingSearch}
                                        onChange={(e) => setPendingSearch(e.target.value)}
                                        className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-red-500"
                                    />

                                </div>

                            </div>

                            {pendingUsers.length === 0 ? (

                                <div className="text-center py-10 text-green-700 text-xl font-bold">
                                    ✅ All users have submitted data this month
                                </div>

                            ) : (

                                <div className="overflow-auto max-h-[500px]">

                                    <table className="w-full">

                                        <thead>

                                            <tr className="bg-red-100">

                                                <th className="p-3 text-left">
                                                    Email
                                                </th>

                                                <th className="p-3 text-left">
                                                    Role
                                                </th>

                                            </tr>

                                        </thead>

                                        <tbody>

                                            {filteredPendingUsers.map((user, index) => (

                                                <tr
                                                    key={index}
                                                    className="border-b hover:bg-slate-50"
                                                >

                                                    <td className="p-3">
                                                        {user.email}
                                                    </td>

                                                    <td className="p-3 uppercase">
                                                        {user.type}
                                                    </td>

                                                </tr>

                                            ))}

                                        </tbody>

                                    </table>

                                </div>

                            )}

                        </div>

                    </div>

                )}

                {/* Logs Table */}

                {loading ? (

                    <div className="text-center py-10 text-lg">
                        Loading...
                    </div>

                ) : (

                    <div className="overflow-auto">

                        <table className="w-full border-collapse">

                            <thead>

                                <tr className="bg-slate-100">

                                    <th className="p-3 text-left">
                                        BU
                                    </th>

                                    <th className="p-3 text-left">
                                        Customer
                                    </th>

                                    <th className="p-3 text-left">
                                        LOA Name
                                    </th>

                                    <th className="p-3 text-left">
                                        LOA ID
                                    </th>

                                    <th className="p-3 text-left">
                                        Categories
                                    </th>

                                    <th className="p-3 text-left">
                                        Old Non Committed Value
                                    </th>

                                    <th className="p-3 text-left">
                                        New Non Committed Value
                                    </th>

                                    <th className="p-3 text-left">
                                        Month
                                    </th>

                                    <th className="p-3 text-left">
                                        User
                                    </th>

                                    <th className="p-3 text-left">
                                        Updated At
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                {filteredLogs.map((row) => (

                                    <tr
                                        key={row.id}
                                        className="border-b hover:bg-slate-50"
                                    >

                                        <td className="p-3">
                                            {row.bu}
                                        </td>

                                        <td className="p-3">
                                            {row.customer}
                                        </td>

                                        <td className="p-3">
                                            {row.loa_name}
                                        </td>

                                        <td className="p-3">
                                            {row.loa_id}
                                        </td>

                                        <td className="p-3">
                                            {row.categories}
                                        </td>

                                        <td className="p-3">
                                            {row.old_value}
                                        </td>

                                        <td className="p-3 text-green-600 font-bold">
                                            {row.new_value}
                                        </td>

                                        <td className="p-3">
                                            {row.month_year}
                                        </td>

                                        <td className="p-3">
                                            {row.user_email}
                                        </td>

                                        <td className="p-3">
                                            {new Date(
                                                row.created_at
                                            ).toLocaleString()}
                                        </td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>

                    </div>

                )}

            </div>

        </div>
    );
};

export default Logs;