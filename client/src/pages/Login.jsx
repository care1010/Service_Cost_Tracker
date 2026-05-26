import React, { useState } from 'react';
import axios from 'axios';
import loginImage from '../assets/Login.png';
import companyLogo from '../assets/OIP.jpg';

const Login = ({ onLoginSuccess }) => {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {

            const res = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/login`,
                { email, password }
            );

            const storage = rememberMe ? localStorage : sessionStorage;

            storage.setItem('user', JSON.stringify(res.data.user));

            onLoginSuccess(res.data.user);

        } catch (err) {

            alert(err.response?.data?.error || "Login Failed");

        } finally {

            setLoading(false);
        }
    };

    return (

        <div className="min-h-screen flex font-['DM_Sans']">

            {/* LEFT PANEL */}
            <div
                className="hidden md:flex md:w-[55%] relative items-center justify-center px-10"
                style={{
                    background: 'linear-gradient(135deg, #ddeeff, #c8e0fb)',
                }}
            >

                {/* LOGO */}
                <div className="absolute top-8 left-8">
                    <img
                        src={companyLogo}
                        alt="Company Logo"
                        className="w-20 object-contain"
                    />
                </div>

                <div className="text-center max-w-lg">

                    <img
                        src={loginImage}
                        alt="Login Illustration"
                        className="w-full max-w-[350px] mx-auto mb-6"
                    />

                    <p className="text-[#557ca3] text-base">
                        Trusted by Finance Team
                    </p>

                    <h2 className="text-[30px] font-black text-slate-800 mt-3 leading-tight">
                        Service Cost Tracker Platform
                    </h2>

                    <p className="text-slate-500 text-sm mt-5 leading-relaxed">
                        Manage project financials, analyze margins,
                        and automate workflows with an advanced BI dashboard.
                    </p>
                </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="w-full md:w-[45%] bg-white flex flex-col justify-between px-8 md:px-14 py-10">

                {/* FORM */}
                <div className="w-full max-w-md mx-auto flex flex-col justify-center h-full">

                    <div className="mb-10">

                        <h1 className="text-4xl font-black text-slate-800 mb-2">
                            Welcome
                        </h1>

                        <p className="text-slate-500 text-sm">
                            Sign into your account.
                        </p>

                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* EMAIL */}
                        <div>

                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                Email Address
                            </label>

                            <input
                                type="email"
                                required
                                placeholder="user@nokia.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full mt-2 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />

                        </div>

                        {/* PASSWORD */}
                        <div>

                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                Password
                            </label>

                            <div className="relative mt-2">

                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3 pr-12 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2"
                                >

                                    {showPassword ? (

                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="#64748b"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-5.94" />
                                            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-2.16 3.19" />
                                            <path d="M1 1l22 22" />
                                            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                                        </svg>

                                    ) : (

                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="#64748b"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>

                                    )}

                                </button>

                            </div>

                        </div>

                        {/* REMEMBER */}
                        <div className="flex items-center justify-between px-1">

                            <label className="flex items-center gap-2 cursor-pointer">

                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="rounded text-blue-600"
                                />

                                <span className="text-xs text-slate-500 font-medium">
                                    Remember me
                                </span>

                            </label>

                            <button
                                type="button"
                                className="text-xs text-blue-600 font-bold hover:underline"
                            >
                                Forgot Password?
                            </button>

                        </div>

                        {/* BUTTON */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-sm shadow-xl transition-all active:scale-95"
                        >

                            {loading ? "Signing in..." : "Login to Dashboard →"}

                        </button>

                    </form>

                </div>

                {/* FOOTER */}
                <div className="text-center pt-8">

                    <p className="text-[11px] text-slate-400">
                        ©2026 Nokia all rights reserved
                    </p>

                </div>

            </div>

        </div>
    );
};

export default Login;