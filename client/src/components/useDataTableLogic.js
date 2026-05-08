import { useState } from 'react';

// Yeh function saari logic handle karega (Search, Pagination, All option)
export const useDataTableLogic = (data, columns) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // 1. Search Logic
    const filteredData = data.filter((row) => {
        return columns.some((col) => {
            const value = row[col.key] ? row[col.key].toString().toLowerCase() : "";
            return value.includes(searchTerm.toLowerCase());
        });
    });

    // 2. Row calculation
    const actualRowsPerPage = rowsPerPage === "All" ? filteredData.length : Number(rowsPerPage);
    const indexOfLastRow = currentPage * actualRowsPerPage;
    const indexOfFirstRow = indexOfLastRow - actualRowsPerPage;
    
    // Final rows jo table mein dikhani hain
    const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
    const totalPages = rowsPerPage === "All" ? 1 : Math.ceil(filteredData.length / actualRowsPerPage);

    return {
        searchTerm, setSearchTerm,
        currentPage, setCurrentPage,
        rowsPerPage, setRowsPerPage,
        currentRows, totalPages,
        filteredData, indexOfFirstRow, indexOfLastRow
    };
};