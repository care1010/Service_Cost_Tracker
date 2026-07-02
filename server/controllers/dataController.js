const db = require('../config/db');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const fs = require('fs');

// ==============================
// COMMON RLS FUNCTION
// ==============================
const applyRLS = (
    type,
    allowedCustomers,
    conditions,
    params
) => {

    // Super Admin = Full Access
    if (type === 'super_admin') {
        return;
    }

    // User/Admin Restricted Access
    if (allowedCustomers) {

        const customersArray = allowedCustomers
            .split(',')
            .map(c => c.trim())
            .filter(Boolean);

        if (customersArray.length > 0) {

            const placeholders =
                customersArray.map(() => '?').join(',');

            conditions.push(
                `customer IN (${placeholders})`
            );

            params.push(...customersArray);
        }
    }
};

// ==============================
// COMMON Dashboard Filters FUNCTION
// ==============================
const applyDashboardFilters = (
    query, conditions, params) => {
    const {years, periods, customers, loa_names, active_inactive, wbs_type } = query;
    // YEAR FILTER
    if (years) {
        const yearArray = years.split(',');
        const yearConditions =
            yearArray.map(() => "period LIKE ?");
        conditions.push(
            `(${yearConditions.join(' OR ')})`
        );
        params.push(
            ...yearArray.map(y => `${y}-%`)
        );
    }

    // PERIOD FILTER
    if (periods) {
        const periodArray = periods.split(',');
        conditions.push(
            `period IN (${periodArray.map(() => '?').join(',')})`
        );
        params.push(...periodArray);
    }

    // CUSTOMER FILTER
    if (customers) {
        const customerArray = customers.split(',');
        conditions.push(
            `customer IN (${customerArray.map(() => '?').join(',')})`
        );
        params.push(...customerArray);
    }

    // LOA FILTER
    if (loa_names) {
        const loaArray = loa_names.split(',');
        conditions.push(
            `loa_name IN (${loaArray.map(() => '?').join(',')})`
        );
        params.push(...loaArray);
    }

    // NEW STATUS FILTER
    if (active_inactive) {
        conditions.push(`active_inactive = ?`);
        params.push(active_inactive);
    }

    // 🔥 NEW WBS TYPE FILTER FOR DASHBOARD GRAPHS
    if (wbs_type && wbs_type !== 'All') {
        conditions.push(`wbs_type = ?`);
        params.push(wbs_type);
    }
};

