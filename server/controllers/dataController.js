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
const applyDashboardFilters = (query, conditions, params) => {
    const { bu, years, periods, customers, loa_names, active_inactive } = query;

    // 🔥 BU Filter Logic (Multi-select support)
    if (bu) {
        const buArray = bu.split(',').map(b => b.trim()).filter(Boolean);
        if (buArray.length > 0) {
            conditions.push(`bu IN (${buArray.map(() => '?').join(',')})`);
            params.push(...buArray);
        }
    }

    if (years) {
        const yearArray = years.split(',');
        conditions.push(`(${yearArray.map(() => "period LIKE ?").join(' OR ')})`);
        params.push(...yearArray.map(y => `${y}-%`));
    }
    if (periods) {
        const periodArray = periods.split(',');
        conditions.push(`period IN (${periodArray.map(() => '?').join(',')})`);
        params.push(...periodArray);
    }
    if (customers) {
        const customerArray = customers.split(',');
        conditions.push(`customer IN (${customerArray.map(() => '?').join(',')})`);
        params.push(...customerArray);
    }
    if (loa_names) {
        const loaArray = loa_names.split(',');
        conditions.push(`loa_name IN (${loaArray.map(() => '?').join(',')})`);
        params.push(...loaArray);
    }
    if (active_inactive) {
        conditions.push(`active_inactive = ?`);
        params.push(active_inactive);
    }
};


// --- 1. Helper function (Params normalize karne ke liye) ---
const getValArray = (val) => {
    if (!val || val === 'All' || val === '' || (Array.isArray(val) && val.length === 0)) return null;
    let arr = Array.isArray(val) ? val : val.split(',').map(v => v.trim()).filter(Boolean);
    arr = arr.filter(v => v !== 'All'); // Remove 'All' from array
    return arr.length > 0 ? arr : null;
};

