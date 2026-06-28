import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import $ from 'jquery';
import 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import Swal from 'sweetalert2';
import './AdminPanel.css';

const AdminPanel = ({ user }) => {
    const [users, setUsers] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({ id: '', email: '', password: '', type: 'user', customers: [] });
    
    const tableRef = useRef(null);

    // Filter available customers based on logged-in user's role (RLS)
    useEffect(() => {
        fetchUsers();
        axios.get(`${process.env.REACT_APP_API_URL}/api/data/filter-options`)
            .then(res => {
                const allCustomers = res.data.customer || [];
                if (user?.type === 'admin') {
                    // Admins can only see and map customers they themselves have access to
                    const allowed = allCustomers.filter(c => user.allowedCustomers.includes(c));
                    setCustomers(allowed);
                } else {
                    setCustomers(allCustomers);
                }
            })
            .catch(err => console.error("Error fetching customers:", err));
    }, [user]);

    // DataTable Initialization
    useEffect(() => {
        if (users.length > 0) {
            if ($.fn.DataTable.isDataTable(tableRef.current)) {
                $(tableRef.current).DataTable().destroy();
            }

            $(tableRef.current).DataTable({
                data: users,
                destroy: true,
                pageLength: 50,
                lengthMenu: [
                    [50, 100, 200, -1],
                    [50, 100, 200, "All"]
                ],
                columns: [
                    { 
                        title: "Email", 
                        data: "email",
                        render: (data) => `
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm uppercase">
                                    ${data ? data.charAt(0).toUpperCase() : ''}
                                </div>
                                <span class="font-semibold text-slate-200">${data}</span>
                            </div>
                        `
                    },
                    { 
                        title: "Role", 
                        data: "type",
                        render: (data) => `
                            <span class="px-3 py-1 rounded-lg text-[11px] font-black uppercase ring-1 ${
                                data === 'super_admin' 
                                ? 'bg-purple-500/10 text-purple-400 ring-purple-500/30' 
                                : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
                            }">
                                ${data.replace('_', ' ')}
                            </span>
                        `
                    },
                    { 
                        title: "Customer Access", 
                        data: "customers",
                        render: (data) => `
                            <div class="flex flex-wrap gap-1 max-w-md">
                                ${data && data.length > 0 
                                    ? data.map(c => `<span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[12px] border border-slate-700 font-medium">${c}</span>`).join('') 
                                    : `<span class="text-slate-500 text-xs italic">No Access</span>`
                                }
                            </div>
                        `
                    },
                    {
                        title: "Actions",
                        data: null,
                        render: (data, type, row) => `
                            <div class="flex gap-3">
                                <button class="edit-btn text-blue-400 hover:text-blue-300 transition-colors" data-id="${row.id}">
                                    ✏️ <span class="text-xs ml-1"></span>
                                </button>
                                <button class="delete-btn text-rose-400 hover:text-rose-300 transition-colors" data-id="${row.id}" data-email="${row.email}">
                                    🗑️ <span class="text-sm ml-1">Delete</span>
                                </button>
                            </div>
                        `
                    }
                ],
                destroy: true,
                drawCallback: function() {
                    $('.edit-btn').off('click').on('click', function() {
                        const userToEdit = users.find(u => u.id == $(this).data('id'));
                        if (userToEdit) { 
                            setEditMode(true); 
                            setFormData({
                                id: userToEdit.id,
                                email: userToEdit.email,
                                // password: userToEdit.password || '',
                                type: userToEdit.type || 'user',
                                customers: userToEdit.customers || []
                            }); 
                            setShowModal(true); 
                        }
                    });
                    $('.delete-btn').off('click').on('click', function() {
                        handleDelete($(this).data('id'), $(this).data('email'));
                    });
                }
            });
        }
    }, [users]);

    // Send logged-in user RLS constraints to API
    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/admin/users`, {
                params: {
                    currentUserType: user?.type,
                    allowedCustomers: user?.allowedCustomers?.join(',')
                }
            });
            setUsers(res.data);
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    };

    const generatePassword = () => {
        setFormData({ ...formData, password: Math.random().toString(36).slice(-10) });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                currentUserType: user?.type,
                allowedCustomers: user?.allowedCustomers?.join(',')
            };

            if (editMode) {
                await axios.post(`${process.env.REACT_APP_API_URL}/api/data/admin/update-user`, payload);
            } else {
                await axios.post(`${process.env.REACT_APP_API_URL}/api/data/admin/create-user`, payload);
            }
            Swal.fire({ icon: 'success', title: 'Saved successfully!', timer: 1500, showConfirmButton: false });
            setShowModal(false);
            fetchUsers();
        } catch (err) { 
            Swal.fire('Error', err.response?.data?.error || 'Failed to save changes.', 'error'); 
        }
    };

    const handleDelete = (id, email) => {
        Swal.fire({
            title: 'Are you sure?',
            text: `This will permanently delete ${email}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete!',
            background: '#0f172a',
            color: '#fff',
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#475569'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.delete(`${process.env.REACT_APP_API_URL}/api/data/admin/delete-user`, {
                        params: {
                            id,
                            email,
                            currentUserType: user?.type
                        }
                    });
                    fetchUsers();
                    Swal.fire('Deleted!', 'User has been deleted.', 'success');
                } catch (err) {
                    Swal.fire('Error', err.response?.data?.error || 'Failed to delete user.', 'error');
                }
            }
        });
    };

    const handleSelectAllCustomers = () => {
        setFormData({ ...formData, customers: [...customers] });
    };

    const handleClearAllCustomers = () => {
        setFormData({ ...formData, customers: [] });
    };

    return (
        <div className="p-6 bg-slate-950 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">
                        User <span className="text-blue-500">Management</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1"></p>
                </div>
                <button 
                    onClick={() => { 
                        setEditMode(false); 
                        setFormData({ id: '', email: '', password: '', type: 'user', customers: [] }); 
                        setShowModal(true); 
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2"
                >
                    <span className="text-white text-2xl font-bold">+</span> Create User
                </button>
            </div>

            {/* Datatable Container */}
            <div className="bg-slate-900 rounded-[2rem] shadow-2xl p-6 border border-slate-800 admin-dt-wrapper overflow-x-auto">
                <table ref={tableRef} className="display nowrap w-full text-slate-300"></table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <div>
                                <h2 className="text-2xl font-black text-white">{editMode ? 'Edit User details' : 'Create New User'}</h2>
                                
                            </div>
                            <button 
                                onClick={() => setShowModal(false)} 
                                className="text-slate-400 hover:text-white text-3xl transition-colors font-light"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Email & Role Input Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[12px] font-bold text-slate-200 uppercase tracking-wider mb-2 block">Email Address</label>
                                    <input 
                                        type="email" 
                                        disabled={editMode} 
                                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})} 
                                        placeholder="email@nokia.com" 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="text-[12px] font-bold text-slate-200 uppercase tracking-wider mb-2 block">System Role</label>
                                    <select 
                                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-blue-500 transition-colors" 
                                        value={formData.type} 
                                        onChange={e => setFormData({...formData, type: e.target.value})}
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                        
                                        {/* Super Admin logged-in user ko naya Super Admin create karne ka complete access deta hai */}
                                        {(user?.type === 'super_admin' || user?.type === 'super_admin') && (
                                            <option value="super_admin">Super Admin</option>
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Password input row */}
                            <div>
                                <label className="text-[12px] font-bold text-slate-200 uppercase tracking-wider mb-2 block">Password</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        className="flex-1 p-3 rounded-xl bg-slate-950 border border-slate-800 text-blue-400 font-mono text-sm outline-none focus:border-blue-500 transition-colors" 
                                        value={formData.password} 
                                        onChange={e => setFormData({...formData, password: e.target.value})} 
                                        placeholder="Enter password or auto-generate" 
                                        required 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={generatePassword} 
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl font-bold text-xs tracking-wider transition-colors uppercase"
                                    >
                                        Generate
                                    </button>
                                </div>
                            </div>

                            {/* Customer Access Row */}
                            <div className="p-5 bg-slate-950 rounded-2xl border border-slate-800 min-h-[450px]">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <p className="text-[12px] font-bold text-slate-200 uppercase tracking-wider">Customer Access</p>
                                        
                                    </div>
                                    <div className="flex gap-3">
                                        <button 
                                            type="button" 
                                            onClick={handleSelectAllCustomers}
                                            className="text-[12px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            Select All
                                        </button>
                                        <div className="w-[1px] h-3 bg-slate-800"></div>
                                        <button 
                                            type="button" 
                                            onClick={handleClearAllCustomers}
                                            className="text-[12px] font-bold text-rose-400 hover:text-rose-300 transition-colors"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[340px] overflow-y-auto pr-2">
                                    {customers.length > 0 ? (
                                        customers.map(c => (
                                            <label 
                                                key={c} 
                                                className="flex items-center gap-3 text-sm text-slate-300 hover:text-white cursor-pointer select-none py-1"
                                            >
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-800 text-blue-600 focus:ring-blue-500 bg-slate-900 cursor-pointer"
                                                    checked={formData.customers.includes(c)} 
                                                    onChange={() => {
                                                        const current = [...formData.customers];
                                                        const idx = current.indexOf(c);
                                                        if (idx > -1) {
                                                            current.splice(idx, 1); 
                                                        } else {
                                                            current.push(c);
                                                        }
                                                        setFormData({ ...formData, customers: current });
                                                    }} 
                                                /> 
                                                <span className="truncate">{c}</span>
                                            </label>
                                        ))
                                    ) : (
                                        <p className="text-slate-600 text-xs italic col-span-2">No customers found.</p>
                                    )}
                                </div>
                            </div>

                            {/* Modal Action Buttons */}
                            <div className="flex gap-4 pt-2">
                                <button 
                                    type="submit" 
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-900/10"
                                >
                                    {editMode ? 'Update User' : 'Create New User'}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setShowModal(false)} 
                                    className="px-8 bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 rounded-2xl font-bold transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;