//Main Summary Table data fetch with server side processing
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

            params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
        }

        // RLS Logic
        applyRLS(type, allowedCustomers, conditions, params);

        //  FIX: ALL CATEGORIES LOGIC
        // Agar showAll 'true' hai, toh hum zero rows wala filter NAHI lagayenge
        if (showAll === 'false') {
            conditions.push("(ABS(asbl) > 0.01 OR ABS(ptd) > 0.01 OR ABS(total_oc_fixed) > 0.01 OR ABS(non_committed_editable) > 0.01)");
        }

        //  Dropdown Filters (Strict Check)
        const allowedFilters = ['bu', 'wbs', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period', 'wbs_type', 'wbs_description'];
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
                (
    SUM(
        CASE
            WHEN cost_revenue = 'Revenue'
            THEN ptd
            ELSE 0
        END
    )
    +
    MAX(
        CASE
            WHEN cost_revenue = 'Revenue'
            THEN total_oc_fixed
        END
    )
    +
    MAX(
        CASE
            WHEN cost_revenue = 'Revenue'
            THEN non_committed_editable
        END
    )
) AS eac_rev,

(
    SUM(
        CASE
            WHEN cost_revenue = 'Cost'
            THEN ptd
            ELSE 0
        END
    )
    +
    MAX(
        CASE
            WHEN cost_revenue = 'Cost'
            THEN total_oc_fixed
        END
    )
    +
    MAX(
        CASE
            WHEN cost_revenue = 'Cost'
            THEN non_committed_editable
        END
    )
) AS eac_cost
            FROM final_dashboard_table
            ${whereClause}
        `;
        const [kpiRes] = await db.query(kpiQuery, params);
        const k = kpiRes[0];
        // console.log(k);

        const calcSm = (rev, cost) => {

            // Revenue ko hamesha positive consider karo
            const revenue = Math.abs(Number(rev) || 0);
            const costVal = Number(cost) || 0;
            if (revenue === 0) {
                return "0.00";
            }
            return (
                ((revenue - costVal) / revenue) * 100
            ).toFixed(2);
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
                MAX(unique_key) as unique_key, -- 🔥 YEH LINE ADD KAREIN (Taaki key frontend tak jaye)
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

// Collapse table of Summary View
exports.getWbsSummaryCollapse = async (req, res) => {
    try {

        const {
            draw,
            start,
            length,
            type,
            allowedCustomers,
            showAll
        } = req.query;

        const startIdx = parseInt(start) || 0;
        const limitIdx = parseInt(length) || 10;

        const searchValue = req.query.search?.value || '';

        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'"
        ];

        let params = [];

        // Search
        if (searchValue) {

            conditions.push(`
                (
                    bu LIKE ?
                    OR customer LIKE ?
                    OR loa_name LIKE ?
                    OR loa_id LIKE ?
                )
            `);

            const searchPattern = `%${searchValue}%`;

            params.push(
                searchPattern,
                searchPattern,
                searchPattern,
                searchPattern
            );
        }

        // RLS
        applyRLS(type, allowedCustomers, conditions, params);

        // Same logic as Export
        if (showAll === 'false') {
            conditions.push(`
                (
                    ABS(asbl) > 0.01
                    OR ABS(ptd) > 0.01
                    OR ABS(total_oc_fixed) > 0.01
                    OR ABS(non_committed_editable) > 0.01
                )
            `);
        }

        // Filters on Summary View
        const allowedFilters = [
            'bu',
            'wbs',
            'customer',
            'loa_id',
            'loa_name',
            'active_inactive',
            'period'
        ];

        allowedFilters.forEach(key => {

            let value = req.query[key];

            if (Array.isArray(value))
                value = value[0];

            if (
                value &&
                value !== 'All' &&
                value !== ''
            ) {

                if (key === 'wbs') {

                    conditions.push(`wbs LIKE ?`);
                    params.push(`%${value}%`);

                } else {

                    conditions.push(`${key} = ?`);
                    params.push(value);

                }
            }
        });

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

        const sql = `
            SELECT
                bu,
                customer,
                loa_name,
                loa_id,
                cost_revenue,

                ROUND(MAX(asbl), 2) AS asbl,
                ROUND(MAX(asbl_loa), 2) AS asbl_loa,
                ROUND(SUM(ptd), 2) AS ptd,
                ROUND(MAX(total_oc_fixed), 2) AS open_commitment,
                ROUND(MAX(non_committed_editable), 2) AS non_committed,

                ROUND(
                    SUM(ptd)
                    + MAX(total_oc_fixed)
                    + MAX(non_committed_editable),
                2) AS eac,

                ROUND(
                    MAX(asbl)
                    -
                    (
                        SUM(ptd)
                        + MAX(total_oc_fixed)
                        + MAX(non_committed_editable)
                    ),
                2) AS eac_vs_asbl

            FROM final_dashboard_table

            ${whereClause}

            GROUP BY
                bu,
                customer,
                loa_name,
                loa_id,
                cost_revenue

            ORDER BY loa_name ASC
        `;

        const [countRes] = await db.query(
            `SELECT COUNT(*) as total FROM (${sql}) temp`,
            params
        );

        const [rows] = await db.query(
            `${sql} LIMIT ?, ?`,
            [...params, startIdx, limitIdx]
        );

        console.log("Collapse Rows Count:", countRes[0].total);

        res.status(200).json({
            draw: parseInt(draw) || 0,
            recordsTotal: countRes[0].total,
            recordsFiltered: countRes[0].total,
            data: rows
        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });

    }
};


exports.getDrillDownData = async (req, res) => {
    try {
        const { field, row } = req.body;
        const uKey = row?.unique_key;

        if (!uKey) {
            return res.status(400).json({ error: "Unique Key is missing in request" });
        }

        let sql = '';
        // 1. PTD Drilldown
        if (field === 'ptd') {
            sql = `SELECT * FROM v_cj74_transformed WHERE unique_key = ?`;
        } 
        // 2. Open Commitment Drilldown
        else if (field === 'open_commitment') {
            sql = `SELECT * FROM v_cji5_transformed WHERE unique_key = ?`;
        }

        const [rows] = await db.query(sql, [uKey]);
        res.json(rows);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.exportDrillDown = async (req, res) => {
    try {
        const { field, unique_key } = req.query;
        if (!unique_key) return res.status(400).send("Missing Unique Key");

        let sql = '';
        // Filename se special characters saaf karein
        const safeKey = unique_key.replace(/[^a-z0-9]/gi, '_');
        const fileName = field === 'ptd' ? `PTD_${safeKey}.xlsx` : `OC_${safeKey}.xlsx`;

        if (field === 'ptd') {
            sql = `SELECT * FROM v_cj74_transformed WHERE unique_key = ?`;
        } else {
            sql = `SELECT * FROM v_cji5_transformed WHERE unique_key = ?`;
        }

        const [rows] = await db.query(sql, [unique_key]);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        // 🔥 FIX: Filename ko quotes mein dala taaki commas issue na karein
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const worksheet = workbook.addWorksheet('Details');

        if (rows.length > 0) {
            worksheet.columns = Object.keys(rows[0]).map(key => ({ 
                header: key.replace(/_/g, ' ').toUpperCase(), 
                key: key 
            }));
            rows.forEach(row => worksheet.addRow(row).commit());
        }

        await workbook.commit();
    } catch (error) { 
        console.error(error);
        res.status(500).send("Export failed"); 
    }
};


// Dropdown filter options for Summary View page
exports.getFilterOptions = async (req, res) => {
    try {
        const { 
            type, 
            allowedCustomers, 
            bu, 
            wbs, 
            customer, 
            loa_id, 
            loa_name, 
            active_inactive, 
            period, 
            wbs_type, 
            wbs_description 
        } = req.query;

        // 1. Base Conditions
        let baseConditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')", 
            "cost_revenue <> 'NTC'"
        ];
        let baseParams = [];

        applyRLS(type, allowedCustomers, baseConditions, baseParams);

        // 2. Optimized Helper Function
        const getFilteredDistinct = async (targetColumn, currentFilters) => {
            let conditions = [...baseConditions];
            let filterValues = [...baseParams];

            // Apply active filters except the target column itself
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

            const colSafe = db.escapeId(targetColumn);
            
            // 🔥 FIX: Push 'IS NOT NULL' directly to conditions array to prevent SQL Syntax Errors
            conditions.push(`${colSafe} IS NOT NULL`);

            const whereSql = `WHERE ${conditions.join(' AND ')}`;
            const sql = `SELECT DISTINCT ${colSafe} as value FROM final_dashboard_table ${whereSql} ORDER BY ${colSafe}`;

            const [rows] = await db.query(sql, filterValues);
            return rows.map(r => r.value);
        };

        // 🔥 Added 'wbs_type' and 'wbs_description' to currentFilters to enable cascading sync
        const currentFilters = { 
            bu, 
            wbs, 
            customer, 
            loa_id, 
            loa_name, 
            active_inactive, 
            period,
            wbs_type,
            wbs_description
        };
        
        // 3. Parallel execution (Properly aligned variables)
        const [
            buOpts, 
            wbsOptsRaw, 
            custOpts, 
            loaIdOpts, 
            loaNameOpts, 
            activeOpts, 
            periodOpts, 
            wbsTypeOpts,        // Aligned correctly at Index 7
            wbsDescriptionOpts  // Aligned correctly at Index 8
        ] = await Promise.all([
            getFilteredDistinct('bu', currentFilters),
            getFilteredDistinct('wbs', currentFilters),
            getFilteredDistinct('customer', currentFilters),
            getFilteredDistinct('loa_id', currentFilters),
            getFilteredDistinct('loa_name', currentFilters),
            getFilteredDistinct('active_inactive', currentFilters),
            getFilteredDistinct('period', currentFilters),
            getFilteredDistinct('wbs_type', currentFilters),
            getFilteredDistinct('wbs_description', currentFilters),
        ]);

        // 4. WBS Comma Splitting Logic (Safe) for filter dropdown
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
            period: periodOpts,
            wbs_type: wbsTypeOpts,
            wbs_description: wbsDescriptionOpts,
        });

    } catch (error) {
        console.error("Filter Sync Error:", error.message);
        res.status(500).json({ error: "Failed to load filters: " + error.message });
    }
};

// Non committed cell inputs from user update
exports.updateNonCommitted = async (req, res) => {
    const { updates, createdBy } = req.body;

    try {

        const monthYear = new Date()
            .toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric'
            })
            .replace(' ', '-');

        for (let item of updates) {

            // Purani value fetch karo
            const [existing] = await db.query(
                `
                SELECT
                    non_committed_editable,
                    customer,
                    bu,
                    loa_id,
                    active_inactive
                FROM summary
                WHERE loa_name = ?
                  AND categories = ?
                `,
                [
                    item.loa_name,
                    item.categories
                ]
            );

            const oldValue =
                existing?.[0]?.non_committed_editable || 0;

            const customer =
                existing?.[0]?.customer || '';

            const bu =
            existing?.[0]?.bu || '';

            const loaId =
            existing?.[0]?.loa_id || '';

            const activeInactive =
            existing?.[0]?.active_inactive || '';

            // Summary update
            await db.query(
                `
                UPDATE summary
                SET non_committed_editable = ?,
                    updated_by = ?
                WHERE loa_name = ?
                  AND categories = ?
                `,
                [
                    item.value,
                    createdBy,
                    item.loa_name,
                    item.categories
                ]
            );

            // Final dashboard update
            await db.query(
                `
                UPDATE final_dashboard_table
                SET non_committed_editable = ?,
                    updated_by = ?
                WHERE loa_name = ?
                  AND categories = ?
                `,
                [
                    item.value,
                    createdBy,
                    item.loa_name,
                    item.categories
                ]
            );

            // Activity Log Insert
            await db.query(
                `
                INSERT INTO user_activity_logs
                (
                    user_email,
                    bu,
                    customer,
                    loa_name,
                    loa_id,
                    categories,
                    old_value,
                    new_value,
                    active_inactive,
                    month_year
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    createdBy,
                    bu,
                    customer,
                    item.loa_name,
                    loaId,
                    item.categories,
                    oldValue,
                    item.value,
                    activeInactive,
                    monthYear
                ]
            );
        }

        res.status(200).json({
            message: "Changes saved successfully!"
        });

    } catch (error) {

        console.error(
            "updateNonCommitted Error:",
            error
        );

        res.status(500).json({
            error: error.message
        });
    }
};

