import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const PtdAutomation = () => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const handleFileChange = (e) => setFile(e.target.files[0]);

    const handleDownloadTemplate = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/download-ptd-template`;
    };

    const handleUpload = async () => {

        if (!file) {
            return Swal.fire({
                icon: 'warning',
                title: 'No File Selected',
                text: 'Please select a file first!',
                confirmButtonColor: '#2563eb'
            });
        }

        const confirm = await Swal.fire({
            title: 'Upload PTD File?',
            text: 'This will process the Excel file and update MySQL data.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Upload',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#6b7280'
        });

        if (!confirm.isConfirmed) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        Swal.fire({
            title: 'Processing File...',
            html: `
                <div style="margin-top:10px">
                    Processing Excel and Updating MySQL...
                </div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {

            const res = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/ptd-automation`,
                formData
            );

            Swal.close();
            await Swal.fire({
                icon: 'success',
                title: 'Upload Successful',
                text: res.data.message,
                confirmButtonColor: '#16a34a'
            });

            setStatus('Success!');
            setFile(null);

            // file input reset
            document.getElementById('ptd-file').value = '';

        } catch (err) {
            Swal.close();

            Swal.fire({
                icon: 'error',
                title: 'Upload Failed!',
                text:
                    err.response?.data?.error ||
                    'An error occurred while uploading the file.',
                confirmButtonColor: '#dc2626'
            });

            setStatus('Error occurred.');

        } finally {

            setLoading(false);

        }
    };

    return (
        <div className="p-8 bg-white rounded-3xl shadow-xl max-w-4xl mx-auto mt-10 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <span className="bg-blue-600 p-2 rounded-xl text-white text-sm">
                        ⚙️
                    </span>

                    <h2 className="text-2xl font-black text-slate-800">
                        Upload PTD Data
                    </h2>
                </div>

                <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-100 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 active:scale-95"
                >
                    📥 Export Template
                </button>
            </div>
            <p className="text-slate-600 text-base mt-2 mb-7">NOTE: If any error occurred while uploading the PTD data, please refer to the template provided to avoid mismatch of column headers. </p>

            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-blue-400 transition-all bg-slate-50">
                <input type="file" onChange={handleFileChange} className="hidden" id="ptd-file" accept=".xlsx, .xls" />
                <label htmlFor="ptd-file" className="cursor-pointer">
                    <div className="text-4xl mb-4">📁</div>
                    <p className="text-slate-600 font-bold">{file ? file.name : "Click to select Monthly Excel File"}</p>
                    <p className="text-slate-400 text-xs mt-2">Supports .xlsx (Sheets: CJI5, CJ74)</p>
                </label>
            </div>

            <button
                onClick={handleUpload}
                disabled={loading}
                className={`mt-8 w-[30%] mx-auto block py-4 rounded-2xl font-bold text-white shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95
                ${loading 
                    ? 'bg-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                }`}
            >
                {loading ? "Processing..." : "Upload"}
            </button>

            {status && <p className="mt-4 text-center text-sm font-medium text-blue-600">{status}</p>}
        </div>
    );
};

export default PtdAutomation;