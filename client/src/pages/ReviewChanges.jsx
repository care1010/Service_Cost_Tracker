import React from 'react';
import axios from 'axios';
import DataTable from '../components/DataTable';
import $ from 'jquery';
import Swal from "sweetalert2";
import { HiOutlineDownload, HiOutlineArrowLeft, HiOutlineLightningBolt} from "react-icons/hi";

const ReviewChanges = ({ onBack }) => {
    const handleFinalize = async () => {

    const pendingUpdates = [];

    $('.nc-input.is-changed').each(function () {
        pendingUpdates.push({
            loa_name: $(this).data('loa'),
            categories: $(this).data('cat'),
            value: $(this).val()
        });
    });

    const result = await Swal.fire({
        title: "Submit Data?",
        text: "This will update the main Summary View.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, Submit",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#4169e1"
    });

    if (!result.isConfirmed) return;

    Swal.fire({
        title: "Submitting Data...",
        text: "Please wait",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {

        if (pendingUpdates.length > 0) {
            await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/update-non-committed`,
                { updates: pendingUpdates }
            );
        }

        const res = await axios.post(
            `${process.env.REACT_APP_API_URL}/api/data/finalize-changes`
        );

        await Swal.fire({
            icon: "success",
            title: "Success",
            text: res.data.message
        });

        onBack();

    } catch (err) {

        Swal.fire({
            icon: "error",
            title: "Submission Failed",
            text: "Unable to finalize changes."
        });

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
        { header: 'Open Commitment (KEUR)', field: 'open_commitment' },
        // old non committed for comparison
        { header: 'Old Non Committed', field: 'non_committed_original' },
        // { header: 'Non Committed', field: 'non_committed_editable' }, // 🔥 Editable column
        { header: 'Non Committed', field: 'non_committed' },
        { header: 'EAC', field: 'eac' },
        { header: 'EAC vs ASBL', field: 'eac_vs_asbl' }
    ];

    return (
        <div className="p-6 bg-[#fcfcfd] min-h-screen">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-150">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Non-Committed Changes Summary</h2>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Showing only modified Non-Committed rows (Excluding Revenue)</p>
                </div>
                <div className="flex gap-3">

                    {/* Back */}
                    <button
                        onClick={onBack}
                        className="group text-white px-4 py-2 rounded-2xl shadow-md 
                        flex items-center gap-2 transition-all duration-300 
                        hover:scale-105 hover:shadow-xl"
                        style={{
                            background: 'linear-gradient(135deg, #64748b, #475569)',
                        }}
                    >
                        <span className="text-lg transition-transform duration-300 group-hover:-translate-x-[2px]">
                            <HiOutlineArrowLeft />
                        </span>

                        <span className="text-sm font-black">
                            Back
                        </span>
                    </button>

                    {/* Export Review */}
                    <button
                        onClick={handleExportReview}
                        className="group text-white px-4 py-2 rounded-2xl shadow-md 
                        flex items-center gap-2 transition-all duration-300 
                        hover:scale-105 hover:shadow-xl"
                        style={{
                            background: 'linear-gradient(135deg, #4169e1, #3157c9)',
                        }}
                    >
                        <span className="text-lg transition-transform duration-300 group-hover:-translate-y-[1px]">
                            <HiOutlineDownload />
                        </span>

                        <span className="text-sm font-black">
                            Export
                        </span>
                    </button>


                    {/* Finalize */}
                    <button
                        onClick={handleFinalize}
                        className="group text-white px-4 py-2 rounded-2xl shadow-md 
                        flex items-center gap-2 transition-all duration-300 
                        hover:scale-105 hover:shadow-xl"
                        style={{
                            background: 'linear-gradient(135deg, #4169e1, #3157c9)',
                        }}
                    >
                        <span className="text-lg transition-transform duration-300 group-hover:scale-110">
                            <HiOutlineLightningBolt />
                        </span>

                        <span className="text-sm font-black">
                            Submit Data
                        </span>
                    </button>


                </div>
            </div>

            <div className="rounded-[1.5rem] overflow-hidden shadow-xl border border-slate-100 bg-white">
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