exports.getUserActivityLogs = async (req, res) => {
    try {

        const [rows] = await db.query(`
            SELECT
                id,
                user_email,
                bu,
                customer,
                loa_name,
                loa_id,
                categories,
                old_value,
                new_value,
                month_year,
                created_at
            FROM user_activity_logs
            ORDER BY created_at DESC
        `);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: error.message
        });
    }
};

exports.getPendingUsers = async (req, res) => {
    try {

        const monthYear = new Date()
            .toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric'
            })
            .replace(' ', '-');

        const [rows] = await db.query(`
            SELECT
                u.email,
                u.type
            FROM users u

            LEFT JOIN (
                SELECT DISTINCT user_email
                FROM user_activity_logs
                WHERE month_year = ?
            ) l

            ON u.email = l.user_email

            WHERE l.user_email IS NULL

            ORDER BY u.email
        `, [monthYear]);

        res.json(rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: error.message
        });
    }
};

// 3. Excel Export function for Summmary View
exports.exportToExcel = async (req, res) => {
    try {
        const { showAll, collapseView, type, allowedCustomers, ...filters } = req.query;

        console.log("showAll:", showAll);
        console.log("collapseView:", collapseView);
        console.log("filters:", filters);

        // 1. Filters Setup (Same as UI)
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'"
        ];

        let params = [];

        applyRLS(type, allowedCustomers, conditions, params);
        
        // Agar 'Show All' nahi hai, toh zero rows filter lagayein
        if (showAll === 'false') {
    conditions.push(`
        (
            ABS(asbl) > 0.01
            OR ABS(ptd) > 0.01
            OR ABS(total_oc_fixed) > 0.01
            OR ABS(non_committed_editable) > 0.01
        )
    `);
}

        const allowedFilters = ['bu', 'wbs', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period'];
        allowedFilters.forEach(key => {
            if (filters[key] && filters[key] !== 'All') {
                conditions.push(`${key} = ?`);
                params.push(filters[key]);
            }
        });

        const whereClause = " WHERE " + conditions.join(" AND ");

        // 2. 🔥 MATRIX EXPORT QUERY (Exactly like UI)
        let exportQuery = '';


// COLLAPSE VIEW EXPORT
if (collapseView === 'true') {

    exportQuery = `
        SELECT
            bu,
            customer,
            loa_name,
            loa_id,
            cost_revenue,

            ROUND(MAX(asbl), 2) AS asbl,

            ROUND(MAX(asbl_loa), 2) AS asbl_loa,

            ROUND(SUM(ptd), 2) AS ptd,

            ROUND(MAX(total_oc_fixed), 2) AS open_commitment,

            ROUND(MAX(non_committed_editable), 2) AS non_committed,

            ROUND(
                SUM(ptd)
                + MAX(total_oc_fixed)
                + MAX(non_committed_editable),
            2) AS eac,

            ROUND(
                MAX(asbl)
                -
                (
                    SUM(ptd)
                    + MAX(total_oc_fixed)
                    + MAX(non_committed_editable)
                ),
            2) AS eac_vs_asbl

        FROM final_dashboard_table

        ${whereClause}

        GROUP BY
            bu,
            customer,
            loa_name,
            loa_id,
            cost_revenue

        ORDER BY loa_name ASC
    `;

} else {

    // 🔥 EXPAND VIEW EXPORT (Current View)

        exportQuery = `
            SELECT
                bu,
                customer,
                loa_name,
                loa_id,
                cost_revenue,
                categories,

                MAX(asbl) as asbl,
                MAX(asbl_loa) as asbl_loa,
                SUM(ptd) as ptd,
                MAX(total_oc_fixed) as open_commitment,
                MAX(non_committed_editable) as non_committed,

                (
                    SUM(ptd)
                    + MAX(total_oc_fixed)
                    + MAX(non_committed_editable)
                ) as eac,

                (
                    MAX(asbl)
                    -
                    (
                        SUM(ptd)
                        + MAX(total_oc_fixed)
                        + MAX(non_committed_editable)
                    )
                ) as eac_vs_asbl

            FROM final_dashboard_table

            ${whereClause}

            GROUP BY
                bu,
                customer,
                loa_name,
                loa_id,
                cost_revenue,
                categories

            HAVING
                ABS(MAX(asbl)) > 0.01
                OR ABS(SUM(ptd)) > 0.01
                OR ABS(MAX(total_oc_fixed)) > 0.01
                OR ABS(MAX(non_committed_editable)) > 0.01

            ORDER BY
                loa_name ASC,
                categories ASC
            `;
    }

        // 3. Excel Setup
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Summary_Export_${new Date().getTime()}.xlsx`);
        
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const worksheet = workbook.addWorksheet('Matrix Data');
        
        if (collapseView === 'true') {

        worksheet.columns = [
            { header: 'BU', key: 'bu', width: 10 },
            { header: 'Customer', key: 'customer', width: 25 },
            { header: 'LOA Name', key: 'loa_name', width: 35 },
            { header: 'LOA ID', key: 'loa_id', width: 15 },
            { header: 'Cost/Revenue', key: 'cost_revenue', width: 15 },
            { header: 'ASBL', key: 'asbl', width: 15 },
            { header: 'ASBL LOA', key: 'asbl_loa', width: 15 },
            { header: 'PTD', key: 'ptd', width: 15 },
            { header: 'Open Commitment', key: 'open_commitment', width: 15 },
            { header: 'Non Committed', key: 'non_committed', width: 15 },
            { header: 'EAC', key: 'eac', width: 15 },
            { header: 'EAC vs ASBL', key: 'eac_vs_asbl', width: 15 }
        ];

    } else {

        worksheet.columns = [
            { header: 'BU', key: 'bu', width: 10 },
            { header: 'Customer', key: 'customer', width: 25 },
            { header: 'LOA Name', key: 'loa_name', width: 35 },
            { header: 'LOA ID', key: 'loa_id', width: 15 },
            { header: 'Cost/Revenue', key: 'cost_revenue', width: 15 },
            { header: 'Category', key: 'categories', width: 25 },
            { header: 'ASBL', key: 'asbl', width: 15 },
            { header: 'ASBL LOA', key: 'asbl_loa', width: 15 },
            { header: 'PTD', key: 'ptd', width: 15 },
            { header: 'Open Commitment', key: 'open_commitment', width: 15 },
            { header: 'Non Committed', key: 'non_committed', width: 15 },
            { header: 'EAC', key: 'eac', width: 15 },
            { header: 'EAC vs ASBL', key: 'eac_vs_asbl', width: 15 }
        ];
    }

        const [rows] = await db.query(exportQuery, params);

            rows.forEach(row => {

                row.asbl = Number(row.asbl || 0);
                row.asbl_loa = Number(row.asbl_loa || 0);
                row.ptd = Number(row.ptd || 0);
                row.open_commitment = Number(row.open_commitment || 0);
                row.non_committed = Number(row.non_committed || 0);
                row.eac = Number(row.eac || 0);
                row.eac_vs_asbl = Number(row.eac_vs_asbl || 0);

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
            (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs,wbs_type, wbs_description, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key)
            SELECT bu, customer, loa_id, loa_name, cost_revenue, categories, wbs,wbs_type, wbs_description, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key 
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


// 1. Dashboard Filters (SYNCED All Dashboard FILTERS with Multi-Select Fix)
exports.getDashboardFilters = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;

        // 🔥 Helper function to build WHERE clause dynamically by excluding the active filter
        const buildConditions = (excludeKey) => {
            const {
                years,
                periods,
                customers,
                active_inactive,
                loa_names
            } = req.query;

            let conditions = [
                "period IS NOT NULL",
                "customer IS NOT NULL",
                "customer <> ''",
                "loa_name IS NOT NULL",
                "loa_name <> ''"
            ];
            let params = [];

            // Apply Row Level Security (Always active)
            applyRLS(type, allowedCustomers, conditions, params);

            // YEAR FILTER (Ignore if fetching Years/Periods options)
            if (years && excludeKey !== 'years' && excludeKey !== 'periods') {
                const yearArray = years.split(',');
                const yearConditions = yearArray.map(() => "period LIKE ?");
                conditions.push(`(${yearConditions.join(' OR ')})`);
                params.push(...yearArray.map(y => `${y}-%`));
            }

            // PERIOD FILTER (Ignore if fetching Periods/Years options)
            if (periods && excludeKey !== 'periods' && excludeKey !== 'years') {
                const periodArray = periods.split(',');
                const placeholders = periodArray.map(() => '?').join(',');
                conditions.push(`period IN (${placeholders})`);
                params.push(...periodArray);
            }

            // CUSTOMER FILTER (Ignore if fetching Customers options)
            if (customers && excludeKey !== 'customers') {
                const customerArray = customers.split(',');
                const placeholders = customerArray.map(() => '?').join(',');
                conditions.push(`customer IN (${placeholders})`);
                params.push(...customerArray);
            }

            // LOA FILTER (Ignore if fetching LOA Name options)
            if (loa_names && excludeKey !== 'loa_names') {
                const loaArray = loa_names.split(',');
                const placeholders = loaArray.map(() => '?').join(',');
                conditions.push(`loa_name IN (${placeholders})`);
                params.push(...loaArray);
            }

            // Active Inactive Status Filter (Always active)
            if (active_inactive) {
                conditions.push(`active_inactive = ?`);
                params.push(active_inactive);
            }

            const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
            return { whereSql, params };
        };

        // 1. Fetch PERIODS & YEARS (Exclude years/periods filters from condition)
        const periodQueryObj = buildConditions('periods');
        const [periodRows] = await db.query(`
            SELECT DISTINCT period
            FROM final_dashboard_table
            ${periodQueryObj.whereSql}
            ORDER BY period DESC
        `, periodQueryObj.params);

        // 2. Fetch CUSTOMERS (Exclude customers filters from condition)
        const customerQueryObj = buildConditions('customers');
        const [customerRows] = await db.query(`
            SELECT DISTINCT customer
            FROM final_dashboard_table
            ${customerQueryObj.whereSql}
            ORDER BY customer ASC
        `, customerQueryObj.params);

        // 3. Fetch LOA NAMES (Exclude loa_names filters from condition)
        const loaQueryObj = buildConditions('loa_names');
        const [loaRows] = await db.query(`
            SELECT DISTINCT loa_name
            FROM final_dashboard_table
            ${loaQueryObj.whereSql}
            ORDER BY loa_name ASC
        `, loaQueryObj.params);

        // Process distinct years from compiled period rows
        const yearsList = [
            ...new Set(
                periodRows.map(r => r.period?.split('-')[0])
            )
        ].sort((a, b) => b - a);

        res.status(200).json({
            years: yearsList,
            periods: periodRows.map(r => r.period),
            customers: customerRows.map(r => r.customer),
            loa_names: loaRows.map(r => r.loa_name)
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
        const { years, periods, customers, loa_names, active_inactive, wbs_type, showAll, type, allowedCustomers } = req.query;
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];
        let params = [];
        // ======================
        // RLS LOGIC
        // ======================
        applyRLS(type, allowedCustomers, conditions, params);

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

        // MULTI LOA FILTER
        if (loa_names) {
            const loaArray =
                loa_names.split(',');
            const placeholders =
                loaArray.map(() => '?').join(',');
            conditions.push(
                `loa_name IN (${placeholders})`
            );
            params.push(...loaArray);
        }

        // Active Inactive Status Filter
        if (active_inactive) {
            conditions.push(`active_inactive = ?`);
            params.push(active_inactive);
        }

        // 🔥 Added WBS Type condition
        if (wbs_type && wbs_type !== 'All') {
            conditions.push(`wbs_type = ?`);
            params.push(wbs_type);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT
                bu,
                SUM(asbl) AS asbl,
                SUM(ptd) AS ptd,
                SUM(eac) AS eac
            FROM (
                SELECT
                    bu,
                    MAX(asbl) AS asbl,
                    SUM(ptd) AS ptd,
                    (
                        SUM(ptd)
                        + MAX(total_oc_fixed)
                        + MAX(non_committed_editable)
                    ) AS eac
                FROM final_dashboard_table
                ${whereSql}
                GROUP BY
                    bu,
                    customer,
                    loa_id,
                    loa_name,
                    cost_revenue,
                    categories
            ) x
            GROUP BY bu`;

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
        const { years, periods, customers, loa_names, active_inactive, wbs_type, showAll, type, allowedCustomers } = req.query;
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

        // ======================
        // RLS LOGIC
        // ======================
        applyRLS(type, allowedCustomers, conditions, params);

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

        // MULTI LOA FILTER
        if (loa_names) {
            const loaArray =
                loa_names.split(',');
            const placeholders =
                loaArray.map(() => '?').join(',');
            conditions.push(
                `loa_name IN (${placeholders})`
            );
            params.push(...loaArray);
        }

        // Active Inactive Status Filter
        if (active_inactive) {
            conditions.push(`active_inactive = ?`);
            params.push(active_inactive);
        }

        // 🔥 Added WBS Type condition
        if (wbs_type && wbs_type !== 'All') {
            conditions.push(`wbs_type = ?`);
            params.push(wbs_type);
        }

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
                SELECT
                    loa_name,
                    SUM(asbl) AS asbl,
                    SUM(ptd) AS ptd,
                    SUM(eac) AS eac
                FROM (
                    SELECT
                        loa_name,
                        MAX(asbl) AS asbl,
                        SUM(ptd) AS ptd,
                        (
                            SUM(ptd)
                            + MAX(total_oc_fixed)
                            + MAX(non_committed_editable)
                        ) AS eac
                    FROM final_dashboard_table
                    ${whereSql}
                    GROUP BY
                        bu,
                        customer,
                        loa_id,
                        loa_name,
                        cost_revenue,
                        categories
                ) x
                GROUP BY loa_name
                ORDER BY asbl DESC
                ${limitSql}`;

        const [rows] =
            await db.query(sql, params);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

// 4. Non Committed Trend for LOA (Dashboard page ke liye)
exports.getNonCommittedTrend = async (req, res) => {
    try {
        const { loa_name = '' , active_inactive = ''} = req.query;
        const currentMonthYear = new Date()
            .toLocaleString('en-US', {
                month: 'short',
                year: 'numeric'
            })
            .replace(' ', '-');
        const [rows] = await db.query(
            `
            SELECT
                latest.month_year,
                SUM(latest.new_value) AS total_non_committed
            FROM
            (
                SELECT l1.*
                FROM user_activity_logs l1
                INNER JOIN
                (
                    SELECT
                        loa_name,
                        categories,
                        month_year,
                        MAX(id) AS latest_id
                    FROM user_activity_logs
                    GROUP BY
                        loa_name,
                        categories,
                        month_year
                ) l2
                ON l1.id = l2.latest_id
            ) latest
            WHERE
                (? = '' OR latest.loa_name = ?)
                AND (? = '' OR latest.active_inactive = ?)
                AND latest.month_year <> ?
            GROUP BY latest.month_year
            ORDER BY STR_TO_DATE(
                CONCAT('01-', latest.month_year),
                '%d-%b-%Y'
            ) DESC
            LIMIT 6
            `,
            [
                loa_name,
                loa_name,
                active_inactive,
                active_inactive,
                currentMonthYear
            ]
        );
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: error.message
        });
    }
};

// 5. Distinct LOA Names for Trend Dropdown (Dashboard page ke liye)
exports.getTrendLoas = async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT DISTINCT loa_name
            FROM user_activity_logs
            ORDER BY loa_name
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

// 3. Final Dashboard ke liye BU-wise aggregated data (Dashboard page ke liye)
exports.getFinalDashboardTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];
        let params = [];

        // ======================
        // RLS LOGIC
        // ======================
        applyRLS(type, allowedCustomers, conditions, params);
        applyDashboardFilters(req.query, conditions, params);
        const whereSql =
            `WHERE ${conditions.join(' AND ')}`;
        const sql = `
            SELECT
                bu,
                ROUND(SUM(asbl), 2) AS asbl,
                ROUND(SUM(asbl_loa), 2) AS asbl_loa,
                ROUND(SUM(ptd), 2) AS ptd,
                ROUND(SUM(open_commitment), 2) AS open_commitment,
                ROUND(SUM(non_committed), 2) AS non_committed,
                ROUND(SUM(eac), 2) AS eac,
                ROUND(SUM(eac_vs_asbl), 2) AS eac_vs_asbl
            FROM (
                SELECT
                    bu,
                    customer,
                    loa_id,
                    loa_name,
                    cost_revenue,
                    categories,

                    COALESCE(MAX(asbl), 0) as asbl,
                    COALESCE(MAX(asbl_loa), 0) as asbl_loa,
                    COALESCE(SUM(ptd), 0) as ptd,
                    COALESCE(MAX(total_oc_fixed), 0) as open_commitment,
                    COALESCE(MAX(non_committed_editable), 0) as non_committed,
                    (
                        COALESCE(SUM(ptd), 0)
                        + COALESCE(MAX(total_oc_fixed), 0)
                        + COALESCE(MAX(non_committed_editable), 0)
                    ) as eac,
                    (
                        COALESCE(MAX(asbl), 0)
                        -
                        (
                            COALESCE(SUM(ptd), 0)
                            + COALESCE(MAX(total_oc_fixed), 0)
                            + COALESCE(MAX(non_committed_editable), 0)
                        )
                    ) as eac_vs_asbl
                FROM final_dashboard_table
                ${whereSql}
                GROUP BY
                    bu,
                    customer,
                    loa_id,
                    loa_name,
                    cost_revenue,
                    categories
            ) x
            GROUP BY bu
            ORDER BY bu ASC
        `;

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error("DB ERROR:", error);
        res.status(500).json({
            error: error.message
        });
    }
};

// 2. LOA-wise detailed table
exports.getCostViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];
        let params = [];
        applyRLS(type, allowedCustomers, conditions, params);
        applyDashboardFilters(req.query, conditions, params);

        const whereSql =
            `WHERE ${conditions.join(' AND ')}`;
        const sql = `
                SELECT
                    bu,
                    customer,
                    loa_id,
                    loa_name,
                    ROUND(SUM(asbl), 2) AS asbl,
                    ROUND(SUM(asbl_loa), 2) AS asbl_loa,
                    ROUND(SUM(ptd), 2) AS ptd,
                    ROUND(SUM(open_commitment), 2) AS open_commitment,
                    ROUND(SUM(non_committed), 2) AS non_committed,
                    ROUND(SUM(eac), 2) AS eac,
                    ROUND(SUM(eac_vs_asbl), 2) AS eac_vs_asbl
                FROM (
                    SELECT
                        bu,
                        loa_name,
                        customer,
                        loa_id,
                        cost_revenue,
                        categories,
                        COALESCE(MAX(asbl), 0) AS asbl,
                        COALESCE(MAX(asbl_loa), 0) AS asbl_loa,
                        COALESCE(SUM(ptd), 0) AS ptd,
                        COALESCE(MAX(total_oc_fixed), 0) AS open_commitment,
                        COALESCE(MAX(non_committed_editable), 0) AS non_committed,
                        (
                            COALESCE(SUM(ptd), 0)
                            + COALESCE(MAX(total_oc_fixed), 0)
                            + COALESCE(MAX(non_committed_editable), 0)
                        ) AS eac,
                        (
                            COALESCE(MAX(asbl), 0)
                            -
                            (
                                COALESCE(SUM(ptd), 0)
                                + COALESCE(MAX(total_oc_fixed), 0)
                                + COALESCE(MAX(non_committed_editable), 0)
                            )
                        ) AS eac_vs_asbl
                    FROM final_dashboard_table
                    ${whereSql}
                    GROUP BY
                        bu,
                        loa_name,
                        customer,
                        loa_id,
                        cost_revenue,
                        categories
                ) x
                GROUP BY
                    bu,
                    customer,
                    loa_id,
                    loa_name
                ORDER BY
                    SUM(asbl) DESC
            `;
        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: error.message
        });
    }
};

// CUSTOMER VIEW TABLE

exports.getCustomerViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        const conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];

        let params = [];
        applyRLS(type, allowedCustomers, conditions, params);
        applyDashboardFilters(req.query, conditions, params);

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
                SELECT
                    customer,
                    ROUND(SUM(asbl), 2) AS asbl,
                    ROUND(SUM(asbl_loa), 2) AS asbl_loa,
                    ROUND(SUM(ptd), 2) AS ptd,
                    ROUND(SUM(open_commitment), 2) AS open_commitment,
                    ROUND(SUM(non_committed), 2) AS non_committed,
                    ROUND(SUM(eac), 2) AS eac,
                    ROUND(SUM(eac_vs_asbl), 2) AS eac_vs_asbl
                FROM (
                    SELECT
                        customer,
                        MAX(asbl) AS asbl,
                        MAX(asbl_loa) AS asbl_loa,
                        SUM(ptd) AS ptd,
                        MAX(total_oc_fixed) AS open_commitment,
                        MAX(non_committed_editable) AS non_committed,
                        (
                            SUM(ptd)
                            + MAX(total_oc_fixed)
                            + MAX(non_committed_editable)
                        ) AS eac,
                        (
                            MAX(asbl)
                            -
                            (
                                SUM(ptd)
                                + MAX(total_oc_fixed)
                                + MAX(non_committed_editable)
                            )
                        ) AS eac_vs_asbl
                    FROM final_dashboard_table
                    ${whereSql}
                    GROUP BY
                        customer,
                        loa_id,
                        loa_name,
                        cost_revenue,
                        categories
                ) x
                GROUP BY customer
                ORDER BY asbl DESC
            `;

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: error.message
        });
    }
};

