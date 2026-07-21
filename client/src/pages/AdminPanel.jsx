import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import $ from 'jquery';
import 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import Swal from 'sweetalert2';
import './AdminPanel.css';
import { HiOutlineUserAdd, HiOutlineTrash, HiOutlinePencilAlt, HiOutlineShieldCheck, HiOutlineRefresh } from "react-icons/hi";

const AdminPanel = ({ user }) => {
    const [users, setUsers] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({ id: '', email: '', password: '', type: 'user', customers: [] });
    
    const tableRef = useRef(null);

    // 1. Fetch data on load
    useEffect(() => {
        fetchUsers();
        fetchCustomerOptions();
    }, [user]);

    const fetchCustomerOptions = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/filter-options`);
            const allCustomers = res.data.customer || [];
            
            // 🔥 RLS: Admin sirf wahi customer assign kar sakta hai jiski access uske paas khud hai
            if (user?.type === 'admin') {
                const allowed = allCustomers.filter(c => user.allowedCustomers.includes(c));
                setCustomers(allowed);
            } else {
                setCustomers(allCustomers);
            }
        } catch (err) {
            console.error("Error fetching customers:", err);
        }
    };

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

    // 2. DataTable Logic
    useEffect(() => {
        if (users.length >= 0) {
            const table = $(tableRef.current).DataTable({
                data: users,
                destroy: true,
                pageLength: 25,
                columns: [
                    { 
                        title: "Email", 
                        data: "email",
                        render: (data) => `<div class="font-bold text-slate-200">${data}</div>`
                    },
                    { 
                        title: "System Role", 
                        data: "type",
                        render: (data) => `
                            <span class="px-2 py-1 rounded text-[10px] font-black uppercase ring-1 ${
                                data === 'super_admin' ? 'bg-purple-500/10 text-purple-400 ring-purple-500/30' : 'bg-blue-500/10 text-blue-400 ring-blue-500/30'
                            }">
                                ${data.replace('_', ' ')}
                            </span>`
                    },
                    { 
                        title: "Customer Access", 
                        data: "customers",
                        render: (data) => `
                            <div class="flex flex-wrap gap-1 max-w-sm">
                                ${data && data.length > 0 
                                    ? data.map(c => `<span class="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[11px] border border-slate-700">${c}</span>`).join('') 
                                    : '<span class="text-slate-600 text-xs italic">No Access</span>'}
                            </div>`
                    },
                    {
                        title: "Actions",
                        data: null,
                        render: (data, type, row) => {
                            // 🔥 SELF-DELETE PROTECTION: Current user cannot delete themselves
                            const isSelf = row.email === user?.email;
                            return `
                            <div class="flex gap-4">
                                <button class="edit-btn text-blue-400 hover:text-blue-200 transition-all cursor-pointer" data-id="${row.id}">
                                    EDIT
                                </button>
                                ${!isSelf ? `
                                    <button class="delete-btn text-rose-500 hover:text-rose-300 transition-all cursor-pointer" data-id="${row.id}" data-email="${row.email}">
                                        DELETE
                                    </button>
                                ` : `<span class="text-slate-500 text-[10px] font-bold uppercase italic">Current User</span>`}
                            </div>`;
                        }
                    }
                ],
                drawCallback: function() {
                    $('.edit-btn').off('click').on('click', function() {
                        const u = users.find(x => x.id == $(this).data('id'));
                        if (u) {
                            setEditMode(true);
                            setFormData({ id: u.id, email: u.email, password: '', type: u.type, customers: u.customers || [] });
                            setShowModal(true);
                        }
                    });
                    $('.delete-btn').off('click').on('click', function() {
                        handleDelete($(this).data('id'), $(this).data('email'));
                    });
                }
            });
            return () => table.destroy();
        }
    }, [users, user]);

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
            
            Swal.fire({ icon: 'success', title: 'User permissions updated!', timer: 2000, showConfirmButton: false });
            setShowModal(false);
            fetchUsers();
        } catch (err) {
            Swal.fire('Error', err.response?.data?.error || 'Action failed', 'error');
        }
    };

    const handleDelete = (id, email) => {
        Swal.fire({
            title: 'Confirm Deletion',
            text: `Are you sure you want to remove ${email}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#475569',
            background: '#0f172a',
            color: '#fff'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await axios.delete(`${process.env.REACT_APP_API_URL}/api/data/admin/delete-user`, {
                        params: { id, email, currentUserType: user?.type }
                    });
                    fetchUsers();
                    Swal.fire('Deleted!', 'User has been removed from system.', 'success');
                } catch (err) {
                    Swal.fire('Error', err.response?.data?.error || 'Delete failed', 'error');
                }
            }
        });
    };

    return (
        <div className="p-6 bg-slate-950 min-h-screen font-sans">
            {/* Top Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                        <HiOutlineShieldCheck className="text-blue-500" />
                        Access <span className="text-blue-500">Management</span>
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Control user roles and customer boundaries</p>
                </div>
                <button 
                    onClick={() => { 
                        setEditMode(false); 
                        setFormData({ id: '', email: '', password: '', type: 'user', customers: [] }); 
                        setShowModal(true); 
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-900/20 transition-all flex items-center gap-2"
                >
                    <HiOutlineUserAdd className="text-lg" /> Create New User
                </button>
            </div>

            {/* Table Container */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl">
                <table ref={tableRef} className="display nowrap w-full"></table>
            </div>

            {/* User Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                            <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                                {editMode ? 'Edit User Permissions' : 'Configure New User'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white text-3xl font-light">&times;</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Login Email</label>
                                    <input 
                                        type="email" disabled={editMode} 
                                        className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-blue-500 transition-all disabled:opacity-30" 
                                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="user@nokia.com" required 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Assigned Role</label>
                                    <select 
                                        className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-white outline-none focus:border-blue-500 transition-all" 
                                        value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}
                                    >
                                        <option value="user">User (View Only)</option>
                                        <option value="admin">Admin (Editor)</option>
                                        {user?.type === 'super_admin' && <option value="super_admin">Super Admin</option>}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">
                                    Account Password {editMode && <span className="text-blue-500 font-normal">(Leave blank to keep current)</span>}
                                </label>
                                <input 
                                    type="text" 
                                    className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-blue-400 font-mono outline-none focus:border-blue-500" 
                                    value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} 
                                    placeholder={editMode ? "Enter only to change..." : "Assign a password"} required={!editMode} 
                                />
                            </div>

                            <div className="p-6 bg-slate-950 rounded-3xl border border-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assign Customer Access</p>
                                    <div className="flex gap-4">
                                        <button type="button" onClick={() => setFormData({...formData, customers: [...customers]})} className="text-[10px] font-black text-blue-500 hover:text-blue-300 uppercase">Select All</button>
                                        <button type="button" onClick={() => setFormData({...formData, customers: []})} className="text-[10px] font-black text-rose-500 hover:text-rose-300 uppercase">Clear</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto custom-scrollbar pr-2">
                                    {customers.map(c => (
                                        <label key={c} className="flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-600 transition-all">
                                            <input 
                                                type="checkbox" className="w-4 h-4 rounded border-slate-700 text-blue-600 bg-slate-950"
                                                checked={formData.customers.includes(c)} 
                                                onChange={() => {
                                                    const next = formData.customers.includes(c) ? formData.customers.filter(x => x !== c) : [...formData.customers, c];
                                                    setFormData({ ...formData, customers: next });
                                                }} 
                                            /> 
                                            <span className="text-xs text-slate-300 truncate">{c}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl shadow-blue-900/20">
                                    {editMode ? 'Update Account' : 'Initialize Account'}
                                </button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-10 bg-slate-800 hover:bg-slate-700 text-slate-400 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest transition-all">
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