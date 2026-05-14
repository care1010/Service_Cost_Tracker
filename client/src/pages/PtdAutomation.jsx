import React, { useState } from 'react';
import axios from 'axios';

const PtdAutomation = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleFileChange = (e) => setFile(e.target.files[0]);

    const handleUpload = async () => {
        if (!file) return alert("Please select a file first!");
        
        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        setStatus('Processing Excel and Updating MySQL...');

        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/ptd-automation`, formData);
            alert(res.data.message);
            setStatus('Success!');
        } catch (err) {
            alert("Upload failed!");
            setStatus('Error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 bg-white rounded-3xl shadow-xl max-w-2xl mx-auto mt-10 border border-slate-100">
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <span className="bg-blue-600 p-2 rounded-xl text-white text-sm">⚙️</span>
                Upload PTD Data
            </h2>

            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-blue-400 transition-all bg-slate-50">
                <input type="file" onChange={handleFileChange} className="hidden" id="ptd-file" accept=".xlsx, .xls" />
                <label htmlFor="ptd-file" className="cursor-pointer">
                    <div className="text-4xl mb-4">📁</div>
                    <p className="text-slate-600 font-bold">{file ? file.name : "Click to select Monthly Excel File"}</p>
                    <p className="text-slate-400 text-xs mt-2">Supports .xlsx and .xls (Sheets: CJI5, CJ74)</p>
                </label>
            </div>

            <button 
                onClick={handleUpload}
                disabled={loading}
                className={`w-full mt-8 py-4 rounded-2xl font-bold text-white shadow-lg transition-all ${loading ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
            >
                {loading ? "Processing..." : "Upload"}
            </button>

            {status && <p className="mt-4 text-center text-sm font-medium text-blue-600">{status}</p>}
        </div>
    );
};

export default PtdAutomation;