// BU + CUSTOMER VIEW
exports.getBuCustomerViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];
        let params = [];
        applyRLS(type, allowedCustomers, conditions, params);
        applyDashboardFilters(req.query, conditions, params);

        const whereSql =
            `WHERE ${conditions.join(' AND ')}`;
        const sql = `
                SELECT
                    bu,
                    customer,
                    ROUND(SUM(asbl), 2) AS asbl,
                    ROUND(SUM(asbl_loa), 2) AS asbl_loa,
                    ROUND(SUM(ptd), 2) AS ptd,
                    ROUND(SUM(open_commitment), 2) AS open_commitment,
                    ROUND(SUM(non_committed), 2) AS non_committed,
                    ROUND(SUM(eac), 2) AS eac,
                    ROUND(SUM(eac_vs_asbl), 2) AS eac_vs_asbl
                FROM (
                    SELECT
                        bu,
                        customer,
                        loa_id,
                        loa_name,
                        cost_revenue,
                        categories,
                        MAX(asbl) AS asbl,
                        MAX(asbl_loa) AS asbl_loa,
                        SUM(ptd) AS ptd,
                        MAX(total_oc_fixed) AS open_commitment,
                        MAX(non_committed_editable) AS non_committed,
                        (
                            SUM(ptd)
                            + MAX(total_oc_fixed)
                            + MAX(non_committed_editable)
                        ) AS eac,
                        (
                            MAX(asbl)
                            -
                            (
                                SUM(ptd)
                                + MAX(total_oc_fixed)
                                + MAX(non_committed_editable)
                            )
                        ) AS eac_vs_asbl
                    FROM final_dashboard_table
                    ${whereSql}
                    GROUP BY
                        bu,
                        customer,
                        loa_id,
                        loa_name,
                        cost_revenue,
                        categories
                ) x
                GROUP BY
                    bu,
                    customer
                ORDER BY
                    bu ASC,
                    asbl DESC
            `;

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

