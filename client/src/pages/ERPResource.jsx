import React, { useEffect, useState, useRef } from "react";
import Swal from 'sweetalert2';
import axios from 'axios';

const ERPResource = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [page, setPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const fileInputRef = useRef(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchData = async (
    currentPage = page,
    currentSearch = debouncedSearch,
    currentPageSize = pageSize
  ) => {
    try {
      setLoading(true);

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/data/erp-resource?page=${currentPage}&pageSize=${currentPageSize}&search=${encodeURIComponent(
          currentSearch
        )}&sortBy=id&sortOrder=asc`
      );

      const result = await response.json();

      setRows(result.data || []);
      setTotalRecords(result.totalRecords || 0);
    } catch (error) {
      console.error("Error fetching ERP Resource data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  useEffect(() => {
    fetchData(page, debouncedSearch, pageSize);
  }, [page, debouncedSearch, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleExport = () => {
    window.location.href =
      `${process.env.REACT_APP_API_URL}/api/data/erp-resource-export?search=${encodeURIComponent(search)}&sortBy=id&sortOrder=asc`;
  };

  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    setPageSize(newSize);
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearch("");
  };

  const handleFileSelect = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const totalPages = Math.ceil(totalRecords / pageSize);

  const getPageNumbers = () => {
    const pageRange = 2;
    const pages = [];
    const startPage = Math.max(1, page - pageRange);
    const endPage = Math.min(totalPages, page + pageRange);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  // Immediate upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const user = JSON.parse(localStorage.getItem("user")) || {};
    const formData = new FormData();
    formData.append('file', file);
    formData.append("created_by", user.email || "Unknown");

    try {
      setUploading(true);
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/data/erp-resource/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      Swal.fire({
        icon: 'success',
        title: 'Upload Successful'
      });

      fetchData();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: err.response?.data?.message || err.message
      });
    } finally {
      setUploading(false);
    }
  };

  // Modal based upload handler
  const handleUpload = async () => {
    if (!selectedFile) {
      Swal.fire({
        icon: 'warning',
        title: 'Select a file first'
      });
      return;
    }

    const user = JSON.parse(localStorage.getItem("user")) || {};
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append("created_by", user.email || "Unknown");

    try {
      setUploading(true);
      
      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/data/erp-resource/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      Swal.fire({
        icon: 'success',
        title: `${res.data.uploadedRows} rows uploaded`,
        text: `Month: ${res.data.month}`
      });

      setShowUploadModal(false);
      setSelectedFile(null);

      fetchData();
    } catch (err) {
      console.log("UPLOAD ERROR =>", err);
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: err.response?.data?.message || err.message || 'Unknown Error'
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-slate-100 h-screen max-h-screen flex flex-col overflow-hidden p-4 md:p-6">
      
      {/* Global uploading screen loader */}
      {uploading && !showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex flex-col items-center justify-center z-[100] backdrop-blur-[2px]">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-sm font-semibold text-slate-700">Uploading Excel dataset, please wait...</p>
          </div>
        </div>
      )}

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        
        {/* Header Section */}
        <div className="border-b border-slate-100 p-5 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  Cross ERP Data
                </h2>
                <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full border border-indigo-100">
                  {totalRecords.toLocaleString()} Total Records
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Data
              </button>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
              />

              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm active:scale-[0.98]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="bg-slate-50/50 border-b border-slate-100 px-5 py-3.5 flex-shrink-0">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            
            <input
              type="text"
              placeholder="Type to search Resource, LM, Country, Team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium text-slate-800"
            />

            {search && (
              <button
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear Search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Table Body Container */}
        <div className="flex-1 overflow-auto bg-white min-w-full">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-full">
              <div className="w-9 h-9 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-3 text-slate-500 text-xs font-medium">
                Searching entries...
              </p>
            </div>
          ) : (
            <table className="w-full min-w-max text-left border-collapse table-auto">
              
              {/* 🔥 Header Styling: Font size 13px, Color Black, standard case */}
              <thead className="bg-slate-50 text-black tracking-wider text-[13px] font-semibold border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-center bg-slate-100 select-none">
                    ID <span className="text-[10px] text-slate-500">▲</span>
                  </th>
                  <th className="px-4 py-3">TR Global Period</th>
                  <th className="px-4 py-3">LM Nokia ID Name</th>
                  <th className="px-4 py-3">Home Country</th>
                  <th className="px-4 py-3">Resource ERP Type</th>
                  <th className="px-4 py-3">Resource Person Number</th>
                  <th className="px-4 py-3">Resource Nokia ID Name</th>
                  <th className="px-4 py-3">Time Entry Date</th>
                  <th className="px-4 py-3 text-right">Recorded Hours</th>
                  <th className="px-4 py-3">Time Entry Status</th>
                  <th className="px-4 py-3 text-right">Daily Working Hours</th>
                  <th className="px-4 py-3">TR WBS/Care Contract/Opp</th>
                  <th className="px-4 py-3">TR WBS Description</th>
                  <th className="px-4 py-3">SVO ID</th>
                  <th className="px-4 py-3">SVO Description</th>
                  <th className="px-4 py-3">GIC</th>
                  <th className="px-4 py-3">GIC Name</th>
                  <th className="px-4 py-3">Customer Team</th>
                  <th className="px-4 py-3">Time Approval Date</th>
                  <th className="px-4 py-3">LM Email</th>
                  <th className="px-4 py-3">Resource Email</th>
                </tr>
              </thead>

              {/* 🔥 Body Styling: Font size 12px, No Bold, No custom colors */}
              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white text-[14px]">
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-2.5 text-center text-slate-500 bg-slate-50/20">
                        {row.id}
                      </td>
                      <td className="px-4 py-2.5">{row.tr_global_period || "-"}</td>
                      <td className="px-4 py-2.5">{row.lm_nokia_id_name || "-"}</td>
                      <td className="px-4 py-2.5">{row.home_country || "-"}</td>
                      <td className="px-4 py-2.5">{row.resource_erp_type || "-"}</td>
                      <td className="px-4 py-2.5">{row.resource_person_number || "-"}</td>
                      <td className="px-4 py-2.5">{row.resource_nokia_id_name || "-"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.time_entry_date || "-"}</td>
                      <td className="px-4 py-2.5 text-right">{row.recorded_hours || "0.00"}</td>
                      <td className="px-4 py-2.5">{row.time_entry_status || "-"}</td>
                      <td className="px-4 py-2.5 text-right">{row.daily_working_hours || "0.00"}</td>
                      <td className="px-4 py-2.5">{row.tr_wbs_care_contract_opp || "-"}</td>
                      <td className="px-4 py-2.5 max-w-[200px] truncate" title={row.tr_wbs_care_contract_opp_description}>
                        {row.tr_wbs_care_contract_opp_description || "-"}
                      </td>
                      <td className="px-4 py-2.5">{row.svo_id || "-"}</td>
                      <td className="px-4 py-2.5">{row.svo_description || "-"}</td>
                      <td className="px-4 py-2.5">{row.gic || "-"}</td>
                      <td className="px-4 py-2.5">{row.gic_name || "-"}</td>
                      <td className="px-4 py-2.5">{row.customer_team || "-"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.time_approval_date || "-"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.lm_email || "-"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.resource_email || "-"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="21" className="text-center py-20 text-slate-400 bg-white">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-slate-500">No records found</span>
                        <span className="text-xs text-slate-400">Type a different query to find resources</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination & Rows Selection Footer */}
        <div className="border-t border-slate-100 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white flex-shrink-0">
          
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">Show:</span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="bg-white border border-slate-200 text-xs text-slate-700 font-bold rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
            <span className="text-xs text-slate-400">entries per page</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(1)}
              className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-50 disabled:text-slate-300 border border-slate-200 rounded-lg text-slate-600 transition-all disabled:pointer-events-none active:scale-95"
              title="First Page"
            >
              «
            </button>

            <button
              disabled={page === 1}
              onClick={() => setPage((prev) => prev - 1)}
              className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-50 disabled:text-slate-300 border border-slate-200 rounded-lg text-slate-600 transition-all disabled:pointer-events-none active:scale-95"
              title="Previous Page"
            >
              ‹
            </button>

            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                  page === pageNum
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200"
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
              className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-50 disabled:text-slate-300 border border-slate-200 rounded-lg text-slate-600 transition-all disabled:pointer-events-none active:scale-95"
              title="Next Page"
            >
              ›
            </button>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(totalPages)}
              className="w-7 h-7 flex items-center justify-center bg-white hover:bg-slate-50 disabled:text-slate-300 border border-slate-200 rounded-lg text-slate-600 transition-all disabled:pointer-events-none active:scale-95"
              title="Last Page"
            >
              »
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium text-right">
            Showing <span className="text-slate-800 font-semibold">{Math.min(totalRecords, (page - 1) * pageSize + 1)}</span> to{" "}
            <span className="text-slate-800 font-semibold">{Math.min(totalRecords, page * pageSize)}</span> of{" "}
            <span className="text-indigo-600 font-bold">{totalRecords.toLocaleString()}</span> entries
          </div>

        </div>
      </div>

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-[1px]">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-[420px] border border-slate-100 transition-all">

            {uploading ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-11 h-11 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <h3 className="text-base font-bold text-slate-800 mt-4">Uploading Dataset...</h3>
                <p className="text-slate-500 text-xs mt-1.5 max-w-[280px]">
                  Please wait, parsing rows and saving data to database. Do not close this window.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-slate-800 mb-1">
                  Upload ERP Resource File
                </h2>
                <p className="text-slate-400 text-xs mb-5">
                  Select Excel file matching template columns to import.
                </p>

                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 transition-all bg-slate-50/50 flex flex-col items-center justify-center gap-2 cursor-pointer relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-xs font-semibold text-indigo-600">Click to choose a file</span>
                  <span className="text-[10px] text-slate-400">Excel files (.xlsx, .xls) only</span>
                </div>

                {selectedFile && (
                  <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2.5">
                    <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-bold text-indigo-800 truncate">{selectedFile.name}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setSelectedFile(null);
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleUpload}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    Save
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default ERPResource;