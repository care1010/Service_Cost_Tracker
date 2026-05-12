import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post('http://localhost:5000/api/data/login', { email, password });
            // User data ko browser mein save karein
            localStorage.setItem('user', JSON.stringify(res.data.user));
            onLoginSuccess(res.data.user);
        } catch (err) {
            alert(err.response?.data?.error || "Login Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a192f] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">
                
                {/* LEFT SIDE: IMAGE/GRADIENT */}
                <div className="md:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-900 p-12 flex flex-col justify-center text-white relative">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                    <div className="relative z-10">
                        <h2 className="text-4xl font-black mb-4 leading-tight">Welcome to <br/>NI INDIA Financial Services Cost Tracker Platform</h2>
                        <p className="text-blue-100 text-sm leading-relaxed opacity-80">
                            Manage project financials, analyze margins, and automate your workflow with our advanced BI platform.
                        </p>
                    </div>
                    <div className="mt-20 relative z-10">
                        <div className="flex -space-x-2">
                            {[1,2,3,4].map(i => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-blue-400 flex items-center justify-center text-[10px] font-bold">U{i}</div>
                            ))}
                        </div>
                        <p className="text-[10px] mt-2 uppercase tracking-widest font-bold text-blue-200">Trusted by Finance Teams</p>
                    </div>
                </div>

                {/* RIGHT SIDE: FORM */}
                <div className="md:w-1/2 p-12 flex flex-col justify-center bg-white">
                    <div className="mb-10">
                        <h3 className="text-2xl font-black text-slate-800">Sign In</h3>
                        <p className="text-slate-400 text-xs mt-1">Enter your credentials to access the dashboard</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email Address</label>
                            <input 
                                type="email" 
                                required
                                className="w-full p-3 mt-1 rounded-xl border border-slate-100 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="name@nokia.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
                            <input 
                                type="password" 
                                required
                                className="w-full p-3 mt-1 rounded-xl border border-slate-100 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded text-blue-600" />
                                <span className="text-[10px] text-slate-500 font-medium">Remember me</span>
                            </label>
                            <a href="#" className="text-[10px] text-blue-600 font-bold hover:underline">Forgot Password?</a>
                        </div>

                        <button 
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-sm shadow-xl transition-all active:scale-95"
                        >
                            {loading ? "Verifying..." : "Login to Dashboard →"}
                        </button>
                    </form>

                    <div className="mt-10 text-center">
                        <p className="text-[10px] text-slate-400">© 2024 Nokia Financial Services. All rights reserved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;