// CUSTOMER + BU VIEW
exports.getCustomerBuViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];
        let params = [];
        applyRLS(type, allowedCustomers, conditions, params);
        applyDashboardFilters(req.query, conditions, params);
        const whereSql =
            `WHERE ${conditions.join(' AND ')}`;
        const sql = `
                SELECT
                    customer,
                    bu,
                    ROUND(SUM(asbl), 2) AS asbl,
                    ROUND(SUM(asbl_loa), 2) AS asbl_loa,
                    ROUND(SUM(ptd), 2) AS ptd,
                    ROUND(SUM(open_commitment), 2) AS open_commitment,
                    ROUND(SUM(non_committed), 2) AS non_committed,
                    ROUND(SUM(eac), 2) AS eac,
                    ROUND(SUM(eac_vs_asbl), 2) AS eac_vs_asbl
                FROM (
                    SELECT
                        customer,
                        bu,
                        loa_id,
                        loa_name,
                        cost_revenue,
                        categories,
                        MAX(asbl) AS asbl,
                        MAX(asbl_loa) AS asbl_loa,
                        SUM(ptd) AS ptd,
                        MAX(total_oc_fixed) AS open_commitment,
                        MAX(non_committed_editable) AS non_committed,
                        (
                            SUM(ptd)
                            + MAX(total_oc_fixed)
                            + MAX(non_committed_editable)
                        ) AS eac,
                        (
                            MAX(asbl)
                            -
                            (
                                SUM(ptd)
                                + MAX(total_oc_fixed)
                                + MAX(non_committed_editable)
                            )
                        ) AS eac_vs_asbl
                    FROM final_dashboard_table
                    ${whereSql}
                    GROUP BY
                        customer,
                        bu,
                        loa_id,
                        loa_name,
                        cost_revenue,
                        categories
                ) x
                GROUP BY
                    customer,
                    bu
                ORDER BY
                    customer ASC,
                    asbl DESC
            `;

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
};

