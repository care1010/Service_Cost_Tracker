import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import $ from 'jquery';
import 'datatables.net-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import Swal from 'sweetalert2';

const AdminPanel = () => {
    const [users, setUsers] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({ id: '', email: '', password: '', type: 'user', customers: [] });
    
    const tableRef = useRef(null);

    useEffect(() => {
        fetchUsers();
        axios.get(`${process.env.REACT_APP_API_URL}/api/data/filter-options`).then(res => setCustomers(res.data.customer));
    }, []);

    // DataTable Initialization
    useEffect(() => {
        if (users.length > 0) {
            if ($.fn.DataTable.isDataTable(tableRef.current)) {
                $(tableRef.current).DataTable().destroy();
            }

            $(tableRef.current).DataTable({
                data: users,
                columns: [
                    { 
                        title: "Email / Username", 
                        data: "email",
                        render: (data) => `<div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs">${data.charAt(0).toUpperCase()}</div>
                            <span class="font-semibold text-white">${data}</span>
                        </div>`
                    },
                    { 
                        title: "Role", 
                        data: "type",
                        render: (data) => `<span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase ring-1 ${data === 'super_admin' ? 'bg-purple-500/10 text-purple-400 ring-purple-500/30' : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'}">${data}</span>`
                    },
                    { 
                        title: "Access Control", 
                        data: "customers",
                        render: (data) => `<div class="flex flex-wrap gap-1">${data.map(c => `<span class="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[9px] border border-slate-700">${c}</span>`).join('')}</div>`
                    },
                    {
                        title: "Actions",
                        data: null,
                        render: (data, type, row) => `<div class="flex gap-2">
                            <button class="edit-btn text-blue-400 hover:text-white" data-id="${row.id}">✏️</button>
                            <button class="delete-btn text-rose-400 hover:text-white" data-id="${row.id}" data-email="${row.email}">🗑️</button>
                        </div>`
                    }
                ],
                destroy: true,
                drawCallback: function() {
                    $('.edit-btn').on('click', function() {
                        const userToEdit = users.find(u => u.id == $(this).data('id'));
                        if(userToEdit) { setEditMode(true); setFormData(userToEdit); setShowModal(true); }
                    });
                    $('.delete-btn').on('click', function() {
                        handleDelete($(this).data('id'), $(this).data('email'));
                    });
                }
            });
        }
    }, [users]);

    const fetchUsers = async () => {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/data/admin/users`);
        setUsers(res.data);
    };

    const generatePassword = () => setFormData({ ...formData, password: Math.random().toString(36).slice(-10) });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode) await axios.post(`${process.env.REACT_APP_API_URL}/api/data/admin/update-user`, formData);
            else await axios.post(`${process.env.REACT_APP_API_URL}/api/data/admin/create-user`, formData);
            Swal.fire({ icon: 'success', title: 'Saved!', timer: 1500, showConfirmButton: false });
            setShowModal(false);
            fetchUsers();
        } catch (err) { Swal.fire('Error', 'Failed', 'error'); }
    };

    const handleDelete = (id, email) => {
        Swal.fire({
            title: 'Are you sure?',
            text: `Delete ${email}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete!',
            background: '#0f172a',
            color: '#fff'
        }).then(async (result) => {
            if (result.isConfirmed) {
                await axios.delete(`${process.env.REACT_APP_API_URL}/api/data/admin/delete-user?id=${id}&email=${email}`);
                fetchUsers();
                Swal.fire('Deleted!', '', 'success');
            }
        });
    };

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">User <span className="text-blue-600">Management</span></h1>
                <button onClick={() => { setEditMode(false); setFormData({email:'', password:'', type:'user', customers:[]}); setShowModal(true); }}
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-black transition-all">
                    ➕ Create User
                </button>
            </div>

            <div className="bg-slate-900 rounded-[2rem] shadow-2xl p-6 border border-slate-800 admin-dt-wrapper">
                <table ref={tableRef} className="display nowrap w-full text-slate-300"></table>
            </div>

            {/* Modal (Same as before) */}
            {showModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden">
                        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
                            <h2 className="text-2xl font-black text-white">{editMode ? 'Edit User' : 'Create User'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <input type="email" disabled={editMode} className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Email" required />
                                <select className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                    <option value="super_admin">Super Admin</option>
                                </select>
                            </div>

                            // edit user model
                            {!editMode && (
                                <div className="flex gap-2">
                                    <input type="text" className="flex-1 p-3 rounded-xl bg-slate-950 border border-slate-800 text-blue-400 font-mono" value={formData.password} readOnly placeholder="Password" required={!editMode} />
                                    <button type="button" onClick={generatePassword} className="bg-blue-600 text-white px-4 rounded-xl font-bold text-xs">Generate</button>
                                </div>
                            )}
                            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 max-h-48 overflow-y-auto">
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Customer Access</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {customers.map(c => (
                                        <label key={c} className="flex items-center gap-3 text-xs text-slate-400 cursor-pointer">
                                            <input type="checkbox" checked={formData.customers.includes(c)} onChange={() => {
                                                const current = [...formData.customers];
                                                const idx = current.indexOf(c);
                                                if (idx > -1) current.splice(idx, 1); else current.push(c);
                                                setFormData({ ...formData, customers: current });
                                            }} /> {c}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold">Save User</button>
                                <button type="button" onClick={() => setShowModal(false)} className="px-8 bg-slate-800 text-slate-400 py-4 rounded-2xl font-bold">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;