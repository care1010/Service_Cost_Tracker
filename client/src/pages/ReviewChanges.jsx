import React from 'react';
import axios from 'axios';
import DataTable from '../components/DataTable';
import $ from 'jquery';

const ReviewChanges = ({ onBack }) => {
    const handleFinalize = async () => {
    // 1. Pehle check karein ki kya Review page par koi unsaved input hai?
    const pendingUpdates = [];
    $('.nc-input.is-changed').each(function() {
        pendingUpdates.push({
            loa_name: $(this).data('loa'),
            categories: $(this).data('cat'),
            value: $(this).val()
        });
    });

    if (pendingUpdates.length > 0) {
        // Agar user ne review page par kuch badla hai, toh pehle use Draft mein save karein
        await axios.post(`${process.env.REACT_APP_API_URL}/api/data/update-non-committed`, { updates: pendingUpdates });
    }

    if (!window.confirm("Finalize all changes? This will update the main Summary View.")) return;

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/data/finalize-changes`);
        alert(res.data.message);
        onBack(); // Wapas Summary View par jayein
    } catch (err) {
        alert("Finalize failed");
    }
};

    // 🔥 2. Export Review Function (Jo missing tha)
    const handleExportReview = () => {
        window.location.href = `${process.env.REACT_APP_API_URL}/api/data/export-review`;
    };

    // Same columns as SummaryView
    const tableColumns = [
        { header: 'BU', field: 'bu' },
        { header: 'Customer', field: 'customer' },
        { header: 'LOA Name', field: 'loa_name' },
        { header: 'LOA ID', field: 'loa_id' },
        { header: 'Cost/Revenue', field: 'cost_revenue' },
        { header: 'Category', field: 'categories' },
        { header: 'ASBL', field: 'asbl' },
        { header: 'ASBL LOA', field: 'asbl_loa' },
        { header: 'PTD', field: 'ptd' },
        { header: 'Open Com.', field: 'open_commitment' },
        // old non committed for comparison
        { header: 'Old Non Committed', field: 'non_committed_original' },
        // { header: 'Non Committed', field: 'non_committed_editable' }, // 🔥 Editable column
        { header: 'Non Committed', field: 'non_committed' },
        { header: 'EAC', field: 'eac' },
        { header: 'EAC vs ASBL', field: 'eac_vs_asbl' }
    ];

    return (
        <div className="p-6 bg-[#fcfcfd] min-h-screen">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[2rem] shadow-sm border border-orange-100">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Review <span className="text-orange-500">Draft Changes</span></h2>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Showing only modified rows (Excluding Revenue)</p>
                </div>
                <div className="flex gap-3">
                    {/* 🔥 Naya Export Button */}
                    <button onClick={handleExportReview} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold text-xs shadow-lg">📥 Export Review</button>
                    <button onClick={onBack} className="px-6 py-2 rounded-xl font-bold text-xs bg-slate-100 text-slate-500">Back</button>
                    <button onClick={handleFinalize} className="px-8 py-2 rounded-xl font-bold text-xs bg-orange-500 text-white shadow-lg">🚀 Finalize & Save</button>
                </div>
            </div>

            <div className="rounded-[1.5rem] overflow-hidden shadow-xl border border-white bg-white">
                <DataTable 
                    title="" 
                    columns={tableColumns} 
                    apiUrl={`${process.env.REACT_APP_API_URL}/api/data/review-changes`} 
                    filters={{}} 
                    onKpiUpdate={() => {}} // Dummy function to prevent error
                    showSaveButton={false} // Save button chhupaya
                    showClearButton={true} // Clear button dikhaya
                />
            </div>
        </div>
    );
};

export default ReviewChanges;