// 4. Negative LOA Detailed Table
exports.getNegativeLOATable = async (req, res) => {

    try {

        const { type, allowedCustomers } = req.query;

        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];

        let params = [];

        applyRLS(type, allowedCustomers, conditions, params);
        applyDashboardFilters(req.query, conditions, params);

        const whereSql = `WHERE ${conditions.join(' AND ')}`;

        const sql = `
            SELECT
                bu,
                customer,
                loa_id,
                loa_name,
                ROUND(SUM(asbl), 2) AS asbl,
                ROUND(SUM(asbl_loa), 2) AS asbl_loa,
                ROUND(SUM(ptd), 2) AS ptd,
                ROUND(SUM(open_commitment), 2) AS open_commitment,
                ROUND(SUM(non_committed), 2) AS non_committed,
                ROUND(SUM(eac), 2) AS eac,
                ROUND(SUM(eac_vs_asbl), 2) AS eac_vs_asbl
            FROM (
                SELECT
                    bu,
                    loa_name,
                    customer,
                    loa_id,
                    cost_revenue,
                    categories,

                    SUM(asbl) AS asbl,
                    SUM(asbl_loa) AS asbl_loa,
                    SUM(ptd) AS ptd,
                    SUM(total_oc_fixed) AS open_commitment,
                    SUM(non_committed_editable) AS non_committed,

                    (SUM(ptd) + SUM(total_oc_fixed) + SUM(non_committed_editable)) AS eac,

                    (SUM(asbl) - (SUM(ptd) + SUM(total_oc_fixed) + SUM(non_committed_editable))) AS eac_vs_asbl

                FROM final_dashboard_table
                ${whereSql}

                GROUP BY bu, loa_name, customer, loa_id, cost_revenue, categories
                    ) x
                    GROUP BY bu, customer, loa_id, loa_name
                    HAVING eac_vs_asbl <= 0
                    AND COALESCE(asbl, 0) > 0
                    ORDER BY eac_vs_asbl ASC
                `;

        const [rows] = await db.query(sql, params);

        res.json(rows);

    } catch (error) {

        console.error("❌ Negative LOA Error:");
    console.error(error.sqlMessage); // if mysql error

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }
};

