import React, { useState, useEffect, useRef } from 'react';
import $ from 'jquery';
import axios from 'axios';
import 'datatables.net-dt';
import 'datatables.net-rowgroup-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import './DataTable.css';
import { HiOutlineSave } from "react-icons/hi";
import Swal from 'sweetalert2';
import { HiOutlineTrash } from "react-icons/hi";
import { useNavigate } from 'react-router-dom';

const DataTable = ({ title, columns, apiUrl, filters, onKpiUpdate, showSaveButton = true, showClearButton = false, collapseView = false, user }) => {
    const tableRef = useRef(null);
    const dataTableInstance = useRef(null);
    const navigate = useNavigate();

    // 1. Keep track of filters using a Ref to bypass React closure limitations inside Datatables
    const filtersRef = useRef(filters);
    const [canSave, setCanSave] = useState(false);

    // 🔥 Sync the ref with the latest filters state whenever it updates
    useEffect(() => {
        filtersRef.current = filters;
    }, [filters]);

    const handleClear = async () => {
        const result = await Swal.fire({
            title: "Clear All Draft Changes?",
            text: "This will reset ALL your unsaved edits.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Yes, Clear All the changes",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#6b7280",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        Swal.fire({
            title: "Clearing Draft...",
            text: "Please wait",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            await axios.post(`${process.env.REACT_APP_API_URL}/api/data/clear-draft`);
            await Swal.fire({
                icon: "success",
                title: "Draft Cleared",
                text: "All unsaved changes have been removed."
            });

            if (dataTableInstance.current) {
                dataTableInstance.current.ajax.reload();
            }
        } catch (err) {
            Swal.fire({
                icon: "error",
                title: "Clear Failed",
                text: "Unable to clear draft changes."
            });
        }
    };

    const fmt = (val) => {
        if (val === null || val === undefined || val === '') {
            return '';
        }
        const num = Number(val);
        if (isNaN(num)) {
            return '';
        }
        return num.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const calculateSum = (rows, field) => {
        return rows.data().pluck(field).reduce((a, b) => a + (parseFloat(b) || 0), 0);
    };

    const handleSave = async () => {
    const updates = [];
    
    // 🔥 changed-rows ko loop karein
    $('.nc-input.is-changed').each(function () {
        const val = $(this).val();
        const loa = $(this).data('loa');
        const cat = $(this).data('cat');
        const wType = $(this).data('wbstype'); // 🔥 data-wbstype se value uthayi

        // Console mein check karein ki value aa rahi hai ya nahi
        console.log("Collecting data to save:", { loa, cat, wType, val });

        updates.push({
            loa_name: loa,
            categories: cat,
            wbs_type: wType, // 🔥 Backend ko ab 'undefined' nahi jayega
            value: val
        });
    });

    if (updates.length === 0) {
        return Swal.fire("Info", "No changes to save.", "info");
    }

        const result = await Swal.fire({
            title: "Save Changes?",
            text: `You have ${updates.length} modified records.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Save",
            cancelButtonText: "Cancel",
            confirmButtonColor: "#4682b4"
        });

        if (!result.isConfirmed) return;

        Swal.fire({
            title: "Saving...",
            text: "Please wait while changes are being saved.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            await axios.post(
                `${process.env.REACT_APP_API_URL}/api/data/update-non-committed`,
                {
                    updates,
                    createdBy: user?.name || user?.username || user?.email || 'Unknown User'
                }
            );

            await Swal.fire({
                icon: "success",
                title: "Saved Successfully",
                text: "Changes have been saved to Draft."
            });

            setCanSave(false);
            $('.nc-input').removeClass('is-changed').css('border-color', '#e2e8f0');

            if (dataTableInstance.current) {
                dataTableInstance.current.ajax.reload(null, false);
            }
        } catch (err) {
            console.log(err.response?.data);
            Swal.fire({
                icon: "error",
                title: "Save Failed",
                text: "Unable to save changes. Please try again."
            });
        }
    };

    useEffect(() => {
        if (!tableRef.current) return;

        $(tableRef.current).on('input', '.nc-input', function () {
            const $input = $(this);
            const $row = $input.closest('tr');
            $input.addClass('is-changed').css('border-color', '#eab308');

            const offset = showClearButton ? 1 : 0;
            let asblText = $row.find('td:nth-child(7)').text().trim();
            const asbl = asblText === '' ? null : parseFloat(asblText.replace(/,/g, ''));
            const asbl_loa = parseFloat($row.find('td:nth-child(8)').text().replace(/,/g, '')) || 0;
            const ptd = parseFloat($row.find('td:nth-child(9)').text().replace(/,/g, '')) || 0;
            const oc = parseFloat($row.find('td:nth-child(10)').text().replace(/,/g, '')) || 0;
            const nc = parseFloat($input.val()) || 0;
            const newEac = ptd + oc + nc;
            const newVar = asbl === null ? '' : (asbl - newEac);

            $row.find(`td:nth-child(${12 + offset})`).text(fmt(newEac));
            $row.find(`td:nth-child(${13 + offset})`).text(fmt(newVar));
        });

        dataTableInstance.current = $(tableRef.current).DataTable({
            serverSide: true,
            searching: true,
            processing: true,
            autoWidth: false,
            scrollX: false,
            pageLength: 100,
            responsive: true,
            ajax: {
                url: apiUrl,
                type: 'GET',
                data: (d) => ({ ...d, ...filters }),
                dataSrc: function (json) {
                    if (json.kpis && typeof onKpiUpdate === 'function') {
                        onKpiUpdate(json.kpis); 
                    }
                    return json.data;
                }
            },
            columns: columns.map(col => ({
                title: col.header,
                data: col.field,
                width:
                col.field === 'loa_name' ? '180px' :
                col.field === 'categories' ? '150px' :
                col.field === 'customer' ? '120px' :
                col.field === 'non_committed' ? '110px' :
                '80px',
                defaultContent: "-",
                className: col.field === 'non_committed'
                ? 'text-left':
                col.header.match(/ASBL|PTD|EAC|COMMITTED/i) ? 'text-right' : 'text-left',
                render: function (data, type, row) {
                    const metadataFields = ['bu', 'customer', 'loa_name', 'loa_id', 'cost_revenue'];
                    if (metadataFields.includes(col.field) && row.categories) {
                        return ""; 
                    }

                    if (col.header === 'Non Committed' || col.field === 'non_committed') {
                        if (row.categories) {
                            const original = parseFloat(row.non_committed_original) || 0;
                            const current = parseFloat(data) || 0;
                            const isModified = Math.abs(current - original) > 0.01;
                            const highlightClass = isModified ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-slate-200';

                            return `<input type="number" 
                                    class="nc-input w-full p-2 border-2 ${highlightClass} text-left font-bold rounded-lg shadow-sm" 
                                    value="${current}" 
                                    data-loa="${row.loa_name}" 
                                    data-cat="${row.categories}" 
                                    data-wbstype="${row.wbs_type}"  /* 🔥 Important: added this */
                                    step="any">`;
                        }
                    }
                    const drillFields = ['ptd', 'open_commitment'];

                    if (type === 'display' && drillFields.includes(col.field)) {
                        return `
                            <span
                                class="drill-link text-grey-600 font-bold cursor-pointer hover:underline"
                                data-field="${col.field}"
                                data-uniquekey="${row.unique_key}"
                                data-loaid="${row.loa_id}" 
                                data-loa="${row.loa_name}"
                                data-category="${row.categories}"
                                data-value="${data}"
                            >
                                ${fmt(data)}
                            </span>
                        `;
                    }
                    return data;
                }
            })),
            order: [[2, 'asc'], [4, 'asc']], 
            rowGroup: {
                dataSrc: ['loa_name', 'cost_revenue'],
                startRender: function (rows, group, level) {
                    const data = rows.data().toArray();
                    const rowData = data[0];

                    // 🔥 FIX: Read showAsbl state from filtersRef to bypass React's closure bug
                    const showAsbl = filtersRef.current.wbs_type !== 'All';

                    const asbl = showAsbl ? calculateSum(rows, 'asbl') : null;
                    const asbl_loa = calculateSum(rows, 'asbl_loa');
                    const ptd = calculateSum(rows, 'ptd');
                    const oc = calculateSum(rows, 'open_commitment');
                    const nc = calculateSum(rows, 'non_committed');
                    const nc_orig = calculateSum(rows, 'non_committed_original'); 
                    const eac = ptd + oc + nc;
                    const varTotal = asbl - eac;

                    if (level === 0) {
                        // PARENT ROW (Level 0)
                        return $(`
                            <tr class="group-parent">
                                <td class="pbi-col font-black text-blue-800">${!collapseView ? '<span class="toggle-icon">➕</span>' : ''}
                                ${rowData.bu}</td>
                                <td class="font-bold text-grey-700">${rowData.customer}</td>
                                <td class="font-bold text-grey-700">${group}</td>
                                <td class="font-bold text-grey-700">${rowData.loa_id}</td>
                                <td></td><td></td>
                                <td class="text-right font-bold text-grey-900">
                                    ${showAsbl ? fmt(asbl) : ''}
                                </td>
                                <td class="text-right font-bold text-grey-900">${fmt(asbl_loa)}</td>
                                <td class="text-right font-bold text-grey-900">${fmt(ptd)}</td>
                                <td class="text-right font-bold text-grey-900">${fmt(oc)}</td>
                                ${showClearButton ? `<td class="text-right font-bold text-grey-900">${fmt(nc_orig)}</td>` : ''} 
                                <td class="text-right font-bold text-grey-900">${fmt(nc)}</td>
                                <td class="text-right font-bold text-grey-900">${fmt(eac)}</td>
                                <td class="text-right font-bold text-grey-900">${fmt(varTotal)}</td>
                            </tr>
                        `);
                    } else {
                        if (collapseView) {
                            return null;
                        }
                        // CHILD ROW (Level 1)
                        return $(`
                            <tr class="group-child">
                                <td class="text-grey-700">${rowData.bu}</td>
                                <td class="text-grey-700">${rowData.customer}</td>
                                <td class="text-grey-700">${rowData.loa_name}</td>
                                <td class="text-grey-700">${rowData.loa_id}</td>
                                <td class="pbi-col font-bold text-grey-700">
                                    ${!collapseView ? '<span class="toggle-icon">➕</span>' : ''}
                                    ${group}
                                </td>
                                <td></td>
                                <td class="text-right font-bold text-grey-700">
                                    ${showAsbl ? fmt(asbl) : ''}
                                </td>
                                <td class="text-right font-bold text-grey-700">${fmt(asbl_loa)}</td>
                                <td class="text-right font-bold text-grey-700">${fmt(ptd)}</td>
                                <td class="text-right font-bold text-grey-700">${fmt(oc)}</td>
                                ${showClearButton ? `<td class="text-right font-bold text-grey-700">${fmt(nc_orig)}</td>` : ''}
                                <td class="text-right font-bold text-grey-700">${fmt(nc)}</td>
                                <td class="text-right font-bold text-grey-700">${fmt(eac)}</td>
                                <td class="text-right font-bold text-grey-700">${fmt(varTotal)}</td>
                            </tr>
                        `);
                    }
                }
            },
            dom: '<"flex justify-between mb-4"lf>rt<"flex justify-between mt-4"ip>',
            drawCallback: function() {
                const table = $(tableRef.current);
                if (collapseView) {
                    table.find('tbody tr.group-child').hide();
                    table.find('tbody tr.dtrg-level-2').hide();
                    table.find('tbody tr:not(.group-parent)').hide();
                } else {
                    table.find('tbody tr:not(.group-parent)').hide();
                }

                // Parent Toggle
                if (!collapseView) {
                    table.find('tbody')
                    .off('click', 'tr.group-parent')
                    .on('click', 'tr.group-parent', function() {
                        if (collapseView) return;
                        const icon = $(this).find('.toggle-icon');
                        const isExpanded = $(this).hasClass('expanded');
                        const childGroups = $(this).nextUntil('tr.group-parent', 'tr.group-child');
                        
                        if (isExpanded) {
                            $(this).nextUntil('tr.group-parent').hide();
                            $(this).removeClass('expanded');
                            icon.text('➕');
                        } else {
                            childGroups.show();
                            $(this).addClass('expanded');
                            icon.text('➖');
                        }
                        dataTableInstance.current.columns.adjust();
                    });
                }

                // Child Toggle
                if (!collapseView) {
                    table.find('tbody')
                    .off('click', 'tr.group-child')
                    .on('click', 'tr.group-child', function() {
                        if (collapseView) return;
                        const icon = $(this).find('.toggle-icon');
                        const isExpanded = $(this).hasClass('expanded');
                        const dataRows = $(this).nextUntil('tr.group-child, tr.group-parent');
                        
                        if (isExpanded) {
                            dataRows.hide();
                            $(this).removeClass('expanded');
                            icon.text('➕');
                        } else {
                            dataRows.show();
                            $(this).addClass('expanded');
                            icon.text('➖');
                        }
                        dataTableInstance.current.columns.adjust();
                    });
                }
                
                // DRILL THROUGH CLICK EVENT
                table.find('tbody').off('click', '.drill-link').on('click', '.drill-link', function (e) {
                    e.stopPropagation();
                    const field = $(this).data('field');
                    const row = {
                        unique_key: $(this).data('uniquekey'),
                        loa_id: $(this).data('loaid'),      // 🔥 YEH ADD KIYA HAI
                        loa_name: $(this).data('loa'),
                        categories: $(this).data('category'), 
                        value: $(this).data('value')
                    };
                    navigate('/drilldown', { state: { field, row, filters: filtersRef.current } });
                });
            }
        });

        return () => {
            if (dataTableInstance.current) {
                $(tableRef.current).off('input', '.nc-input');
                dataTableInstance.current.destroy();
            }
        };
    }, []);

    useEffect(() => {
        if (dataTableInstance.current) dataTableInstance.current.ajax.url(apiUrl).load();
    }, [apiUrl, filters]); 

    return (
        <div className="matrix-wrapper bg-white p-2 rounded-[2rem] shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <p className="text-xl font-bold text-black mt-1 p-1 ml-2">Note:- All numerical values are in KEUR</p>
                <div className="flex gap-3">
                    {showSaveButton && (
                        <button
                            onClick={handleSave}
                            className="group text-white px-5 py-2.5 rounded-2xl shadow-md flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-xl mr-4 mt-2"
                            style={{ background: 'linear-gradient(135deg, #4682b4, #35648d)' }}
                        >
                            <span className="text-lg transition-transform duration-300 group-hover:-translate-y-[1px]"><HiOutlineSave /></span>
                            <div className="flex flex-col leading-tight text-left"><span className="text-sm font-black">Save</span></div>
                        </button>
                    )}
                    {showClearButton && (
                        <button
                            onClick={handleClear}
                            className="group text-white px-4 py-2 rounded-2xl shadow-md flex items-center gap-2 transition-all duration-300 hover:scale-105 hover:shadow-xl mr-5 mt-1"
                            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                        >
                            <span className="text-lg transition-transform duration-300 group-hover:scale-110"><HiOutlineTrash /></span>
                            <span className="text-sm font-black">Clear All</span>
                        </button>
                    )}
                </div>
            </div>
            <table ref={tableRef} className="display nowrap pbi-table" style={{ width: '100%' }}></table>
        </div>
    );
};

export default DataTable;