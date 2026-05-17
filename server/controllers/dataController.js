const db = require('../config/db');
const ExcelJS = require('exceljs');


exports.getWbsSummary = async (req, res) => {
    try {
        const { draw, start, length, search, showAll, type, allowedCustomers } = req.query; 
        const startIdx = parseInt(start) || 0;
        const limitIdx = parseInt(length) || 10;
        
        //search enable
        const searchValue = req.query.search?.value || '';

        // 1. Base Conditions
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'"
        ];
        let params = [];

        // 🔥 SEARCH LOGIC (all columns except all digits value)
        if (searchValue) {

            conditions.push(`
                (
                    bu LIKE ?
                    OR customer LIKE ?
                    OR loa_name LIKE ?
                    OR loa_id LIKE ?
                    OR categories LIKE ?
                )
            `);

        const searchPattern = `%${searchValue}%`;

            params.push(
                searchPattern,
                searchPattern,
                searchPattern,
                searchPattern,
                searchPattern
            );
        }

        // RLS Logic
        if (type === 'user' && allowedCustomers) {
            conditions.push(`customer IN (?)`);
            params.push(allowedCustomers.split(','));
        }

        // 🔥 FIX: ALL CATEGORIES LOGIC
        // Agar showAll 'true' hai, toh hum zero rows wala filter NAHI lagayenge
        // Showing All = sirf non-zero rows
        // 🔥 SHOWING ALL = sirf non-zero rows
        if (showAll === 'false') {
            conditions.push("(ABS(asbl) > 0.01 OR ABS(ptd) > 0.01 OR ABS(total_oc_fixed) > 0.01 OR ABS(non_committed_editable) > 0.01)");
        }

        // 🔥 Dropdown Filters (Strict Check)
        const allowedFilters = ['bu', 'wbs', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period'];
        allowedFilters.forEach(key => {
            let value = req.query[key];
            if (Array.isArray(value)) value = value[0];
            if (value && value !== 'All' && value !== '') {
                if (key === 'wbs') {
            // 🔥 WBS ke liye LIKE use karein taaki comma-separated string mein match ho jaye
            conditions.push(`wbs LIKE ?`);
            params.push(`%${value}%`);
        } else {
            conditions.push(`${key} = ?`);
            params.push(value);
        }
    }
        });

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const kpiQuery = `
            SELECT 
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN asbl ELSE 0 END) as asbl_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN asbl ELSE 0 END) as asbl_cost,
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN ptd ELSE 0 END) as ptd_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN ptd ELSE 0 END) as ptd_cost,
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN (ptd + total_oc_fixed + non_committed) ELSE 0 END) as eac_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN (ptd + total_oc_fixed + non_committed) ELSE 0 END) as eac_cost
            FROM final_dashboard_table
            ${whereClause}
        `;
        const [kpiRes] = await db.query(kpiQuery, params);
        const k = kpiRes[0];

        const calcSm = (rev, cost) => {
            const r = Math.abs(rev || 0);
            const c = Math.abs(cost || 0);
            return r === 0 ? "0.00" : (((r - c) / r) * 100).toFixed(2);
        };

        const kpis = {
            asbl_sm: calcSm(k.asbl_rev, k.asbl_cost),
            ptd_sm: calcSm(k.ptd_rev, k.ptd_cost),
            eac_sm: calcSm(k.eac_rev, k.eac_cost)
        };

        

        // 2. Matrix Query
        // COALESCE use kiya hai taaki NULL ki jagah 0.00 dikhe
        const matrixQuery = `
            SELECT 
                bu, customer, loa_id, loa_name, cost_revenue, categories,
                COALESCE(MAX(asbl), 0) as asbl, 
                COALESCE(MAX(asbl_loa), 0) as asbl_loa, 
                COALESCE(SUM(ptd), 0) as ptd, 
                COALESCE(MAX(total_oc_fixed), 0) as open_commitment, 
                COALESCE(MAX(non_committed), 0) as non_committed_original,
                COALESCE(MAX(non_committed_editable), 0) as non_committed,
                (COALESCE(SUM(ptd), 0) + COALESCE(MAX(total_oc_fixed), 0) + COALESCE(MAX(non_committed_editable), 0)) as eac,
                (COALESCE(MAX(asbl), 0) - (COALESCE(SUM(ptd), 0) + COALESCE(MAX(total_oc_fixed), 0) + COALESCE(MAX(non_committed_editable), 0))) as eac_vs_asbl
            FROM final_dashboard_table
            ${whereClause}
            GROUP BY bu, customer, loa_id, loa_name, cost_revenue, categories
            ORDER BY loa_name ASC, cost_revenue ASC
        `;

        const [countRes] = await db.query(`SELECT COUNT(*) as total FROM (${matrixQuery}) as temp`, params);
        const [dataRows] = await db.query(`${matrixQuery} LIMIT ?, ?`, [...params, startIdx, limitIdx]);

        res.status(200).json({
            draw: parseInt(draw) || 0,
            recordsTotal: countRes[0].total,
            recordsFiltered: countRes[0].total,
            data: dataRows,
            kpis
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// --- 2. getFilterOptions mein loa_name ki list add karein ---
exports.getFilterOptions = async (req, res) => {
    try {
        const { type, allowedCustomers, bu, wbs, customer, loa_id, loa_name, active_inactive, period } = req.query;

        // 1. Base Conditions
        let baseConditions = ["categories NOT IN ('Local Materials', 'Not to considered')", "cost_revenue <> 'NTC'"];
        let baseParams = [];

        if (type === 'user' && allowedCustomers) {
            baseConditions.push(`customer IN (?)`);
            baseParams.push(allowedCustomers.split(','));
        }

        // 2. Optimized Helper Function
        const getFilteredDistinct = async (targetColumn, currentFilters) => {
            let conditions = [...baseConditions];
            let filterValues = [...baseParams];

            // Baaki filters apply karein
            Object.keys(currentFilters).forEach(key => {
                if (key !== targetColumn && currentFilters[key] && currentFilters[key] !== 'All' && currentFilters[key] !== '') {
                    let val = currentFilters[key];
                    if (Array.isArray(val)) val = val[0];

                    if (key === 'wbs') {
                        conditions.push(`wbs LIKE ?`);
                        filterValues.push(`%${val}%`);
                    } else {
                        conditions.push(`${key} = ?`);
                        filterValues.push(val);
                    }
                }
            });

            const whereSql = " WHERE " + conditions.join(" AND ");
            
            // 🔥 FIX: Column name ko escapeId se safe banaya taaki '?' ke saath mix na ho
            const colSafe = db.escapeId(targetColumn);
            const sql = `SELECT DISTINCT ${colSafe} as value FROM final_dashboard_table ${whereSql} AND ${colSafe} IS NOT NULL ORDER BY ${colSafe}`;

            const [rows] = await db.query(sql, filterValues);
            return rows.map(r => r.value);
        };

        const currentFilters = { bu, wbs, customer, loa_id, loa_name, active_inactive, period };
        
        // 3. Parallel execution
        const [buOpts, wbsOptsRaw, custOpts, loaIdOpts, loaNameOpts, activeOpts, periodOpts] = await Promise.all([
            getFilteredDistinct('bu', currentFilters),
            getFilteredDistinct('wbs', currentFilters),
            getFilteredDistinct('customer', currentFilters),
            getFilteredDistinct('loa_id', currentFilters),
            getFilteredDistinct('loa_name', currentFilters),
            getFilteredDistinct('active_inactive', currentFilters),
            getFilteredDistinct('period', currentFilters)
        ]);

        // 4. WBS Comma Splitting Logic (Safe)
        let uniqueWbsSet = new Set();
        if (Array.isArray(wbsOptsRaw)) {
            wbsOptsRaw.forEach(str => {
                if (str && typeof str === 'string') {
                    str.split(',').forEach(item => {
                        const trimmed = item.trim();
                        if (trimmed) uniqueWbsSet.add(trimmed);
                    });
                }
            });
        }
        const finalWbsOpts = Array.from(uniqueWbsSet).sort();

        // 5. Final Response
        res.status(200).json({
            bu: buOpts,
            wbs: finalWbsOpts,
            customer: custOpts,
            loa_id: loaIdOpts,
            loa_name: loaNameOpts,
            active_inactive: activeOpts,
            period: periodOpts
        });

    } catch (error) {
        console.error("Filter Sync Error:", error.message);
        res.status(500).json({ error: "Failed to load filters: " + error.message });
    }
};


// 2. Naya Update Function (Dono tables ke liye)
exports.updateNonCommitted = async (req, res) => {
    const { updates } = req.body;
    try {
        for (let item of updates) {
            // Dono tables mein 'non_committed_editable' ko update karein
            await db.query("UPDATE summary SET non_committed_editable = ? WHERE loa_name = ? AND categories = ?", [item.value, item.loa_name, item.categories]);
            await db.query("UPDATE final_dashboard_table SET non_committed_editable = ? WHERE loa_name = ? AND categories = ?", [item.value, item.loa_name, item.categories]);
        }
        res.status(200).json({ message: "Changes saved to Editable column!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 3. Excel Export
exports.exportToExcel = async (req, res) => {
    try {
        const { showAll, ...filters } = req.query;

        // 1. Filters Setup (Same as UI)
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'"
        ];
        
        // Agar 'Show All' (🎯) nahi hai, toh zero rows filter lagayein
        if (showAll !== 'true') {
            conditions.push("(ABS(asbl) > 0.01 OR ABS(ptd) > 0.01 OR ABS(total_oc_fixed) > 0.01 OR ABS(non_committed) > 0.01)");
        }

        let params = [];
        const allowedFilters = ['bu', 'wbs', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period'];
        allowedFilters.forEach(key => {
            if (filters[key] && filters[key] !== 'All') {
                conditions.push(`${key} = ?`);
                params.push(filters[key]);
            }
        });

        const whereClause = " WHERE " + conditions.join(" AND ");

        // 2. 🔥 MATRIX EXPORT QUERY (Exactly like UI)
        const exportQuery = `
            SELECT 
                bu, customer, loa_name, loa_id, cost_revenue, categories,
                MAX(asbl) as asbl, 
                SUM(ptd) as ptd, 
                MAX(total_oc_fixed) as open_commitment, 
                MAX(non_committed) as non_committed,
                (SUM(ptd) + MAX(total_oc_fixed) + MAX(non_committed)) as eac,
                (MAX(asbl) - (SUM(ptd) + MAX(total_oc_fixed) + MAX(non_committed))) as eac_vs_asbl
            FROM final_dashboard_table
            ${whereClause}
            GROUP BY bu, customer, loa_id, loa_name, cost_revenue, categories
            ORDER BY loa_name ASC, cost_revenue ASC
        `;

        // 3. Excel Setup
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Dashboard_Matrix_Export_${new Date().getTime()}.xlsx`);
        
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const worksheet = workbook.addWorksheet('Matrix Data');
        
        worksheet.columns = [
            { header: 'BU', key: 'bu', width: 10 },
            { header: 'Customer', key: 'customer', width: 25 },
            { header: 'LOA Name', key: 'loa_name', width: 35 },
            { header: 'LOA ID', key: 'loa_id', width: 15 },
            { header: 'Cost/Revenue', key: 'cost_revenue', width: 15 },
            { header: 'Category', key: 'categories', width: 25 },
            { header: 'ASBL', key: 'asbl', width: 15 },
            { header: 'PTD', key: 'ptd', width: 15 },
            { header: 'Open Commitment', key: 'open_commitment', width: 15 },
            { header: 'Non Committed', key: 'non_committed', width: 15 },
            { header: 'EAC', key: 'eac', width: 15 },
            { header: 'EAC vs ASBL', key: 'eac_vs_asbl', width: 15 }
        ];

        const [rows] = await db.query(exportQuery, params);
        rows.forEach(row => {
            worksheet.addRow(row).commit();
        });
        
        await workbook.commit();
    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).send("Export failed: " + error.message);
    }
};

//Review Changes page k liye function export excel or claer data
// 1. Draft saaf karne ka function
exports.clearDraftChanges = async (req, res) => {
    try {
        // Dono tables mein editable value ko original ke barabar kar dein
        await db.query("UPDATE final_dashboard_table SET non_committed_editable = non_committed");
        await db.query("UPDATE summary SET non_committed_editable = non_committed");
        
        res.status(200).json({ message: "Draft cleared! All values reset to original." });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 2. Review Page specifically export karne ke liye
exports.exportReviewExcel = async (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Review_Changes_Export.xlsx`);
        
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const worksheet = workbook.addWorksheet('Review Data');
        
        worksheet.columns = [
            { header: 'BU', key: 'bu', width: 10 },
            { header: 'Customer', key: 'customer', width: 25 },
            { header: 'LOA Name', key: 'loa_name', width: 35 },
            { header: 'LOA ID', key: 'loa_id', width: 35 },
            { header: 'Cost/Revenue', key: 'cost_revenue', width: 35 },
            { header: 'Category', key: 'categories', width: 25 },
            { header: 'ASBL', key: 'asbl', width: 15 },
            { header: 'ASBL LOA', key: 'asbl_loa', width: 25 },
            { header: 'PTD', key: 'ptd', width: 25 },
            { header: 'Open Commitment', key: 'open_commitment', width: 25 },
            { header: 'Original Non Committed', key: 'non_committed_original', width: 15 },
            { header: 'Edited Non Committed', key: 'non_committed', width: 15 },
            { header: 'EAC', key: 'eac', width: 15 },
            { header: 'EAC vs ASBL', key: 'eac_vs_asbl', width: 15 }
        ];

        // Wahi logic jo Review Page ke table mein hai
        const query = `
            SELECT 
                bu, customer, loa_id, loa_name, cost_revenue, categories,
                MAX(asbl) as asbl, 
                MAX(asbl_loa) as asbl_loa, 
                SUM(ptd) as ptd, 
                MAX(total_oc_fixed) as open_commitment, 
                MAX(non_committed) as non_committed_original,
                MAX(non_committed_editable) as non_committed,
                (SUM(ptd) + MAX(total_oc_fixed) + MAX(non_committed_editable)) as eac,
                (MAX(asbl) - (SUM(ptd) + MAX(total_oc_fixed) + MAX(non_committed_editable))) as eac_vs_asbl
            FROM final_dashboard_table
            WHERE categories != 'Revenue' 
            AND ABS(non_committed - non_committed_editable) > 0.01
            GROUP BY bu, customer, loa_id, loa_name, cost_revenue, categories
            ORDER BY loa_name ASC, cost_revenue ASC
        `;

        const [rows] = await db.query(query);
        rows.forEach(row => worksheet.addRow(row).commit());
        await workbook.commit();
    } catch (error) { res.status(500).send("Export failed"); }
};



// 1. Distinct Categories fetch karein
exports.getCategories = async (req, res) => {
    try {
        const [rows] = await db.query("SELECT DISTINCT categories FROM summary WHERE categories IS NOT NULL AND categories <> '' ORDER BY categories ASC");
        res.status(200).json(rows.map(r => r.categories));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Project Data Save (Upsert Logic)
exports.saveProjectData = async (req, res) => {
    const { bu, customer, loa_id, loa_name, wbs, asblData } = req.body;

    try {
        // 1. Pehle Summary table mein data Upsert karein
        const [existing] = await db.query("SELECT id FROM summary WHERE loa_name = ?", [loa_name]);
        if (existing.length > 0) {
            await db.query("DELETE FROM summary WHERE loa_name = ?", [loa_name]);
        }

        const insertPromises = Object.keys(asblData).map(cat => {
            const val = asblData[cat] || 0;
            if (val === 0 || val === '') return null; // Khali values skip karein
            return db.query(
                `INSERT INTO summary (bu, customer, loa_id, loa_name, wbs, categories, asbl, active_inactive) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')`,
                [bu, customer, loa_id, loa_name, wbs, cat, val]
            );
        }).filter(p => p !== null);

        await Promise.all(insertPromises);

        // 2. 🔥 SAFE REFRESH LOGIC
        // Pehle check karein ki View sahi kaam kar raha hai ya nahi
        const [viewCheck] = await db.query("SELECT COUNT(*) as count FROM join_summary");
        
        if (viewCheck[0].count > 0) {
            // Agar View mein data hai, tabhi purani table saaf karke naya data bharein
            await db.query("TRUNCATE TABLE final_dashboard_table");
            await db.query("INSERT INTO final_dashboard_table SELECT * FROM join_summary");
            
            // Naya column 'total_oc_fixed' refresh karein (Jo humne speed ke liye banaya tha)
            await db.query(`
                UPDATE final_dashboard_table t
                JOIN (
                    SELECT loa_name, categories, SUM(open_commitment_KEUR) as total_sum
                    FROM final_dashboard_table
                    GROUP BY loa_name, categories
                ) as src ON t.loa_name = src.loa_name AND t.categories = src.categories
                SET t.total_oc_fixed = src.total_sum
            `);

            res.status(200).json({ message: "Data saved and Dashboard updated successfully!" });
        } else {
            throw new Error("View 'join_summary' is empty. Refresh aborted to save existing data.");
        }

    } catch (error) {
        console.error("DETAILED ERROR:", error); // Yeh terminal mein asli wajah batayega
        res.status(500).json({ error: error.message });
    }
};

exports.fullRefresh = async (req, res) => {
    try {
        console.log("Starting Full Sync...");
        
        // 1. Table saaf karein
        await db.query("TRUNCATE TABLE final_dashboard_table");

        // 2. Naya data bharein (Explicit Columns)
        const insertSql = `
            INSERT INTO final_dashboard_table 
            (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key)
            SELECT bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key 
            FROM final_dashboard
        `;
        await db.query(insertSql);

        // 3. total_oc_fixed update karein
        await db.query(`
            UPDATE final_dashboard_table t
            JOIN (
                SELECT loa_name, categories, SUM(open_commitment_KEUR) as total_sum
                FROM final_dashboard_table
                GROUP BY loa_name, categories
            ) as src ON t.loa_name = src.loa_name AND t.categories = src.categories
            SET t.total_oc_fixed = src.total_sum
        `);

        console.log("Full Sync Complete!");
        res.status(200).json({ message: "Full Dashboard Refresh Complete!" });
    } catch (error) {
        console.error("Full Refresh Error:", error);
        res.status(500).json({ error: "Refresh failed: " + error.message });
    }
};


// 1. Dashboard Filters
exports.getDashboardFilters = async (req, res) => {
    try {

        const [periodRows] = await db.query(`
            SELECT DISTINCT period
            FROM final_dashboard_table
            WHERE period IS NOT NULL
            ORDER BY period DESC
        `);

        const [customerRows] = await db.query(`
            SELECT DISTINCT customer
            FROM final_dashboard_table
            WHERE customer IS NOT NULL
            AND customer <> ''
            ORDER BY customer ASC
        `);

        // Example: 2026-P1 → 2026
        const years = [
            ...new Set(
                periodRows.map(r => r.period?.split('-')[0])
            )
        ].sort((a, b) => b - a);

        const periods = periodRows.map(r => r.period);

        const customers = customerRows.map(
            r => r.customer
        );

        res.status(200).json({
            years,
            periods,
            customers
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

// 2. Filtered BU Analytics
exports.getBuAnalytics = async (req, res) => {

    try {

        const { years, periods, customers } = req.query;

        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];

        let params = [];

        // MULTI YEAR FILTER

        if (years) {

            const yearArray = years.split(',');

            const yearConditions = yearArray.map(() =>
                "period LIKE ?"
            );

            conditions.push(`(${yearConditions.join(' OR ')})`);

            params.push(
                ...yearArray.map(y => `${y}-%`)
            );

        }

        // MULTI PERIOD FILTER

        if (periods) {

            const periodArray = periods.split(',');

            const placeholders =
                periodArray.map(() => '?').join(',');

            conditions.push(
                `period IN (${placeholders})`
            );

            params.push(...periodArray);

        }

        // MULTI CUSTOMER FILTER

        if (customers) {

            const customerArray =
                customers.split(',');

            const placeholders =
                customerArray.map(() => '?').join(',');

            conditions.push(
                `customer IN (${placeholders})`
            );

            params.push(...customerArray);

        }

        const whereSql =
            " WHERE " + conditions.join(" AND ");

        const sql = `

            SELECT
                bu,
                SUM(asbl) AS asbl,
                SUM(ptd) AS ptd,
                SUM(eac) AS eac

            FROM final_dashboard_table

            ${whereSql}

            GROUP BY bu

        `;

        const [rows] =
            await db.query(sql, params);

        res.status(200).json(rows);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

};

// 3. Filtered LOA Analytics
exports.getLoaAnalytics = async (req, res) => {

    try {

        const { years, periods, showAll } = req.query;

        const limitSql =
            showAll === 'true'
                ? ''
                : 'LIMIT 10';

        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];

        let params = [];

        // MULTI YEAR FILTER

        if (years) {

            const yearArray = years.split(',');

            const yearConditions = yearArray.map(() =>
                "period LIKE ?"
            );

            conditions.push(`(${yearConditions.join(' OR ')})`);

            params.push(
                ...yearArray.map(y => `${y}-%`)
            );

        }

        // MULTI PERIOD FILTER

        if (periods) {

            const periodArray = periods.split(',');

            const placeholders =
                periodArray.map(() => '?').join(',');

            conditions.push(
                `period IN (${placeholders})`
            );

            params.push(...periodArray);

        }

        const whereSql =
            " WHERE " + conditions.join(" AND ");

        const sql = `

    SELECT
        loa_name,
        SUM(asbl) AS asbl,
        SUM(ptd) AS ptd,
        SUM(eac) AS eac

    FROM final_dashboard_table

    ${whereSql}

    GROUP BY loa_name

    ORDER BY asbl DESC

    ${limitSql}

`;

        const [rows] =
            await db.query(sql, params);

        res.status(200).json(rows);

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }

};


// 1. Sirf badli hui rows fetch karein
exports.getReviewChanges = async (req, res) => {
    try {
        const { draw, start, length } = req.query;
        const startIdx = parseInt(start) || 0;
        const limitIdx = parseInt(length) || 10;

        const matrixQuery = `
            SELECT 
                bu, customer, loa_id, loa_name, cost_revenue, categories,
                MAX(asbl) as asbl, 
                MAX(asbl_loa) as asbl_loa, 
                SUM(ptd) as ptd, 
                MAX(total_oc_fixed) as open_commitment, 
                -- 🔥 IMPORTANT: Editable value ko hi 'non_committed' naam se bhej rahe hain
                MAX(non_committed_editable) as non_committed, 
                MAX(non_committed) as non_committed_original,
                (SUM(ptd) + MAX(total_oc_fixed) + MAX(non_committed_editable)) as eac,
                (MAX(asbl) - (SUM(ptd) + MAX(total_oc_fixed) + MAX(non_committed_editable))) as eac_vs_asbl
            FROM final_dashboard_table
            WHERE categories != 'Revenue' 
            AND ABS(non_committed - non_committed_editable) > 0.01
            GROUP BY bu, customer, loa_id, loa_name, cost_revenue, categories
            ORDER BY loa_name ASC, cost_revenue ASC
        `;

        const [countRes] = await db.query(`SELECT COUNT(*) as total FROM (${matrixQuery}) as temp`);
        const [dataRows] = await db.query(`${matrixQuery} LIMIT ?, ?`, [startIdx, limitIdx]);

        res.status(200).json({
            draw: parseInt(draw) || 0,
            recordsTotal: countRes[0].total,
            recordsFiltered: countRes[0].total,
            data: dataRows
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 2. Final Save (Commit): Editable value ko original mein move karein
exports.finalizeChanges = async (req, res) => {
    try {
        // 1. Pehle check karein ki kitni rows badli hain
        const [changedRows] = await db.query(
            "SELECT loa_id FROM final_dashboard_table WHERE ABS(non_committed - non_committed_editable) > 0.01"
        );

        if (changedRows.length === 0) {
            return res.status(200).json({ message: "No changes found to finalize." });
        }

        // 2. 🔥 STEP 1: Summary table mein 'non_committed' ko update karein
        await db.query(`
            UPDATE summary 
            SET non_committed = non_committed_editable 
            WHERE ABS(non_committed - non_committed_editable) > 0.01
        `);

        // 3. 🔥 STEP 2: Dashboard table mein 'non_committed' (Original) ko update karein
        await db.query(`
            UPDATE final_dashboard_table 
            SET non_committed = non_committed_editable 
            WHERE ABS(non_committed - non_committed_editable) > 0.01
        `);

        // 4. 🔥 STEP 3: EAC aur Variance ko recalculate karein (Sabse Zaroori)
        // EAC = PTD + OC + New Finalized Non-Committed
        await db.query(`
            UPDATE final_dashboard_table 
            SET eac = (ptd + open_commitment_KEUR + non_committed),
                eac_vs_asbl = (asbl - (ptd + open_commitment_KEUR + non_committed))
        `);

        res.status(200).json({ message: "✅ All changes finalized! Summary View is now updated." });

    } catch (error) {
        console.error("Finalize Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// function to check if there are pending changes (for enabling/disabling Finalize button on frontend)
exports.checkPendingChanges = async (req, res) => {
    try {
        // Check karein ki kya koi aisi row hai jahan original aur editable value alag hai
        const [rows] = await db.query(`
            SELECT COUNT(*) as count 
            FROM final_dashboard_table 
            WHERE categories != 'Revenue' 
            AND ABS(non_committed - non_committed_editable) > 0.01
        `);
        
        res.status(200).json({ count: rows[0].count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};