// 5. CUSTOMER + BU VIEW
exports.getCustomerBuLoaViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'",
            "cost_revenue = 'Cost'"
        ];

        let params = [];

        applyRLS(type, allowedCustomers, conditions, params);
        applyDashboardFilters(req.query, conditions, params);

        const whereSql =
            `WHERE ${conditions.join(' AND ')}`;

        const sql = `
            SELECT

                customer,
                bu,
                loa_name,

                ROUND(SUM(asbl), 2) AS asbl,
                ROUND(SUM(asbl_loa), 2) AS asbl_loa,
                ROUND(SUM(ptd), 2) AS ptd,
                ROUND(SUM(open_commitment), 2) AS open_commitment,
                ROUND(SUM(non_committed), 2) AS non_committed,
                ROUND(SUM(eac), 2) AS eac,
                ROUND(SUM(eac_vs_asbl), 2) AS eac_vs_asbl
            FROM (
                SELECT
                    customer,
                    bu,
                    loa_id,
                    loa_name,
                    cost_revenue,
                    categories,

                    MAX(asbl) AS asbl,
                    MAX(asbl_loa) AS asbl_loa,
                    SUM(ptd) AS ptd,
                    MAX(total_oc_fixed) AS open_commitment,
                    MAX(non_committed_editable) AS non_committed,

                    (
                        SUM(ptd)
                        + MAX(total_oc_fixed)
                        + MAX(non_committed_editable)
                    ) AS eac,

                    (
                        MAX(asbl)
                        -
                        (
                            SUM(ptd)
                            + MAX(total_oc_fixed)
                            + MAX(non_committed_editable)
                        )
                    ) AS eac_vs_asbl

                FROM final_dashboard_table

                ${whereSql}

                GROUP BY
                    customer,
                    bu,
                    loa_id,
                    loa_name,
                    cost_revenue,
                    categories

            ) x

            GROUP BY
                customer,
                bu,
                loa_name

            ORDER BY
                customer ASC,
                asbl DESC
        `;

        const [rows] = await db.query(sql, params);
        res.json(rows);
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

// erp resource page - table view
exports.getERPResource = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const search = req.query.search || '';

    const offset = (page - 1) * pageSize;

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = `
        WHERE
          tr_global_period LIKE ?
          OR lm_nokia_id_name LIKE ?
          OR resource_nokia_id_name LIKE ?
          OR home_country LIKE ?
          OR customer_team LIKE ?
          OR gic_name LIKE ?
      `;

      const searchValue = `%${search}%`;

      params = [
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      ];
    }

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
       FROM erp_resource
       ${whereClause}`,
      params
    );

    const totalRecords = countRows[0].total;

    const [rows] = await db.query(
      `
      SELECT *
      FROM erp_resource
      ${whereClause}
      ORDER BY id ASC
      LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset]
    );

    res.json({
      data: rows,
      totalRecords,
      page,
      pageSize
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Failed to fetch ERP Resource data'
    });
  }
};

