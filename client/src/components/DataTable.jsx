import React, { useEffect, useRef } from 'react';
import $ from 'jquery';
import axios from 'axios';
import 'datatables.net-dt';
import 'datatables.net-rowgroup-dt';
import 'datatables.net-dt/css/dataTables.dataTables.css';
import './DataTable.css';

const DataTable = ({ title, columns, apiUrl, filters, onKpiUpdate }) => {
    const tableRef = useRef(null);
    const dataTableInstance = useRef(null);

    // Helper: Numbers ko format karne ke liye (2 decimal places)
    const fmt = (val) => {
        const num = parseFloat(val) || 0;
        return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const calculateSum = (rows, field) => {
        return rows.data().pluck(field).reduce((a, b) => a + (parseFloat(b) || 0), 0);
    };

    const handleSave = async () => {
        const updates = [];
        $('.nc-input.is-changed').each(function() {
            updates.push({
                loa_name: $(this).data('loa'),
                categories: $(this).data('cat'),
                value: $(this).val()
            });
        });

        if (updates.length === 0) return alert("No changes to save.");

        try {
            await axios.post('http://localhost:5000/api/data/update-non-committed', { updates });
            alert("✅ Data Saved Successfully!");
            if (dataTableInstance.current) dataTableInstance.current.ajax.reload(null, false);
        } catch (err) { alert("❌ Save failed"); }
    };

    useEffect(() => {
        if (!tableRef.current) return;

        // 🔥 LIVE CALCULATION & HIGHLIGHT LOGIC
        $(tableRef.current).on('input', '.nc-input', function() {
            const $input = $(this);
            const $row = $input.closest('tr');
            
            // Mark as changed
            $input.addClass('is-changed').css('border-color', '#eab308');

            // Get values from other cells in the same row
            const asbl = parseFloat($row.find('td:nth-child(7)').text().replace(/,/g, '')) || 0;
            const ptd = parseFloat($row.find('td:nth-child(9)').text().replace(/,/g, '')) || 0;
            const oc = parseFloat($row.find('td:nth-child(10)').text().replace(/,/g, '')) || 0;
            const nc = parseFloat($input.val()) || 0;

            // Live Math
            const newEac = ptd + oc + nc;
            const newVar = asbl - newEac;

            // Update EAC and Variance cells (Columns 12 and 13)
            $row.find('td:nth-child(12)').text(fmt(newEac));
            $row.find('td:nth-child(13)').text(fmt(newVar));
        });

        dataTableInstance.current = $(tableRef.current).DataTable({
            serverSide: true,
            searching: true,
            processing: true,
            autoWidth: false,
            scrollX: true,
            pageLength: 100,
            ajax: {
                url: apiUrl,
                type: 'GET',
                data: (d) => ({ ...d, ...filters }),
                dataSrc: (json) => {
                    if (json.kpis && typeof onKpiUpdate === 'function') {
                        requestAnimationFrame(() => onKpiUpdate(json.kpis));
                    }
                    return json.data;
                }
            },
            columns: columns.map(col => ({
                title: col.header,
                data: col.field,
                defaultContent: "-",
                className: col.header.match(/ASBL|PTD|EAC|COMMITTED/i) ? 'text-right' : 'text-left',
                render: function(data, type, row) {
                    if (col.field === 'non_committed') {
                        if (row.categories) {
                            // 🔥 COMPARISON: Agar edited value original se alag hai toh Blue highlight
                                const original = parseFloat(row.non_committed_original) || 0;
                                const current = parseFloat(data) || 0;
                                const isModified = current !== original;
                                
                                const highlightClass = isModified ? 'bg-blue-100 border-blue-500 text-blue-900' : 'border-gray-200';

                                return `<input type="number" 
                                        class="nc-input w-24 p-1 border-2 ${highlightClass} text-right font-bold rounded shadow-sm" 
                                        value="${current}" 
                                        data-loa="${row.loa_name}" 
                                        data-cat="${row.categories}"
                                        title="Original Value: ${original}">`; // Hover karne par purani value dikhegi
                        }
                    }
                    // EAC aur Variance ko 2 decimal tak fix karein
                    if (col.field === 'eac' || col.field === 'eac_vs_asbl') {
                        return fmt(data);
                    }
                    // Format numbers to 2 decimal places
                    if (type === 'display' && !isNaN(data) && col.field !== 'bu' && col.field !== 'loa_id') {
                        return fmt(data);
                    }
                    return data;
                }
            })),
            order: [[2, 'asc'], [4, 'asc']], 
            rowGroup: {
                dataSrc: ['loa_name', 'cost_revenue'],
                startRender: function (rows, group, level) {
                    if (level === 0) return null; 
                    const rowData = rows.data()[0];
                    
                    const asbl = calculateSum(rows, 'asbl');
                    const asbl_loa = calculateSum(rows, 'asbl_loa');
                    const ptd = calculateSum(rows, 'ptd');
                    const oc = calculateSum(rows, 'open_commitment');
                    const nc = calculateSum(rows, 'non_committed');
                    const eac = ptd + oc + nc;
                    const variance = asbl - eac;

                    return $(`
                        <tr class="group-child">
                            <td class="pbi-col"><span class="toggle-icon">➕</span> ${rowData.bu}</td>
                            <td>${rowData.customer}</td>
                            <td>${rowData.loa_name}</td>
                            <td>${rowData.loa_id}</td>
                            <td class="font-bold">${group}</td>
                            <td></td>
                            <td class="text-right font-bold">${fmt(asbl)}</td>
                            <td class="text-right font-bold">${fmt(asbl_loa)}</td>
                            <td class="text-right font-bold">${fmt(ptd)}</td>
                            <td class="text-right font-bold">${fmt(oc)}</td>
                            <td class="text-right font-bold">${fmt(nc)}</td>
                            <td class="text-right font-bold">${fmt(eac)}</td>
                            <td class="text-right font-bold">${fmt(variance)}</td>
                        </tr>
                    `);
                }
            },
            dom: '<"flex justify-between mb-4"lf>rt<"flex justify-between mt-4"ip>',
            drawCallback: function() {
                const table = $(tableRef.current);
                table.find('tbody tr:not(.group-child)').hide().addClass('expanded-data-row');
                table.find('tbody').off('click', 'tr.group-child').on('click', 'tr.group-child', function() {
                    const icon = $(this).find('.toggle-icon');
                    const isExpanded = $(this).hasClass('expanded');
                    const dataRows = $(this).nextUntil('tr.group-child');
                    if (isExpanded) { dataRows.hide(); $(this).removeClass('expanded'); icon.text('➕'); }
                    else { dataRows.show(); $(this).addClass('expanded'); icon.text('➖'); }
                    if (dataTableInstance.current) dataTableInstance.current.columns.adjust();
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
        <div className="matrix-wrapper bg-white p-6 rounded-[2rem] shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-xl font-black text-slate-800">{title}</h2>
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl font-bold text-sm shadow-lg flex items-center gap-2">
                    💾 Save Changes
                </button>
            </div>
            <table ref={tableRef} className="display nowrap pbi-table" style={{width: '100%'}}></table>
        </div>
    );
};

export default DataTable;