exports.getFilterOptions = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;

        // Base Rules
        let baseConditions = ["categories NOT IN ('Not to considered')", "cost_revenue <> 'NTC'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, baseConditions, baseParams);

        const getFilteredDistinct = async (targetColumn, currentFilters) => {
            let conditions = [...baseConditions];
            let filterValues = [...baseParams];

            // 🔥 WHITELIST: Sirf inhi columns par filter apply hoga
            const dbFilters = ['bu', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period', 'wbs_type', 'wbs_description', 'wbs'];

            dbFilters.forEach(key => {
                // targetColumn ko skip karein taaki dropdown khud ko filter na kare
                if (key !== targetColumn) {
                    const vals = getValArray(currentFilters[key]);
                    if (vals) {
                        const dbCol = (key === 'wbs') ? 'wbs_element_single' : `\`${key}\``;
                        conditions.push(`${dbCol} IN (?)`);
                        filterValues.push(vals);
                    }
                }
            });

            // Target column logic (Frontend 'wbs' is 'wbs_element_single' in DB)
            const finalTarget = (targetColumn === 'wbs') ? 'wbs_element_single' : `\`${targetColumn}\``;
            
            const sql = `
                SELECT DISTINCT ${finalTarget} as value 
                FROM final_dashboard_table 
                WHERE ${conditions.join(' AND ')} 
                AND ${finalTarget} IS NOT NULL AND ${finalTarget} <> ''
                ORDER BY ${finalTarget} ASC`;

            const [rows] = await db.query(sql, filterValues);
            return rows.map(r => r.value);
        };

        // Saare keys jinke options chahiye
        const keys = ['bu', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period', 'wbs_type', 'wbs_description', 'wbs'];
        
        // Parallel execution for speed
        const results = await Promise.all(keys.map(k => getFilteredDistinct(k, req.query)));
        
        // Construct response
        const response = {};
        keys.forEach((key, index) => {
            response[key] = results[index];
        });

        res.status(200).json(response);

    } catch (error) {
        console.error("Filter Options Error:", error.message);
        res.status(500).json({ error: "Failed to load filters: " + error.message });
    }
};

exports.getWbsSummary = async (req, res) => {
    try {
        const { draw, start, length, showAll, type, allowedCustomers } = req.query;
        const startIdx = parseInt(start) || 0;
        const limitIdx = parseInt(length) || 10;

        // 1. Normalize Special Filters (Inhe WHERE clause mein nahi dalenge)
        const wTArr = getValArray(req.query.wbs_type);
        const wEArr = getValArray(req.query.wbs);
        const wDArr = getValArray(req.query.wbs_description);

        const showAsbl = wTArr && !wTArr.some(t => t.toLowerCase().includes("warranty"));

        // 2. Base Conditions (RLS & NTC)
        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue <> 'NTC'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);

        // 3. Main Filter Loop (Sirf wahi filters jo poore LOA par apply hote hain)
        let filterParams = [];
        // 🔥 'wbs_type' aur 'wbs_description' ko yahan se nikaal diya hai taaki categories na chupen
        const dbFilters = ['bu', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period'];
        
        dbFilters.forEach(key => {
            const vals = getValArray(req.query[key]);
            if (vals) {
                conditions.push(`\`${key}\` IN (?)`);
                filterParams.push(vals);
            }
        });

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // 4. Matrix Query (Conditional Aggregation)
        const matrixQuery = `
            SELECT 
                bu, customer, loa_id, loa_name, cost_revenue, categories,
                MAX(unique_key) as unique_key, 
                -- ASBL: Categories filter nahi hongi isliye MAX sahi value layega
                ${showAsbl ? 'COALESCE(MAX(asbl), 0)' : "'-'"} as asbl, 
                -- PTD: Sirf selected WBS filters ka sum hoga
                COALESCE(SUM(CASE 
                    WHEN (${wTArr ? 'wbs_type IN (?)' : '1=1'}) 
                    AND (${wEArr ? 'wbs_element_single IN (?)' : '1=1'}) 
                    AND (${wDArr ? 'wbs_description IN (?)' : '1=1'}) 
                    THEN ptd ELSE 0 END), 0) as ptd, 
                COALESCE(MAX(total_oc_fixed), 0) as open_commitment, 
                COALESCE(MAX(non_committed_editable), 0) as non_committed,
                COALESCE(MAX(asbl_loa), 0) as asbl_loa
            FROM final_dashboard_table
            ${whereClause}
            GROUP BY bu, customer, loa_id, loa_name, cost_revenue, categories
            HAVING 1=1 
            ${showAll === 'false' ? 'AND (ABS(COALESCE(asbl, 0)) > 0.01 OR ABS(ptd) > 0.01 OR ABS(open_commitment) > 0.01)' : ''}
            ORDER BY loa_name ASC, cost_revenue ASC
        `;

        // Parameters order: [SUM CASE params..., WHERE clause params...]
        let queryParams = [];
        if (wTArr) queryParams.push(wTArr);
        if (wEArr) queryParams.push(wEArr);
        if (wDArr) queryParams.push(wDArr);
        queryParams = [...queryParams, ...baseParams, ...filterParams];

        const [dataRows] = await db.query(`${matrixQuery} LIMIT ?, ?`, [...queryParams, startIdx, limitIdx]);
        const [countRes] = await db.query(`SELECT COUNT(*) as total FROM (${matrixQuery}) as temp`, queryParams);

        // 5. KPI Query
        const kpiQuery = `
            SELECT 
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN cat_asbl ELSE 0 END) as asbl_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN cat_asbl ELSE 0 END) as asbl_cost,
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN cat_ptd ELSE 0 END) as ptd_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN cat_ptd ELSE 0 END) as ptd_cost
            FROM (
                SELECT cost_revenue, MAX(asbl) as cat_asbl, 
                       SUM(CASE WHEN (${wTArr ? 'wbs_type IN (?)' : '1=1'}) AND (${wEArr ? 'wbs_element_single IN (?)' : '1=1'}) AND (${wDArr ? 'wbs_description IN (?)' : '1=1'}) THEN ptd ELSE 0 END) as cat_ptd
                FROM final_dashboard_table
                ${whereClause}
                GROUP BY loa_id, categories, cost_revenue
            ) as t
        `;
        const [kpiRes] = await db.query(kpiQuery, queryParams);
        const k = kpiRes[0] || {};

        res.status(200).json({
            draw: parseInt(draw) || 0,
            recordsTotal: countRes[0].total,
            recordsFiltered: countRes[0].total,
            data: dataRows,
            kpis: {
                asbl_rev: showAsbl ? Number(k.asbl_rev || 0).toFixed(2) : "-",
                asbl_cost: showAsbl ? Number(k.asbl_cost || 0).toFixed(2) : "-",
                ptd_rev: Number(k.ptd_rev || 0).toFixed(2),
                ptd_cost: Number(k.ptd_cost || 0).toFixed(2)
            }
        });
    } catch (error) {
        console.error("WbsSummary Error:", error);
        res.status(500).json({ error: error.message });
    }
};
 
// ==========================================
// 4. SUMMARY TABLE COLLAPSE VIEW
// ==========================================
exports.getWbsSummaryCollapse = async (req, res) => {
    try {
        const { draw, start, length, type, allowedCustomers, showAll } = req.query;
        const startIdx = parseInt(start) || 0;
        const limitIdx = parseInt(length) || 10;
 
        let wbsType = req.query.wbs_type;
        if (Array.isArray(wbsType)) wbsType = wbsType[0];
 
        const showAsbl = wbsType && wbsType !== "All" && wbsType !== "" && wbsType.toLowerCase() !== "warranty/other";
 
        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue <> 'NTC'"];
        let params = [];
        applyRLS(type, allowedCustomers, conditions, params);
 
        const allowedFilters = ['bu', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period', 'wbs_type', 'wbs_description'];
        allowedFilters.forEach(key => {
            let value = req.query[key];
            if (Array.isArray(value)) value = value[0];
            if (value && value !== '') {
                const valArray = value.split(',').map(v => v.trim()).filter(v => v && v !== 'All');
                if (valArray.length > 0) {
                    const placeholders = valArray.map(() => '?').join(',');
                    conditions.push(`\`${key}\` IN (${placeholders})`);
                    params.push(...valArray);
                }
            }
        });
        let wbsValue = req.query.wbs;
        if (Array.isArray(wbsValue)) wbsValue = wbsValue[0];
        if (wbsValue && wbsValue !== '') {
            const wbsArray = wbsValue.split(',').map(v => v.trim()).filter(v => v && v !== 'All');
            if (wbsArray.length > 0) {
                const placeholders = wbsArray.map(() => '?').join(',');
                conditions.push(`wbs_element_single IN (${placeholders})`);
                params.push(...wbsArray);
            }
        }
 
        const whereClause = conditions.join(' AND ');
 
        const sql = `
            SELECT
                bu, customer, loa_name, loa_id, cost_revenue,
                ${showAsbl ? 'ROUND(MAX(asbl), 2)' : "'-'"} AS asbl, 
                ROUND(MAX(asbl_loa), 2) AS asbl_loa,
                ROUND(SUM(ptd), 2) AS ptd,
                ROUND(MAX(total_oc_fixed), 2) AS open_commitment,
                ROUND(MAX(non_committed_editable), 2) AS non_committed
            FROM final_dashboard_table
            WHERE ${whereClause}
            GROUP BY bu, customer, loa_name, loa_id, cost_revenue
            ORDER BY loa_name ASC
        `;
 
        const [dataRows] = await db.query(`${sql} LIMIT ?, ?`, [...params, startIdx, limitIdx]);
        const [countRes] = await db.query(`SELECT COUNT(*) as total FROM (${sql}) temp`, params);
 
        res.status(200).json({ draw: parseInt(draw) || 0, recordsTotal: countRes[0].total, recordsFiltered: countRes[0].total, data: dataRows });
    } catch (error) {
        console.error("WbsSummaryCollapse Error:", error);
        res.status(500).json({ error: error.message });
    }
};


exports.getDrillDownData = async (req, res) => {
    try {
        const { field, row, filters, start = 0, length = 100 } = req.body;

        const loaId = row?.loa_id;
        const category = row?.categories;

        if (!loaId || !category) {
            return res.status(400).json({ error: "Missing LOA ID or Category" });
        }

        const wbsType = filters?.wbs_type || "All";
        const wbs = filters?.wbs || "All";

        let sql = "";
        let params = [];

        // ===========================
        // PTD Drilldown
        // ===========================
        if (field === "ptd") {

        sql = `
            SELECT
                sap_wbs,
                year,
                per,
                period,
                ptd_val,
                wbs_type,
                wbs_description
            FROM v_cj74_transformed
            WHERE loa_id = ?
            AND categories = ?
            ${wT !== "All" ? "AND wbs_type = ?" : ""}
            ${wE !== "All" ? "AND sap_wbs = ?" : ""}
            ORDER BY year DESC,
                    CAST(per AS UNSIGNED) DESC
        `;

        params = [loaId, category];

        if (wT !== "All")
            params.push(wT);

        if (wE !== "All")
            params.push(wE);
    }

        // ===========================
        // OPEN COMMITMENT Drilldown
        // ===========================
        else {

        sql = `
            SELECT
                sap_wbs,
                year,
                per,
                oc_val,
                wbs_type
            FROM v_cji5_transformed
            WHERE loa_id = ?
            AND categories = ?
            ${wT !== "All" ? "AND wbs_type = ?" : ""}
            ${wE !== "All" ? "AND sap_wbs = ?" : ""}
            ORDER BY year DESC,
                    CAST(per AS UNSIGNED) DESC
        `;

        params = [loaId, category];

        if (wT !== "All")
            params.push(wT);

        if (wE !== "All")
            params.push(wE);
    }

        const [rows] = await db.query(sql, params);

        res.status(200).json({
            success: true,
            count: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("Drilldown Error:", error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.exportDrillDown = async (req, res) => {
    try {
        const { field, loa_id, categories, wbs_type, wbs } = req.query;

        if (!loa_id || !categories) return res.status(400).send("Missing required parameters");

        const wT = wbs_type || 'All';
        const wE = wbs || 'All';

        let sql = '';
        const params = [loa_id, categories, wT, wT, wT, wE, wE, wE];
        
        const fileName = field === 'ptd' ? `PTD_${loa_id}_${categories}.xlsx` : `OC_${loa_id}_${categories}.xlsx`;

        if (field === 'ptd') {
            sql = `
                SELECT * FROM v_cj74_transformed 
                WHERE loa_id = ? AND categories = ?
                AND (? = 'All' OR ? = '' OR wbs_type = ?)
                AND (? = 'All' OR ? = '' OR sap_wbs = ?)
            `;
        } else {
            sql = `
                SELECT * FROM v_cji5_transformed 
                WHERE loa_id = ? AND categories = ?
                AND (? = 'All' OR ? = '' OR wbs_type = ?)
                AND (? = 'All' OR ? = '' OR sap_wbs = ?)
            `;
        }

        const [rows] = await db.query(sql, params);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/\s+/g, '_')}"`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const worksheet = workbook.addWorksheet('Details');

        if (rows.length > 0) {
            // Optimize: Headers generation
            const columns = Object.keys(rows[0]).map(key => ({ 
                header: key.replace(/_/g, ' ').toUpperCase(), 
                key: key,
                width: 20
            }));
            worksheet.columns = columns;

            // Stream rows for speed
            rows.forEach(row => {
                worksheet.addRow(row).commit();
            });
        }

        await workbook.commit();
    } catch (error) { 
        console.error("Export Error:", error);
        res.status(500).send("Export failed"); 
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
            "categories NOT IN ('Not to considered')",
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
        await db.query("TRUNCATE TABLE final_dashboard_table");

        // 🔥 Naya column 'wbs_element_single' yahan add kiya hai
        const insertSql = `
    INSERT INTO final_dashboard_table 
    (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, wbs_type, wbs_description, wbs_element_single, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key)
    SELECT 
     bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, wbs_type, wbs_description, wbs_element_single, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key 
    FROM final_dashboard
`;
        await db.query(insertSql);

        // Update total_oc_fixed (optional, but keep it if you need it for KPIs)
        await db.query(`
            UPDATE final_dashboard_table t
            JOIN (
                SELECT loa_id, categories, SUM(open_commitment_KEUR) as total_sum
                FROM final_dashboard_table
                GROUP BY loa_id, categories
            ) as src ON t.loa_id = src.loa_id AND t.categories = src.categories
            SET t.total_oc_fixed = src.total_sum
        `);

        res.status(200).json({ message: "Sync Complete!" });
    } catch (error) {
        console.error("Full Refresh Error:", error);
        res.status(500).json({ error: error.message });
    }
};


exports.getDashboardFilters = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;

        const buildConditions = (excludeKey) => {
            // 🔥 Added 'wbs_type' to destructuring here
            const { years, periods, customers, active_inactive, loa_names, bu, wbs_type } = req.query;
            let conditions = ["customer IS NOT NULL", "loa_name IS NOT NULL"];
            let params = [];

            applyRLS(type, allowedCustomers, conditions, params);

            // SYNC BU
            if (bu && excludeKey !== 'bus') {
                const buArray = bu.split(',').filter(Boolean);
                if (buArray.length > 0) {
                    conditions.push(`bu IN (${buArray.map(() => '?').join(',')})`);
                    params.push(...buArray);
                }
            }
            // 🔥 SYNC WBS TYPE
            if (wbs_type && wbs_type !== 'All' && excludeKey !== 'wbs_type') {
                conditions.push(`wbs_type = ?`);
                params.push(wbs_type);
            }
            if (years && excludeKey !== 'years') {
                const yearArray = years.split(',').filter(Boolean);
                if (yearArray.length > 0) {
                    conditions.push(`(${yearArray.map(() => "period LIKE ?").join(' OR ')})`);
                    params.push(...yearArray.map(y => `${y}-%`));
                }
            }
            if (periods && excludeKey !== 'periods') {
                const periodArray = periods.split(',').filter(Boolean);
                if (periodArray.length > 0) {
                    conditions.push(`period IN (${periodArray.map(() => '?').join(',')})`);
                    params.push(...periodArray);
                }
            }
            if (customers && excludeKey !== 'customers') {
                const customerArray = customers.split(',').filter(Boolean);
                if (customerArray.length > 0) {
                    conditions.push(`customer IN (${customerArray.map(() => '?').join(',')})`);
                    params.push(...customerArray);
                }
            }
            if (loa_names && excludeKey !== 'loa_names') {
                const loaArray = loa_names.split(',').filter(Boolean);
                if (loaArray.length > 0) {
                    conditions.push(`loa_name IN (${loaArray.map(() => '?').join(',')})`);
                    params.push(...loaArray);
                }
            }
            if (active_inactive) {
                conditions.push(`active_inactive = ?`);
                params.push(active_inactive);
            }
            return { whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
        };

        // 1. Fetch BU List
        const buQ = buildConditions('bus');
        const [buRows] = await db.query(`SELECT DISTINCT bu FROM final_dashboard_table ${buQ.whereSql} ORDER BY bu ASC`, buQ.params);

        // 🔥 2. Fetch WBS Type List (Missing in your code)
        const wbsQ = buildConditions('wbs_type');
        const [wbsRows] = await db.query(`SELECT DISTINCT wbs_type FROM final_dashboard_table ${wbsQ.whereSql} AND wbs_type IS NOT NULL ORDER BY wbs_type ASC`, wbsQ.params);

        // 3. Fetch Customer List
        const custQ = buildConditions('customers');
        const [customerRows] = await db.query(`SELECT DISTINCT customer FROM final_dashboard_table ${custQ.whereSql} ORDER BY customer ASC`, custQ.params);

        // 4. Fetch Period List
        const perQ = buildConditions('periods');
        const [periodRows] = await db.query(`SELECT DISTINCT period FROM final_dashboard_table ${perQ.whereSql} AND period IS NOT NULL ORDER BY period DESC`, perQ.params);

        // 5. Fetch LOA List
        const loaQ = buildConditions('loa_names');
        const [loaRows] = await db.query(`SELECT DISTINCT loa_name FROM final_dashboard_table ${loaQ.whereSql} ORDER BY loa_name ASC`, loaQ.params);

        const yearsList = [...new Set(periodRows.map(r => r.period?.split('-')[0]))].filter(Boolean).sort((a,b)=>b-a);

        res.status(200).json({
            bus: buRows.map(r => r.bu),
            wbs_types: wbsRows.map(r => r.wbs_type), // Ab 'wbsRows' defined hai
            years: yearsList,
            periods: periodRows.map(r => r.period),
            customers: customerRows.map(r => r.customer),
            loa_names: loaRows.map(r => r.loa_name)
        });

    } catch (error) { 
        console.error("Dashboard Filters Error:", error);
        res.status(500).json({ error: error.message }); 
    }
};

// Analytics ke liye updated logic (Is logic ko dhyan se dekhiye, ye ASBL ko double count nahi karega)
const getDashboardDataSQL = (groupByCol, showAsbl) => {
    return `
        SELECT
            ${groupByCol},
            ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "0.00"} AS asbl,
            ROUND(SUM(cat_ptd), 2) AS ptd,
            ROUND(SUM(cat_oc), 2) AS open_commitment,
            ROUND(SUM(cat_nc), 2) AS non_committed,
            ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) AS eac,
            ROUND(${showAsbl ? 'SUM(cat_asbl)' : '0.00'} - SUM(cat_ptd + cat_oc + cat_nc), 2) AS eac_vs_asbl
        FROM (
            SELECT
                ${groupByCol}, loa_id, categories,
                MAX(asbl) as cat_asbl,
                -- 🔥 Placeholder (?) use kiya hai params ke liye
                SUM(CASE 
                    WHEN (? = 'All' OR ? = '' OR wbs_type = ?) 
                    THEN ptd ELSE 0 END) as cat_ptd,
                MAX(total_oc_fixed) as cat_oc,
                MAX(non_committed_editable) as cat_nc
            FROM final_dashboard_table
            {{WHERE_CLAUSE}}
            GROUP BY ${groupByCol}, loa_id, categories
        ) inner_table
        GROUP BY ${groupByCol}
        ORDER BY ${groupByCol} ASC
    `;
};

exports.getBuAnalytics = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams); // 🔥 BU filter yahan append hoga
        
        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        const sql = `
            SELECT bu, 
                   ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(cat_ptd), 2) as ptd,
                   ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac
            FROM (
                SELECT bu, loa_id, categories,
                       MAX(asbl) as cat_asbl,
                       SUM(CASE WHEN (? = 'All' OR ? = '' OR wbs_type = ?) THEN ptd ELSE 0 END) as cat_ptd,
                       MAX(total_oc_fixed) as cat_oc,
                       MAX(non_committed_editable) as cat_nc
                FROM final_dashboard_table
                ${whereSql}
                GROUP BY bu, loa_id, categories
            ) t GROUP BY bu`;

        const [rows] = await db.query(sql, [wT, wT, wT, ...baseParams]);
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- LOA View Analytics ---
exports.getLoaAnalytics = async (req, res) => {
    try {
        const { type, allowedCustomers, showAll } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';
        const limitSql = showAll === 'true' ? '' : 'LIMIT 10';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams);
        
        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        const sql = `
            SELECT loa_name, 
                   ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(cat_ptd), 2) as ptd,
                   ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac
            FROM (
                SELECT loa_name, loa_id, categories,
                       MAX(asbl) as cat_asbl,
                       SUM(CASE WHEN (? = 'All' OR ? = '' OR wbs_type = ?) THEN ptd ELSE 0 END) as cat_ptd,
                       MAX(total_oc_fixed) as cat_oc,
                       MAX(non_committed_editable) as cat_nc
                FROM final_dashboard_table
                ${whereSql}
                GROUP BY loa_name, loa_id, categories
            ) t GROUP BY loa_name ORDER BY asbl DESC ${limitSql}`;

        const [rows] = await db.query(sql, [wT, wT, wT, ...baseParams]);
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
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

exports.getFinalDashboardTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams);
        
        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
            SELECT bu, 
                   ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(cat_asbl_loa), 2) as asbl_loa,
                   ROUND(SUM(cat_ptd), 2) as ptd,
                   ROUND(SUM(cat_oc), 2) as open_commitment,
                   ROUND(SUM(cat_nc), 2) as non_committed,
                   ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac,
                   ROUND(${showAsbl ? 'SUM(cat_asbl)' : '0.00'} - SUM(cat_ptd + cat_oc + cat_nc), 2) as eac_vs_asbl
            FROM (
                SELECT bu, loa_id, categories,
                       MAX(asbl) as cat_asbl,
                       MAX(asbl_loa) as cat_asbl_loa,
                       SUM(CASE WHEN (? = 'All' OR ? = '' OR wbs_type = ?) THEN ptd ELSE 0 END) as cat_ptd,
                       MAX(total_oc_fixed) as cat_oc,
                       MAX(non_committed_editable) as cat_nc
                FROM final_dashboard_table
                ${whereSql}
                GROUP BY bu, loa_id, categories
            ) t GROUP BY bu ORDER BY bu ASC`;

        const [rows] = await db.query(sql, [wT, wT, wT, ...baseParams]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 6. NEGATIVE LOA TABLE ---
exports.getNegativeLOATable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams);

        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
            SELECT bu, customer, loa_id, loa_name,
                   ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(cat_asbl_loa), 2) as asbl_loa,
                   ROUND(SUM(cat_ptd), 2) as ptd,
                   ROUND(SUM(cat_oc), 2) as open_commitment,
                   ROUND(SUM(cat_nc), 2) as non_committed,
                   ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac,
                   ROUND(${showAsbl ? 'SUM(cat_asbl)' : '0.00'} - SUM(cat_ptd + cat_oc + cat_nc), 2) as eac_vs_asbl
            FROM (
                SELECT bu, customer, loa_id, loa_name, categories,
                       MAX(asbl) as cat_asbl, MAX(asbl_loa) as cat_asbl_loa,
                       SUM(CASE WHEN (? = 'All' OR ? = '' OR wbs_type = ?) THEN ptd ELSE 0 END) as cat_ptd,
                       MAX(total_oc_fixed) as cat_oc, MAX(non_committed_editable) as cat_nc
                FROM final_dashboard_table ${whereSql}
                GROUP BY bu, customer, loa_id, loa_name, categories
            ) t 
            GROUP BY bu, customer, loa_id, loa_name
            HAVING eac_vs_asbl < 0 ORDER BY eac_vs_asbl ASC`;

        const [rows] = await db.query(sql, [wT, wT, wT, ...baseParams]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 🔥 Optimized and SQL-Safe Helper Function for generating View Tables
const generateTableQuery = (groupByCols, orderBySql, showValues, whereSql) => `
    SELECT
        ${groupByCols},
        ${showValues ? 'ROUND(SUM(asbl), 2)' : 'NULL'} AS asbl,
        ROUND(SUM(asbl_loa), 2) AS asbl_loa,
        ${showValues ? 'ROUND(SUM(ptd), 2)' : 'NULL'} AS ptd,
        ROUND(SUM(open_commitment), 2) AS open_commitment,
        ROUND(SUM(non_committed), 2) AS non_committed,
        ROUND(SUM(eac), 2) AS eac,
        ROUND(SUM(eac_vs_asbl), 2) AS eac_vs_asbl
    FROM (
        SELECT
            bu, customer, loa_id, loa_name, cost_revenue, categories,
            COALESCE(MAX(asbl), 0) AS asbl,
            COALESCE(MAX(asbl_loa), 0) AS asbl_loa,
            COALESCE(SUM(ptd), 0) AS ptd,
            COALESCE(MAX(total_oc_fixed), 0) AS open_commitment,
            COALESCE(MAX(non_committed_editable), 0) AS non_committed,
            (COALESCE(SUM(ptd), 0) + COALESCE(MAX(total_oc_fixed), 0) + COALESCE(MAX(non_committed_editable), 0)) AS eac,
            (COALESCE(MAX(asbl), 0) - (COALESCE(SUM(ptd), 0) + COALESCE(MAX(total_oc_fixed), 0) + COALESCE(MAX(non_committed_editable), 0))) AS eac_vs_asbl
        FROM final_dashboard_table
        ${whereSql}
        GROUP BY bu, customer, loa_id, loa_name, cost_revenue, categories
    ) x
    GROUP BY ${groupByCols}
    ${orderBySql}
`;

// --- 5. COST VIEW (LOA DETAILED) ---
exports.getCostViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams);
        
        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT bu, customer, loa_id, loa_name,
                   ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(cat_asbl_loa), 2) as asbl_loa,
                   ROUND(SUM(cat_ptd), 2) as ptd,
                   ROUND(SUM(cat_oc), 2) as open_commitment,
                   ROUND(SUM(cat_nc), 2) as non_committed,
                   ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac,
                   ROUND(${showAsbl ? 'SUM(cat_asbl)' : '0.00'} - SUM(cat_ptd + cat_oc + cat_nc), 2) as eac_vs_asbl
            FROM (
                SELECT bu, customer, loa_id, loa_name, categories,
                       MAX(asbl) as cat_asbl,
                       MAX(asbl_loa) as cat_asbl_loa,
                       SUM(CASE WHEN (? = 'All' OR ? = '' OR wbs_type = ?) THEN ptd ELSE 0 END) as cat_ptd,
                       MAX(total_oc_fixed) as cat_oc,
                       MAX(non_committed_editable) as cat_nc
                FROM final_dashboard_table
                ${whereSql}
                GROUP BY bu, customer, loa_id, loa_name, categories
            ) t GROUP BY bu, customer, loa_id, loa_name ORDER BY asbl DESC`;

        const [rows] = await db.query(sql, [wT, wT, wT, ...baseParams]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 4. CUSTOMER ONLY VIEW ---
exports.getCustomerViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams);
        
        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT customer,
                   ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(cat_asbl_loa), 2) as asbl_loa,
                   ROUND(SUM(cat_ptd), 2) as ptd,
                   ROUND(SUM(cat_oc), 2) as open_commitment,
                   ROUND(SUM(cat_nc), 2) as non_committed,
                   ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac,
                   ROUND(${showAsbl ? 'SUM(cat_asbl)' : '0.00'} - SUM(cat_ptd + cat_oc + cat_nc), 2) as eac_vs_asbl
            FROM (
                SELECT customer, loa_id, categories,
                       MAX(asbl) as cat_asbl, MAX(asbl_loa) as cat_asbl_loa,
                       SUM(CASE WHEN (? = 'All' OR ? = '' OR wbs_type = ?) THEN ptd ELSE 0 END) as cat_ptd,
                       MAX(total_oc_fixed) as cat_oc, MAX(non_committed_editable) as cat_nc
                FROM final_dashboard_table ${whereSql}
                GROUP BY customer, loa_id, categories
            ) t GROUP BY customer ORDER BY asbl DESC`;

        const [rows] = await db.query(sql, [wT, wT, wT, ...baseParams]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 1. BU + CUSTOMER VIEW ---
exports.getBuCustomerViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams);
        
        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT bu, customer,
                   ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(cat_asbl_loa), 2) as asbl_loa,
                   ROUND(SUM(cat_ptd), 2) as ptd,
                   ROUND(SUM(cat_oc), 2) as open_commitment,
                   ROUND(SUM(cat_nc), 2) as non_committed,
                   ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac,
                   ROUND(${showAsbl ? 'SUM(cat_asbl)' : '0.00'} - SUM(cat_ptd + cat_oc + cat_nc), 2) as eac_vs_asbl
            FROM (
                SELECT bu, customer, loa_id, categories,
                       MAX(asbl) as cat_asbl, MAX(asbl_loa) as cat_asbl_loa,
                       SUM(CASE WHEN (? = 'All' OR ? = '' OR wbs_type = ?) THEN ptd ELSE 0 END) as cat_ptd,
                       MAX(total_oc_fixed) as cat_oc, MAX(non_committed_editable) as cat_nc
                FROM final_dashboard_table ${whereSql}
                GROUP BY bu, customer, loa_id, categories
            ) t GROUP BY bu, customer ORDER BY bu ASC`;

        const [rows] = await db.query(sql, [wT, wT, wT, ...baseParams]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 2. CUSTOMER + BU VIEW ---
exports.getCustomerBuViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams);
        
        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT customer, bu,
                   ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(cat_asbl_loa), 2) as asbl_loa,
                   ROUND(SUM(cat_ptd), 2) as ptd,
                   ROUND(SUM(cat_oc), 2) as open_commitment,
                   ROUND(SUM(cat_nc), 2) as non_committed,
                   ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac,
                   ROUND(${showAsbl ? 'SUM(cat_asbl)' : '0.00'} - SUM(cat_ptd + cat_oc + cat_nc), 2) as eac_vs_asbl
            FROM (
                SELECT customer, bu, loa_id, categories,
                       MAX(asbl) as cat_asbl, MAX(asbl_loa) as cat_asbl_loa,
                       SUM(CASE WHEN (? = 'All' OR ? = '' OR wbs_type = ?) THEN ptd ELSE 0 END) as cat_ptd,
                       MAX(total_oc_fixed) as cat_oc, MAX(non_committed_editable) as cat_nc
                FROM final_dashboard_table ${whereSql}
                GROUP BY customer, bu, loa_id, categories
            ) t GROUP BY customer, bu ORDER BY customer ASC`;

        const [rows] = await db.query(sql, [wT, wT, wT, ...baseParams]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// --- 3. CUSTOMER + BU + LOA VIEW ---
exports.getCustomerBuLoaViewTable = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams);
        
        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
            SELECT customer, bu, loa_id, loa_name,
                   ${showAsbl ? 'ROUND(SUM(cat_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(cat_asbl_loa), 2) as asbl_loa,
                   ROUND(SUM(cat_ptd), 2) as ptd,
                   ROUND(SUM(cat_oc), 2) as open_commitment,
                   ROUND(SUM(cat_nc), 2) as non_committed,
                   ROUND(SUM(cat_ptd + cat_oc + cat_nc), 2) as eac,
                   ROUND(${showAsbl ? 'SUM(cat_asbl)' : '0.00'} - SUM(cat_ptd + cat_oc + cat_nc), 2) as eac_vs_asbl
            FROM (
                SELECT customer, bu, loa_id, loa_name, categories,
                       MAX(asbl) as cat_asbl, MAX(asbl_loa) as cat_asbl_loa,
                       SUM(CASE WHEN (? = 'All' OR ? = '' OR wbs_type = ?) THEN ptd ELSE 0 END) as cat_ptd,
                       MAX(total_oc_fixed) as cat_oc, MAX(non_committed_editable) as cat_nc
                FROM final_dashboard_table ${whereSql}
                GROUP BY customer, bu, loa_id, loa_name, categories
            ) t GROUP BY customer, bu, loa_id, loa_name ORDER BY customer ASC`;

        const [rows] = await db.query(sql, [wT, wT, wT, ...baseParams]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
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