// export ERP Resource data in excel
exports.exportERPResource = async (req, res) => {
  try {

    const search = req.query.search || '';

    let whereClause = '';
    let params = [];

    if (search) {
      whereClause = `
        WHERE
          tr_global_period LIKE ?
          OR lm_nokia_id_name LIKE ?
          OR resource_nokia_id_name LIKE ?
          OR home_country LIKE ?
          OR customer_team LIKE ?
      `;

      const searchValue = `%${search}%`;

      params = [
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue
      ];
    }

    const [rows] = await db.query(
      `
      SELECT *
      FROM erp_resource
      ${whereClause}
      ORDER BY id ASC
      `,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ERP Resource');
    const today = new Date();

    const formattedDate = today.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
    }).replace(/ /g, '-'); // 16-Jun-2026


    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'TR Global Period', key: 'tr_global_period', width: 20 },
      { header: 'LM Nokia ID Name', key: 'lm_nokia_id_name', width: 35 },
      { header: 'Home Country', key: 'home_country', width: 20 },
      { header: 'Resource ERP Type', key: 'resource_erp_type', width: 20 },
      { header: 'Resource Person Number', key: 'resource_person_number', width: 20 },
      { header: 'Resource Nokia ID Name', key: 'resource_nokia_id_name', width: 35 },
      { header: 'Time Entry Date', key: 'time_entry_date', width: 20 },
      { header: 'Recorded Hours', key: 'recorded_hours', width: 15 },
      { header: 'Time Entry Status', key: 'time_entry_status', width: 20 },
      { header: 'Daily Working Hours', key: 'daily_working_hours', width: 20 },
      { header: 'TR WBS/Care Contract/Opp', key: 'tr_wbs_care_contract_opp', width: 35 },
      { header: 'TR WBS Description', key: 'tr_wbs_care_contract_opp_description', width: 50 },
      { header: 'SVO ID', key: 'svo_id', width: 20 },
      { header: 'SVO Description', key: 'svo_description', width: 40 },
      { header: 'GIC', key: 'gic', width: 20 },
      { header: 'GIC Name', key: 'gic_name', width: 30 },
      { header: 'Customer Team', key: 'customer_team', width: 30 },
      { header: 'Time Approval Date', key: 'time_approval_date', width: 20 },
      { header: 'LM Email', key: 'lm_email', width: 35 },
      { header: 'Resource Email', key: 'resource_email', width: 35 }
    //   { header: 'Created By', key: 'created_by', width: 25 },
    //   { header: 'Created At', key: 'created_at', width: 25 }
    ];

    rows.forEach(row => {
      worksheet.addRow(row);
    });

    worksheet.getRow(1).font = {
      bold: true
    };

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=ERP_Resource_${formattedDate}.xlsx`
    );
    await workbook.xlsx.write(res);

    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Excel export failed'
    });
  }
};

// Excel Date Formatter to safely parse Excel dates to MySQL 'YYYY-MM-DD' format
const formatSqlDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) {
    // Convert JS Date object into date format of mysql YYYY-MM-DD 
    return val.toISOString().split('T')[0];
  }

  // direct send if string, or if cell is blank then NULL return
  return typeof val === 'string' && val.trim() !== '' ? val : null;
};

// 2. 🔥 Fuzzy Match Helper: Case, Space, and Punctuation insensitive matcher
const getValueByAliases = (normalizedRow, aliases) => {
  for (const alias of aliases) {
    // a. Exact match with lowercase alias
    if (normalizedRow[alias] !== undefined) {
      return normalizedRow[alias];
    }
    
    // b. Fallback: Strip all non-alphanumeric characters (fuzzy clean match)
    // E.g., 'tr wbs/care contract/opp' and 'TR WBS CARE CONTRACT OPP' both become 'trwbscarecontractopp'
    const cleanAlias = alias.replace(/[^a-z0-9]/g, '');
    for (const key of Object.keys(normalizedRow)) {
      const cleanKey = key.replace(/[^a-z0-9]/g, '');
      if (cleanKey === cleanAlias) {
        return normalizedRow[key];
      }
    }
  }
  return null;
};


// Cross ERP data upload file logic 
exports.uploadERPResource = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: 'Please upload a file'
      });
    }

    const workbook = XLSX.readFile(req.file.path, { cellDates: true });
    const sheetName = workbook.SheetNames[0];
    
    const created_by = req.body.created_by || (req.user && req.user.email) || 'System';
    console.log("Uploaded By:", created_by);
    
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    console.log("Total Rows parsed:", rows.length);

    const currentMonth = new Date().toLocaleDateString(
      'en-US',
      {
        month: 'short',
        year: 'numeric'
      }
    ).replace(' ', '-');

    for (const row of rows) {
      // A. Normalize current row keys to lower case and trim extra spaces
      const normalizedRow = {};
      for (const key of Object.keys(row)) {
        normalizedRow[key.toLowerCase().trim()] = row[key];
      }

      // B. Retrieve values using flexible aliases (helps handle lowercase/uppercase/caps/typos)
      const tr_global_period = getValueByAliases(normalizedRow, ['tr global period', 'trglobalperiod']);
      const lm_nokia_id_name = getValueByAliases(normalizedRow, ['lm nokia id, name', 'lm nokia id name', 'lmnokiaidname']);
      const home_country = getValueByAliases(normalizedRow, ['home country', 'homecountry']);
      const resource_erp_type = getValueByAliases(normalizedRow, ['resource erp type', 'resourceerptype']);
      
      // Handles spelling variations ('persn.' vs 'person')
      const resource_person_number = getValueByAliases(normalizedRow, ['resource persn. number', 'resource persn number', 'resource person number', 'resourcepersonnumber']);
      const resource_nokia_id_name = getValueByAliases(normalizedRow, ['resource nokia id, name', 'resource nokia id name', 'resourcenokiaidname']);
      
      const time_entry_date = formatSqlDate(getValueByAliases(normalizedRow, ['time entry date', 'timeentrydate']));
      const recorded_hours = getValueByAliases(normalizedRow, ['recorded hours', 'recordedhours']);
      const time_entry_status = getValueByAliases(normalizedRow, ['time entry status', 'timeentrystatus']);
      const daily_working_hours = getValueByAliases(normalizedRow, ['daily working hours', 'dailyworkinghours']);
      
      // Handles slash variation ('wbs/care' vs 'wbs care')
      const tr_wbs_care_contract_opp = getValueByAliases(normalizedRow, ['tr wbs/care contract/opp', 'tr wbs care contract opp', 'trwbscarecontractopp']);
      const tr_wbs_care_contract_opp_description = getValueByAliases(normalizedRow, ['tr wbs/care contract/opp description', 'tr wbs care contract opp description', 'trwbscarecontractoppdescription']);
      
      const svo_id = getValueByAliases(normalizedRow, ['svo id', 'svoid']);
      const svo_description = getValueByAliases(normalizedRow, ['svo description', 'svodescription']);
      const gic = getValueByAliases(normalizedRow, ['gic']);
      const gic_name = getValueByAliases(normalizedRow, ['gic name', 'gicname']);
      
      // Flexible lookup for Customer Team columns
      const customer_team = getValueByAliases(normalizedRow, ['ct (customer team)', 'ct customer team', 'customer team', 'ct', 'customerteam']);
      
      const time_approval_date = formatSqlDate(getValueByAliases(normalizedRow, ['time approval date', 'timeapprovaldate']));
      const lm_email = getValueByAliases(normalizedRow, ['lm email', 'lmemail']);
      const resource_email = getValueByAliases(normalizedRow, ['resource email', 'resourceemail']);

      await db.query(
        `
        INSERT INTO erp_resource
        (
          tr_global_period,
          lm_nokia_id_name,
          home_country,
          resource_erp_type,
          resource_person_number,
          resource_nokia_id_name,
          time_entry_date,
          recorded_hours,
          time_entry_status,
          daily_working_hours,
          tr_wbs_care_contract_opp,
          tr_wbs_care_contract_opp_description,
          svo_id,
          svo_description,
          gic,
          gic_name,
          customer_team,
          time_approval_date,
          lm_email,
          resource_email,
          month,
          created_by
        )
        VALUES
        (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `,
        [
          tr_global_period,
          lm_nokia_id_name,
          home_country,
          resource_erp_type,
          resource_person_number,
          resource_nokia_id_name,
          time_entry_date,
          recorded_hours,
          time_entry_status,
          daily_working_hours,
          tr_wbs_care_contract_opp,
          tr_wbs_care_contract_opp_description,
          svo_id,
          svo_description,
          gic,
          gic_name,
          customer_team,
          time_approval_date,
          lm_email,
          resource_email,
          currentMonth,
          created_by
        ]
      );
    }

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      uploadedRows: rows.length,
      month: currentMonth
    });

  } catch (err) {
    console.error("UPLOAD ERROR => ", err);
    res.status(500).json({
      message: 'Upload failed: ' + err.message
    });
  }
};