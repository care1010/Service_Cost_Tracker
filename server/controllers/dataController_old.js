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
    const { bu, years, periods, customers, loa_names, active_inactive, category_type } = query;

    // 🔥 CUSTOM CATEGORY TYPE LOGIC (Hide Local Materials by Default)
    if (!category_type) {
        conditions.push(`categories <> 'Local Materials'`);
    } else {
        let catArr = Array.isArray(category_type) ? category_type : category_type.split(',').map(v => v.trim());
        const hasAll = catArr.includes('All');
        const hasLM = catArr.includes('Local Materials');

        if (hasAll && !hasLM) {
            conditions.push(`categories <> 'Local Materials'`);
        } else if (!hasAll && hasLM) {
            conditions.push(`categories = 'Local Materials'`);
        } else if (hasAll && hasLM) {
            // Dono selected hain -> Sab kuch dikhao (No filter)
        } else {
            conditions.push(`categories <> 'Local Materials'`);
        }
    }

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


// --- 1. Helper function (Normalize) ---
const getValArray = (val) => {
    if (val === undefined || val === null || val === '' || val === 'null' || (Array.isArray(val) && val.length === 0)) {
        return null;
    }
    let arr = Array.isArray(val) ? val : val.toString().split(',').map(v => v.trim()).filter(Boolean);
    arr = arr.filter(v => v.toLowerCase() !== 'all'); 
    return arr.length > 0 ? arr : null;
};

// --- Category Type Filter ---
const applyCategoryTypeFilter = (catType, conditions) => {
    // 1. Parsing
    let catArr = Array.isArray(catType) ? catType : (catType ? catType.split(",") : []);
    catArr = catArr.map(v => v.trim()).filter(Boolean);

    const hasAll = catArr.includes("All");
    const hasLM = catArr.includes("Local Materials");

    // SCENARIO 1: Both (Everything)
    if (hasAll && hasLM) return;

    // SCENARIO 2: Only Local Materials
    if (hasLM && !hasAll) {
        conditions.push("TRIM(categories) = 'Local Materials'");
        return;
    }

    // SCENARIO 3: Only All (Default)
    if (hasAll || catArr.length === 0) {
        conditions.push("TRIM(categories) <> 'Local Materials'");
        return;
    }
};

// ==============================
// 2. Summary View Filters Sync
// ==============================
exports.getFilterOptions = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        
        // 1. Base Security Conditions
        let baseConditions = [
            "(categories IS NULL OR categories NOT IN ('Not to considered'))",
            "(cost_revenue IS NULL OR cost_revenue <> 'NTC')"
        ];
        let baseParams = [];
        applyRLS(type, allowedCustomers, baseConditions, baseParams);

        // 2. Mapping
        const columnMapping = {
            'bu': 'bu', 'customer': 'customer', 'loa_id': 'loa_id', 'loa_name': 'loa_name',
            'wbs_type': 'wbs_type', 'wbs': 'wbs_element_single', 
            'wbs_description': 'wbs_description', 'period': 'period',
            'active_inactive': 'active_inactive', 'category_type': 'categories'
        };

        const getFilteredOptions = async (targetField, currentFilters) => {
            let conditions = [...baseConditions];
            let filterValues = [...baseParams];

            // Category Type filter apply karna (Agar target column koi aur hai toh)
            if (targetField !== 'category_type') {
                applyCategoryTypeFilter(currentFilters.category_type, conditions);
            }

            Object.keys(columnMapping).forEach(key => {
                // Target field aur category_type ko skip karein kyunki use upar handle kiya h
                if (key !== targetField && key !== 'category_type') {
                    const vals = getValArray(currentFilters[key]);
                    if (vals && vals.length > 0 && !vals.includes('All')) {
                        const dbCol = columnMapping[key];
                        if (key === 'active_inactive' && vals.includes('Active')) {
                            conditions.push(`(\`${dbCol}\` IN (?) OR \`${dbCol}\` IS NULL OR \`${dbCol}\` = '')`);
                        } else {
                            conditions.push(`\`${dbCol}\` IN (?)`);
                        }
                        filterValues.push(vals);
                    }
                }
            });

            const dbColName = columnMapping[targetField];
            const sql = `SELECT DISTINCT \`${dbColName}\` as value 
                         FROM final_dashboard_table 
                         WHERE ${conditions.join(' AND ')} 
                         AND \`${dbColName}\` IS NOT NULL AND \`${dbColName}\` <> ''
                         ORDER BY 1 ASC`;

            const [rows] = await db.query(sql, filterValues);
            return rows.map(r => r.value);
        };

        const keys = ['bu', 'customer', 'loa_id', 'loa_name', 'wbs_type', 'wbs', 'wbs_description', 'period'];
        const results = await Promise.all(keys.map(k => getFilteredOptions(k, req.query)));

        const response = {
            category_type: ['All', 'Local Materials'],
            active_inactive: ['Active', 'Inactive']
        };
        keys.forEach((key, i) => { response[key] = results[i]; });

        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// --- Updated Helper function for SM % ---
const calculateSM = (rev, cost) => {
    const r = Math.abs(parseFloat(rev) || 0); 
    const c = parseFloat(cost) || 0;
    if (r === 0) return "0.00"; 
    const margin = ((r - c) / r) * 100;
    return margin.toFixed(2);
};

// --- Helper: KPI ke liye ---
const getDynamicSumKPI = (wbsTypes, prefix) => {
    if (!wbsTypes || wbsTypes.length === 0 || wbsTypes.includes('All')) return "0";
    let cols = [];
    if (wbsTypes.some(v => v.toLowerCase().includes('project'))) cols.push(`${prefix}_project`);
    if (wbsTypes.some(v => v.toLowerCase().includes('amc'))) cols.push(`${prefix}_amc`);
    if (wbsTypes.some(v => v.toLowerCase().includes('warranty'))) cols.push(`${prefix}_warranty`);
    return cols.length > 0 ? `(${cols.join(' + ')})` : "0";
};

// --- Updated Helper: Sirf Column names return karega ---
const getDynamicSumColumns = (wbsTypes, prefix) => {
    if (!wbsTypes || wbsTypes.length === 0 || wbsTypes.includes('All')) return "0";
    let cols = [];
    if (wbsTypes.some(v => v.toLowerCase().includes('project'))) cols.push(`${prefix}_project`);
    if (wbsTypes.some(v => v.toLowerCase().includes('amc'))) cols.push(`${prefix}_amc`);
    if (wbsTypes.some(v => v.toLowerCase().includes('warranty'))) cols.push(`${prefix}_warranty`);
    return cols.length > 0 ? `(${cols.join(' + ')})` : "0";
};

// ==============================
// 3. WBS Summary View (Matrix) - HIGH PERFORMANCE & STRICT MODE FIXED
// ==============================
exports.getWbsSummary = async (req, res) => {
    try {
        const { draw, start, length, showAll, type, allowedCustomers } = req.query;
        const startIdx = parseInt(start) || 0;
        const limitIdx = parseInt(length) || 10;

        const wTArr = getValArray(req.query.wbs_type);
        const wEArr = getValArray(req.query.wbs);

        const asblCols = getDynamicSumColumns(wTArr, 'asbl');
        const ncPrefix = (type === 'super_admin' || type === 'admin') ? 'non_committed' : 'non_committed_editable';
        const ncCols = getDynamicSumColumns(wTArr, ncPrefix);

        // Base Conditions
        let conditions = ["(categories IS NULL OR categories NOT IN ('Not to considered'))", "(cost_revenue IS NULL OR cost_revenue <> 'NTC')"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyCategoryTypeFilter(req.query.category_type, conditions);

        // Filter Logic
        let filterParams = [];
        const dbFilters = ['bu', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period', 'wbs_type', 'wbs_description'];
        dbFilters.forEach(key => {
            const vals = getValArray(req.query[key]);
            if (vals && vals.length > 0 && !vals.includes('All')) {
                conditions.push(`\`${key}\` IN (?)`);
                filterParams.push(vals);
            }
        });
        if (wEArr && !wEArr.includes('All')) { conditions.push(`wbs_element_single IN (?)`); filterParams.push(wEArr); }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const combinedParams = [...baseParams, ...filterParams];

        // 4. Matrix Query (Optimized & Strict Mode Compliant)
        const matrixQuery = `
            SELECT 
                t.bu, t.customer, t.loa_id, t.loa_name, t.cost_revenue, t.categories, 
                t.Merged_wbs_categories,
                
                -- 🔥 FIXED: Wrapped in MAX() to satisfy Strict Mode (only_full_group_by)
                ROUND(MAX(COALESCE(static.asbl_val, 0)), 2) as asbl,
                ROUND(MAX(COALESCE(static.asbl_loa_val, 0)), 2) as asbl_loa,
                
                ROUND(SUM(t.ptd_val), 2) as ptd, 
                ROUND(SUM(t.oc_val), 2) as open_commitment_KEUR, 
                ROUND(SUM(t.oc_val), 2) as open_commitment,
                
                ROUND(MAX(COALESCE(static.nc_val, 0)), 2) as non_committed_editable, 
                ROUND(MAX(COALESCE(static.nc_val, 0)), 2) as non_committed, 

                -- EAC & Variance Logic (Using MAX for static values)
                ROUND(SUM(t.ptd_val) + SUM(t.oc_val) + MAX(COALESCE(static.nc_val, 0)), 2) as eac,
                ROUND(MAX(COALESCE(static.asbl_val, 0)) - (SUM(t.ptd_val) + SUM(t.oc_val) + MAX(COALESCE(static.nc_val, 0))), 2) as eac_vs_asbl

            FROM (
                SELECT 
                    bu, customer, loa_id, loa_name, cost_revenue, categories, Merged_wbs_categories,
                    ptd as ptd_val, open_commitment_KEUR as oc_val
                FROM final_dashboard_table
                ${whereClause}
            ) as t
            LEFT JOIN (
                SELECT 
                    Merged_wbs_categories, 
                    MAX(${asblCols}) as asbl_val, 
                    MAX(asbl_loa) as asbl_loa_val,
                    MAX(${ncCols}) as nc_val
                FROM final_dashboard_table
                GROUP BY Merged_wbs_categories
            ) as static ON t.Merged_wbs_categories = static.Merged_wbs_categories
            
            GROUP BY t.bu, t.customer, t.loa_id, t.loa_name, t.cost_revenue, t.categories, t.Merged_wbs_categories
            HAVING 1=1 
            ${showAll === 'false' ? 'AND (ABS(SUM(t.ptd_val)) > 0.01 OR ABS(SUM(t.oc_val)) > 0.01 OR ABS(MAX(static.asbl_val)) > 0.01)' : ''}
            ORDER BY loa_name ASC, cost_revenue ASC
        `;

        const [dataRows] = await db.query(`${matrixQuery} LIMIT ?, ?`, [...combinedParams, startIdx, limitIdx]);
        const [countRes] = await db.query(`SELECT COUNT(*) as total FROM (${matrixQuery}) as temp`, combinedParams);

        // 5. KPI Query
        const kpiQuery = `
            SELECT 
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN cat_asbl ELSE 0 END) as asbl_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN cat_asbl ELSE 0 END) as asbl_cost,
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN cat_ptd ELSE 0 END) as ptd_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN cat_ptd ELSE 0 END) as ptd_cost,
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN (cat_ptd + cat_oc + cat_nc) ELSE 0 END) as eac_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN (cat_ptd + cat_oc + cat_nc) ELSE 0 END) as eac_cost
            FROM (
                SELECT t.cost_revenue, t.Merged_wbs_categories,
                       MAX(static.asbl_val) as cat_asbl,
                       SUM(t.ptd_val) as cat_ptd,
                       SUM(t.oc_val) as cat_oc,
                       MAX(static.nc_val) as cat_nc
                FROM (
                    SELECT cost_revenue, Merged_wbs_categories, ptd as ptd_val, open_commitment_KEUR as oc_val 
                    FROM final_dashboard_table ${whereClause}
                ) as t
                LEFT JOIN (
                    SELECT Merged_wbs_categories, MAX(${asblCols}) as asbl_val, MAX(${ncCols}) as nc_val 
                    FROM final_dashboard_table GROUP BY 1
                ) as static ON t.Merged_wbs_categories = static.Merged_wbs_categories
                GROUP BY t.cost_revenue, t.Merged_wbs_categories
            ) as aggregated_t
        `;
        
        const [kpiRes] = await db.query(kpiQuery, combinedParams);
        const k = kpiRes[0] || {};

        res.status(200).json({
            draw: parseInt(draw) || 0, recordsFiltered: countRes[0].total, data: dataRows,
            kpis: {
                asbl_rev: Number(k.asbl_rev || 0).toFixed(2), asbl_cost: Number(k.asbl_cost || 0).toFixed(2),
                asbl_sm: calculateSM(k.asbl_rev, k.asbl_cost),
                ptd_rev: Number(k.ptd_rev || 0).toFixed(2), ptd_cost: Number(k.ptd_cost || 0).toFixed(2),
                ptd_sm: calculateSM(k.ptd_rev, k.ptd_cost), eac_sm: calculateSM(k.eac_rev, k.eac_cost)
            }
        });
    } catch (error) {
        console.error("WbsSummary Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// ==============================
// 4. Summary View (Collapse)
// ==============================
exports.getWbsSummaryCollapse = async (req, res) => {
    try {
        const { draw, start, length, type, allowedCustomers } = req.query;
        const startIdx = parseInt(start) || 0;
        const limitIdx = parseInt(length) || 10;

        const wTArr = getValArray(req.query.wbs_type);
        const wEArr = getValArray(req.query.wbs);

        let conditions = ["(categories IS NULL OR categories NOT IN ('Not to considered'))", "(cost_revenue IS NULL OR cost_revenue <> 'NTC')"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);

        let filterParams = [];
        const dbFilters = ['bu', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period', 'wbs_type', 'wbs_description'];
        dbFilters.forEach(key => {
            const vals = getValArray(req.query[key]);
            if (vals && vals.length > 0 && !vals.includes('All')) {
                conditions.push(`\`${key}\` IN (?)`);
                filterParams.push(vals);
            }
        });
        if (wEArr && !wEArr.includes('All')) { conditions.push(`wbs_element_single IN (?)`); filterParams.push(wEArr); }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        let asblSumLogic = "MAX(asbl)"; 
        if (wTArr && wTArr.length > 0) {
            let parts = [];
            if (wTArr.some(v => v.toLowerCase().includes('project'))) parts.push("MAX(asbl_project)");
            if (wTArr.some(v => v.toLowerCase().includes('amc'))) parts.push("MAX(asbl_amc)");
            if (parts.length > 0) asblSumLogic = `(${parts.join(' + ')})`;
        }

        const sql = `
            SELECT 
                bu, customer, loa_name, loa_id, cost_revenue,
                ROUND(${asblSumLogic}, 2) AS asbl, 
                ROUND(MAX(asbl_loa), 2) AS asbl_loa,
                ROUND(SUM(ptd), 2) AS ptd,
                -- 🔥 FIXED: Both aliases for Parent row sum
                ROUND(SUM(open_commitment_KEUR), 2) AS open_commitment_KEUR, 
                ROUND(SUM(open_commitment_KEUR), 2) AS open_commitment, 
                ROUND(SUM(non_committed_editable), 2) AS non_committed_editable,
                ROUND(SUM(non_committed_editable), 2) AS non_committed,
                ROUND(SUM(ptd) + SUM(open_commitment_KEUR) + SUM(non_committed_editable), 2) as eac
            FROM final_dashboard_table
            ${whereClause}
            GROUP BY bu, customer, loa_name, loa_id, cost_revenue
            ORDER BY loa_name ASC
        `;

        const [dataRows] = await db.query(`${sql} LIMIT ?, ?`, [...baseParams, ...filterParams, startIdx, limitIdx]);
        const [countRes] = await db.query(`SELECT COUNT(*) as total FROM (${sql}) temp`, [...baseParams, ...filterParams]);

        res.status(200).json({ draw: parseInt(draw) || 0, recordsFiltered: countRes[0].total, data: dataRows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// ===========================================
// Helper: Dynamic Drilldown Filters Builder (Physical Table Compatible)
// ===========================================
const buildDrilldownConditions = (filters, tableName) => {
    let conds = [];
    let params = [];

    if (!filters) return { sql: '', params: [] };

    const getArray = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        return val.split(',').map(v => v.trim()).filter(v => v && v !== 'All');
    };

    // 1. WBS Type Filter
    const wbsTypes = getArray(filters.wbs_type);
    if (wbsTypes.length > 0) {
        conds.push(`wbs_type IN (${wbsTypes.map(() => '?').join(',')})`);
        params.push(...wbsTypes);
    }

    // 2. 🔥 FIXED: UI "wbs" filter maps to "sap_wbs" in Physical Tables
    const wbsElements = getArray(filters.wbs);
    if (wbsElements.length > 0) {
        conds.push(`sap_wbs IN (${wbsElements.map(() => '?').join(',')})`);
        params.push(...wbsElements);
    }

    // 3. Period Filter
    const periods = getArray(filters.period);
    if (periods.length > 0) {
        if (tableName === 't_cj74_transformed') {
            conds.push(`period IN (${periods.map(() => '?').join(',')})`);
            params.push(...periods);
        } else {
            // 🔥 CJI5 table mein period column nahi h toh concat use karenge
            conds.push(`CONCAT(year, '-P', LPAD(per, 2, '0')) IN (${periods.map(() => '?').join(',')})`);
            params.push(...periods);
        }
    }

    return { 
        sql: conds.length > 0 ? ' AND ' + conds.join(' AND ') : '', 
        params 
    };
};

// ===========================================
// Get Drilldown Data (Fast Physical Table Query)
// ===========================================
exports.getDrillDownData = async (req, res) => {
    try {
        const { field, row, filters } = req.body;
        const loaId = row?.loa_id;
        const category = row?.categories;

        if (!loaId || !category) {
            return res.status(400).json({ error: "Missing LOA ID or Category" });
        }

        // 🔥 Mapping to your PHYSICAL Tables
        const tableName = (field === 'ptd') ? 't_cj74_transformed' : 't_cji5_transformed';
        
        // LoA ID aur Category selection
        let sql = `SELECT * FROM ${tableName} WHERE loa_id = ? AND categories = ?`;
        let params = [loaId, category];

        // Dynamic Filters logic
        const dynamicFilters = buildDrilldownConditions(filters, tableName);
        sql += dynamicFilters.sql;
        params.push(...dynamicFilters.params);

        // Efficiency limit
        sql += ` LIMIT 10000`; 

        const [rows] = await db.query(sql, params);
        res.status(200).json(rows); 
    } catch (error) {
        console.error("Drilldown Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// ===========================================
// Export Drilldown Data to Excel
// ===========================================
exports.exportDrillDown = async (req, res) => {
    try {
        const { field, loa_id, categories, filters } = req.query;

        if (!loa_id || !categories) return res.status(400).send("Missing required parameters");

        // Decode URL JSON filter object
        let parsedFilters = {};
        try { parsedFilters = JSON.parse(filters || '{}'); } catch(e) {}

        const tableName = field === 'ptd' ? 't_cj74_transformed' : 't_cji5_transformed';
        
        let sql = `SELECT * FROM ${tableName} WHERE loa_id = ? AND categories = ?`;
        let params = [loa_id, categories];

        const dynamicFilters = buildDrilldownConditions(parsedFilters, tableName);
        sql += dynamicFilters.sql;
        params.push(...dynamicFilters.params);

        // sql += ` ORDER BY year DESC, CAST(per AS UNSIGNED) DESC`;
        sql += ` ORDER BY year DESC, per DESC`;

        const [rows] = await db.query(sql, params);

        const fileName = field === 'ptd' ? `PTD_${loa_id}_${categories}.xlsx` : `OC_${loa_id}_${categories}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/\s+/g, '_')}"`);

        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const worksheet = workbook.addWorksheet('Details');

        if (rows.length > 0) {
            worksheet.columns = Object.keys(rows[0]).map(key => ({ 
                header: key.replace(/_/g, ' ').toUpperCase(), 
                key: key,
                width: 20
            }));
            rows.forEach(row => worksheet.addRow(row).commit());
        }

        await workbook.commit();
    } catch (error) { 
        console.error("Export Error:", error);
        res.status(500).send("Export failed"); 
    }
};


exports.updateNonCommitted = async (req, res) => {
    const { updates, createdBy } = req.body;

    try {
        // Month-Year format for logging (e.g., Jul-2026)
        const monthYear = new Date().toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric'
        }).replace(' ', '-');

        let totalUpdated = 0;

        for (let item of updates) {
            const { loa_name, categories, value, wbs_type } = item;

            // 1. Logging ke liye purani details fetch karein (Sync with WBS Type)
            const [existing] = await db.query(
                `SELECT non_committed_editable, customer, bu, loa_id, active_inactive 
                 FROM summary 
                 WHERE TRIM(loa_name) = TRIM(?) AND TRIM(categories) = TRIM(?) AND TRIM(wbs_type) = TRIM(?)`,
                [loa_name, categories, wbs_type]
            );

            // Agar row nahi mili toh skip karein (Data Integrity Check)
            if (!existing || existing.length === 0) {
                console.warn(`Row not found for: ${loa_name} | ${categories} | ${wbs_type}`);
                continue;
            }

            const oldValue = existing[0].non_committed_editable || 0;
            const { customer, bu, loa_id, active_inactive } = existing[0];

            // 2. Update Summary Table (Permanent Storage for Edits)
            await db.query(
                `UPDATE summary 
                 SET non_committed_editable = ?, updated_by = ? 
                 WHERE TRIM(loa_name) = TRIM(?) AND TRIM(categories) = TRIM(?) AND TRIM(wbs_type) = TRIM(?)`,
                [value, createdBy, loa_name, categories, wbs_type]
            );

            // 3. Update Dashboard Table (Real-time UI Visibility)
            const [dashRes] = await db.query(
                `UPDATE final_dashboard_table 
                 SET non_committed_editable = ?, updated_by = ? 
                 WHERE TRIM(loa_name) = TRIM(?) AND TRIM(categories) = TRIM(?) AND TRIM(wbs_type) = TRIM(?)`,
                [value, createdBy, loa_name, categories, wbs_type]
            );

            if (dashRes.affectedRows > 0) {
                totalUpdated++;
            }

            // 4. Insert into Activity Logs (Audit Trail)
            await db.query(
                `INSERT INTO user_activity_logs 
                (user_email, bu, customer, loa_name, loa_id, categories, old_value, new_value, active_inactive, month_year, wbs_type) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [createdBy, bu, customer, loa_name, loa_id, categories, oldValue, value, active_inactive, monthYear, wbs_type]
            );
        }

        // 5. 🔥 EAC aur Variance Recalculate karein
        // Ye bohot zaruri hai taaki child rows mein EAC automatic update ho jaye bina page refresh kiye
        await db.query(`
            UPDATE final_dashboard_table 
            SET eac = (ptd + open_commitment_KEUR + non_committed_editable),
                eac_vs_asbl = (asbl - (ptd + open_commitment_KEUR + non_committed_editable))
            WHERE ABS(non_committed - non_committed_editable) > 0.01 OR non_committed_editable <> 0
        `);

        res.status(200).json({ 
            message: `Successfully saved changes for ${totalUpdated} categories!`,
            updatedCount: totalUpdated 
        });

    } catch (error) {
        console.error("updateNonCommitted Error:", error);
        res.status(500).json({ error: "Server Error: " + error.message });
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

exports.exportToExcel = async (req, res) => {
    try {
        const { showAll, collapseView, type, allowedCustomers } = req.query;

        // 1. Normalize Filters (Using helper to handle Multi-select)
        const wTArr = getValArray(req.query.wbs_type);
        const wEArr = getValArray(req.query.wbs);
        const wDArr = getValArray(req.query.wbs_description);

        // 2. Base Conditions
        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue <> 'NTC'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyCategoryTypeFilter(req.query.category_type, conditions);

        // 3. Whitelist Filters (WHERE clause build-up)
        let filterParams = [];
        const dbFilters = ['bu', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period', 'wbs_type', 'wbs_description'];
        
        dbFilters.forEach(key => {
            const vals = getValArray(req.query[key]);
            if (vals) {
                conditions.push(`\`${key}\` IN (?)`);
                filterParams.push(vals);
            }
        });

        // WBS Single Element Filter
        if (wEArr) {
            conditions.push(`wbs_element_single IN (?)`);
            filterParams.push(wEArr);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // 4. Build Export Query (Detailed or Collapse)
        let exportQuery = '';
        if (collapseView === 'true') {
            exportQuery = `
                SELECT 
                    bu, customer, loa_name, loa_id, cost_revenue,
                    ${wTArr ? 'ROUND(SUM(type_asbl), 2)' : 'NULL'} AS asbl, 
                    ROUND(MAX(asbl_loa), 2) AS asbl_loa,
                    ROUND(SUM(total_ptd), 2) AS ptd,
                    ROUND(SUM(total_oc), 2) AS open_commitment,
                    MAX(total_nc) AS non_committed,
                    ROUND(SUM(total_ptd) + SUM(total_oc) + MAX(total_nc), 2) AS eac,
                    ${wTArr ? 'ROUND(SUM(type_asbl) - (SUM(total_ptd) + SUM(total_oc) + MAX(total_nc)), 2)' : 'NULL'} AS eac_vs_asbl
                FROM (
                    SELECT 
                        bu, customer, loa_name, loa_id, cost_revenue, categories, wbs_type,
                        MAX(asbl) as type_asbl,
                        SUM(ptd) as total_ptd,
                        SUM(open_commitment_KEUR) as total_oc,
                        MAX(non_committed_editable) as total_nc,
                        MAX(asbl_loa) as asbl_loa
                    FROM final_dashboard_table
                    ${whereClause}
                    GROUP BY bu, customer, loa_name, loa_id, cost_revenue, categories, wbs_type
                ) as t
                GROUP BY bu, customer, loa_name, loa_id, cost_revenue
                ORDER BY loa_name ASC
            `;
        } else {
            exportQuery = `
                SELECT 
                    bu, customer, loa_name, loa_id, cost_revenue, categories,
                    ${wTArr ? 'ROUND(SUM(type_asbl), 2)' : 'NULL'} AS asbl, 
                    MAX(asbl_loa) AS asbl_loa,
                    ROUND(SUM(total_ptd), 2) AS ptd,
                    ROUND(SUM(total_oc), 2) AS open_commitment,
                    MAX(total_nc) AS non_committed,
                    ROUND(SUM(total_ptd) + SUM(total_oc) + MAX(total_nc), 2) AS eac,
                    ${wTArr ? 'ROUND(SUM(type_asbl) - (SUM(total_ptd) + SUM(total_oc) + MAX(total_nc)), 2)' : 'NULL'} AS eac_vs_asbl
                FROM (
                    SELECT 
                        bu, customer, loa_name, loa_id, cost_revenue, categories, wbs_type,
                        MAX(asbl) as type_asbl,
                        SUM(ptd) as total_ptd,
                        SUM(open_commitment_KEUR) as total_oc,
                        MAX(non_committed_editable) as total_nc,
                        MAX(asbl_loa) as asbl_loa
                    FROM final_dashboard_table
                    ${whereClause}
                    GROUP BY bu, customer, loa_name, loa_id, cost_revenue, categories, wbs_type
                ) as t
                GROUP BY bu, customer, loa_name, loa_id, cost_revenue, categories
                HAVING 1=1
                ${showAll === 'false' ? 'AND (ABS(COALESCE(asbl, 0)) > 0.01 OR ABS(ptd) > 0.01 OR ABS(open_commitment) > 0.01)' : ''}
                ORDER BY loa_name ASC, categories ASC
            `;
        }

        // 5. Excel Generation
        const [rows] = await db.query(exportQuery, [...filterParams, ...baseParams]);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Summary_Export_${new Date().getTime()}.xlsx`);
        
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const worksheet = workbook.addWorksheet('Matrix Data');
        
        // Define Columns
        const cols = [
            { header: 'BU', key: 'bu', width: 12 },
            { header: 'Customer', key: 'customer', width: 25 },
            { header: 'LOA Name', key: 'loa_name', width: 40 },
            { header: 'LOA ID', key: 'loa_id', width: 15 },
            { header: 'Cost/Revenue', key: 'cost_revenue', width: 15 }
        ];
        if (collapseView !== 'true') cols.push({ header: 'Category', key: 'categories', width: 25 });
        cols.push(
            { header: 'ASBL', key: 'asbl', width: 15 },
            { header: 'ASBL LOA', key: 'asbl_loa', width: 15 },
            { header: 'PTD', key: 'ptd', width: 15 },
            { header: 'Open Commitment', key: 'open_commitment', width: 15 },
            { header: 'Non Committed', key: 'non_committed', width: 15 },
            { header: 'EAC', key: 'eac', width: 15 },
            { header: 'EAC vs ASBL', key: 'eac_vs_asbl', width: 15 }
        );
        worksheet.columns = cols;

        // Add Data Rows
        rows.forEach(row => {
            const cleanRow = { ...row };
            // Format numbers, handle NULL/Dash logic
            ['asbl', 'asbl_loa', 'ptd', 'open_commitment', 'non_committed', 'eac', 'eac_vs_asbl'].forEach(k => {
                if (cleanRow[k] === null || cleanRow[k] === undefined) {
                    cleanRow[k] = (k === 'asbl' || k === 'eac_vs_asbl') ? '-' : 0;
                } else {
                    cleanRow[k] = Number(cleanRow[k]);
                }
            });
            worksheet.addRow(cleanRow).commit();
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

// exports.fullRefresh = async (req, res) => {
//     try {
//         console.log("🚀 Starting Absolute Data Sync (Direct Table Logic)...");

//         // 1. Session Setup
//         await db.query("SET NAMES utf8mb4");
//         await db.query("SET collation_connection = 'utf8mb4_general_ci'");
//         await db.query(`SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))`);

//         // --- STEP 1: Refresh PTD Staging (Actuals) ---
//         console.log("Step 1: Aggregating CJ74 (Actuals)...");
//         await db.query(`DROP TABLE IF EXISTS stg_cj74_agg`);
//         await db.query(`
//             CREATE TABLE stg_cj74_agg AS
//             SELECT 
//                 TRIM(REPLACE(REPLACE(REPLACE(c.object_1,' ',''),'\\n',''),'\\r','')) as clean_wbs,
//                 TRIM(cm.categories) as cat_name,
//                 TRIM(CONCAT(c.year,'-P',LPAD(CAST(c.per AS UNSIGNED),3,'0'))) as per_name,
//                 SUM(c.val_in_rc / 1000) as ptd_sum
//             FROM cj74_new c
//             INNER JOIN cost_mapping cm ON TRIM(c.cost_element) = TRIM(cm.cost_element)
//             GROUP BY 1, 2, 3
//         `);
//         await db.query("ALTER TABLE stg_cj74_agg ADD INDEX (clean_wbs, cat_name)");

//         // --- STEP 2: Refresh OC Staging (Commitments) ---
//         console.log("Step 2: Aggregating CJI5 (Commitments)...");
//         await db.query(`DROP TABLE IF EXISTS stg_cji5_agg`);
//         await db.query(`
//             CREATE TABLE stg_cji5_agg AS
//             SELECT 
//                 TRIM(REPLACE(REPLACE(REPLACE(c.wbs_element,' ',''),'\\n',''),'\\r','')) as clean_wbs,
//                 TRIM(cm.categories) as cat_name,
//                 SUM(c.val_in_rep_cur / 1000) as oc_sum
//             FROM cji5_new c
//             INNER JOIN cost_mapping cm ON TRIM(c.cost_element) = TRIM(cm.cost_element)
//             GROUP BY 1, 2
//         `);
//         await db.query("ALTER TABLE stg_cji5_agg ADD INDEX (clean_wbs, cat_name)");

//         // --- STEP 3: Final One-Shot Insert ---
//         console.log("Step 3: Executing Master Merge...");
//         await db.query("TRUNCATE TABLE final_dashboard_table");

//         const finalSql = `
//             INSERT INTO final_dashboard_table 
//             (id, bu, customer, loa_id, loa_name, cost_revenue, categories, merged_wbs, active_inactive, 
//              asbl, asbl_amc, asbl_project, asbl_warranty, asbl_loa, 
//              non_committed, non_committed_amc, non_committed_project, non_committed_warranty,
//              non_committed_editable, non_committed_editable_amc, non_committed_editable_project, non_committed_editable_warranty,
//              period, ptd, wbs_element_single, wbs_type, wbs_description, 
//              open_commitment_KEUR, eac, eac_vs_asbl, Merged_wbs_categories, updated_by, updated_at)
            
//             SELECT 
//                 CAST(COALESCE(s.id, CONCAT('NEW-', m.Merged_wbs_categories_key)) AS CHAR(700)),
//                 COALESCE(s.bu, m.bu), COALESCE(s.customer, m.customer), COALESCE(s.loa_id, m.loa_id), COALESCE(s.loa_name, m.loa_name),
//                 IFNULL(s.cost_revenue, m.mapped_cost_revenue) as cost_revenue,
//                 m.categories, 
//                 COALESCE(s.merged_wbs, m.merged_wbs), 
//                 IFNULL(s.active_inactive, 'Active'),
                
//                 -- Summary logic (Rank logic ensures values don't multiply in parent sum)
//                 IF(m.rank_per = 1, IFNULL(s.asbl,0), 0), IF(m.rank_per = 1, IFNULL(s.asbl_amc,0), 0), IF(m.rank_per = 1, IFNULL(s.asbl_project,0), 0), IF(m.rank_per = 1, IFNULL(s.asbl_warranty,0), 0), IF(m.rank_per = 1, IFNULL(s.asbl_loa,0), 0),
//                 IF(m.rank_per = 1, IFNULL(s.non_committed,0), 0), IF(m.rank_per = 1, IFNULL(s.non_committed_amc,0), 0), IF(m.rank_per = 1, IFNULL(s.non_committed_project,0), 0), IF(m.rank_per = 1, IFNULL(s.non_committed_warranty,0), 0),
//                 IF(m.rank_per = 1, IFNULL(s.non_committed_editable,0), 0), IF(m.rank_per = 1, IFNULL(s.non_committed_editable_amc,0), 0), IF(m.rank_per = 1, IFNULL(s.non_committed_editable_project,0), 0), IF(m.rank_per = 1, IFNULL(s.non_committed_editable_warranty,0), 0),
                
//                 IFNULL(cj.per_name, 'No Actuals'),
//                 IFNULL(cj.ptd_sum, 0),
//                 m.single_wbs, m.wbs_type, m.wbs_description,
                
//                 -- Open Commitment: Rank ensures OC only shows in latest period of each category
//                 IF(m.rank_per = 1, IFNULL(ci.oc_sum, 0), 0) as open_commitment_KEUR,
                
//                 -- Dynamic EAC and Var
//                 (IFNULL(cj.ptd_sum, 0) + IF(m.rank_per = 1, IFNULL(ci.oc_sum, 0), 0) + IF(m.rank_per = 1, IFNULL(s.non_committed_editable, 0), 0)) as eac,
//                 (IF(m.rank_per = 1, IFNULL(s.asbl, 0), 0) - (IFNULL(cj.ptd_sum, 0) + IF(m.rank_per = 1, IFNULL(ci.oc_sum, 0), 0) + IF(m.rank_per = 1, IFNULL(s.non_committed_editable, 0), 0))) as var,
                
//                 m.Merged_wbs_categories_key, 'System', NOW()

//             FROM (
//                 -- Subquery ensures we have every possible bucket for every WBS
//                 SELECT 
//                     m.single_wbs, m.bu, m.customer, m.loa_id, m.loa_name, m.merged_wbs, m.wbs_type, m.wbs_description,
//                     cm.categories, cm.cost_revenue as mapped_cost_revenue,
//                     CONCAT(TRIM(m.merged_wbs), '-', TRIM(cm.categories)) as Merged_wbs_categories_key,
//                     ROW_NUMBER() OVER (PARTITION BY m.loa_id, cm.categories ORDER BY m.single_wbs) as rank_per
//                 FROM wbs_loa_id_mapping1 m
//                 CROSS JOIN (SELECT DISTINCT categories, cost_revenue FROM cost_mapping) cm
//             ) as m
//             LEFT JOIN stg_cj74_agg cj ON m.single_wbs = cj.clean_wbs AND m.categories = cj.cat_name
//             LEFT JOIN stg_cji5_agg ci ON m.single_wbs = ci.clean_wbs AND m.categories = ci.cat_name
//             LEFT JOIN summary s ON m.Merged_wbs_categories_key = s.Merged_wbs_category
//             -- Important Filter: Only show rows where any value actually exists
//             WHERE cj.ptd_sum > 0 OR ci.oc_sum > 0 OR s.asbl > 0
//         `;

//         await db.query(finalSql);

//         console.log("✅ Absolute Sync Success!");
//         res.status(200).json({ message: "Database Sync Complete! Accurate PTD & OC results." });

//     } catch (error) {
//         console.error("Full Refresh Error:", error);
//         res.status(500).json({ error: error.message });
//     }
// };

exports.fullRefresh = async (req, res) => {
    try {
        console.log("🚀 Starting Sync (PTD & OC Corrected - Final Version)...");

        // 1. Session Setup
        await db.query("SET NAMES utf8mb4");
        await db.query("SET collation_connection = 'utf8mb4_general_ci'");
        await db.query(`SET SESSION sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))`);

        // Phase 1: PTD Staging (Working PTD Logic)
        await db.query(`DROP TABLE IF EXISTS stg_cj74_agg`);
        await db.query(`
            CREATE TABLE stg_cj74_agg AS
            SELECT
                TRIM(REPLACE(REPLACE(REPLACE(object_1,' ',''),'\n',''),'\r','')) COLLATE utf8mb4_general_ci as clean_wbs,
                cost_element,
                TRIM(CONCAT(year,'-P',LPAD(CAST(per AS UNSIGNED),3,'0'))) as period,
                SUM(val_in_rc / 1000) as ptd_val
            FROM cj74_new GROUP BY 1, 2, 3
        `);
        await db.query("ALTER TABLE stg_cj74_agg ADD INDEX (clean_wbs), ADD INDEX (cost_element)");

        // Phase 2: OC Staging
        await db.query(`DROP TABLE IF EXISTS stg_cji5_agg`);
        await db.query(`
            CREATE TABLE stg_cji5_agg AS
            SELECT
                TRIM(REPLACE(REPLACE(REPLACE(wbs_element,' ',''),'\n',''),'\r','')) COLLATE utf8mb4_general_ci as clean_wbs,
                TRIM(cost_element) COLLATE utf8mb4_general_ci as cost_element,
                SUM(val_in_rep_cur / 1000) as oc_val
            FROM cji5_new GROUP BY 1, 2
        `);
        await db.query("ALTER TABLE stg_cji5_agg ADD INDEX (clean_wbs), ADD INDEX (cost_element)");

        // Phase 3: Master Mapping (Hyphen separator for summary join)
        await db.query(`DROP TABLE IF EXISTS stg_master_mapping`);
        await db.query(`
            CREATE TABLE stg_master_mapping AS
            SELECT
                CAST(TRIM(m.single_wbs) AS CHAR(255)) COLLATE utf8mb4_general_ci as single_wbs,
                m.bu, m.customer, m.loa_id, m.loa_name, m.merged_wbs, m.wbs_type, m.wbs_description,
                cm.categories, cm.cost_element, cm.cost_revenue as mapped_cost_revenue,
                CAST(CONVERT(TRIM(CONCAT(IFNULL(m.merged_wbs,''), '-', IFNULL(cm.categories,''))) USING utf8mb4) AS CHAR(500)) COLLATE utf8mb4_general_ci as Merged_wbs_categories
            FROM wbs_loa_id_mapping1 m
            CROSS JOIN (SELECT DISTINCT cost_element, categories, cost_revenue FROM cost_mapping) cm
        `);
        await db.query("ALTER TABLE stg_master_mapping ADD INDEX (single_wbs), ADD INDEX (cost_element), ADD INDEX (Merged_wbs_categories(255))");

        // Phase 4: Final Table Fill (Exact Column Count & Logic)
        await db.query("TRUNCATE TABLE final_dashboard_table");

        const finalInsertSql = `
            INSERT INTO final_dashboard_table 
            (id, bu, customer, loa_id, loa_name, cost_revenue, categories, merged_wbs, active_inactive, 
             asbl, asbl_amc, asbl_project, asbl_warranty, asbl_loa, 
             non_committed, non_committed_amc, non_committed_project, non_committed_warranty,
             non_committed_editable, non_committed_editable_amc, non_committed_editable_project, non_committed_editable_warranty,
             period, ptd, wbs_element_single, wbs_type, wbs_description, 
             open_commitment_KEUR, eac, eac_vs_asbl, Merged_wbs_categories, updated_by, updated_at)
            
            SELECT 
                id, bu, customer, loa_id, loa_name, cost_revenue, categories, merged_wbs, active_inactive,
                
                -- Summary logic (Show once per project-category)
                IF(rank_project = 1, asbl, 0), IF(rank_project = 1, asbl_amc, 0), IF(rank_project = 1, asbl_project, 0), IF(rank_project = 1, asbl_warranty, 0), IF(rank_project = 1, asbl_loa, 0),
                IF(rank_project = 1, non_committed, 0), IF(rank_project = 1, non_committed_amc, 0), IF(rank_project = 1, non_committed_project, 0), IF(rank_project = 1, non_committed_warranty, 0),
                IF(rank_project = 1, non_committed_editable, 0), IF(rank_project = 1, non_committed_editable_amc, 0), IF(rank_project = 1, non_committed_editable_project, 0), IF(rank_project = 1, non_committed_editable_warranty, 0),
                
                period, ptd, wbs_element_single, wbs_type, wbs_description,
                
                -- 🔥 OC Logic (22.7 Fix): Pick once per individual WBS-CE combo
                IF(rank_oc = 1, oc_val_raw, 0),
                
                -- EAC & Var (uses non-duplicated OC)
                (ptd + IF(rank_oc = 1, oc_val_raw, 0) + IF(rank_project = 1, non_committed_editable, 0)),
                (IF(rank_project = 1, asbl, 0) - (ptd + IF(rank_oc = 1, oc_val_raw, 0) + IF(rank_project = 1, non_committed_editable, 0))),
                
                Merged_wbs_categories, updated_by, updated_at
            FROM (
                SELECT 
                    CAST(COALESCE(s.id, CONCAT('NEW-', m.Merged_wbs_categories)) AS CHAR(700)) as id,
                    COALESCE(s.bu, m.bu) as bu, COALESCE(s.customer, m.customer) as customer, 
                    COALESCE(s.loa_id, m.loa_id) as loa_id, COALESCE(s.loa_name, m.loa_name) as loa_name,
                    IFNULL(s.cost_revenue, m.mapped_cost_revenue) as cost_revenue, m.categories, 
                    COALESCE(s.merged_wbs, m.merged_wbs) as merged_wbs, IFNULL(s.active_inactive, 'Active') as active_inactive,
                    IFNULL(s.asbl, 0) as asbl, IFNULL(s.asbl_amc, 0) as asbl_amc, IFNULL(s.asbl_project, 0) as asbl_project, IFNULL(s.asbl_warranty, 0) as asbl_warranty, IFNULL(s.asbl_loa, 0) as asbl_loa,
                    IFNULL(s.non_committed, 0) as non_committed, IFNULL(s.non_committed_amc, 0) as non_committed_amc, IFNULL(s.non_committed_project, 0) as non_committed_project, IFNULL(s.non_committed_warranty, 0) as non_committed_warranty,
                    IFNULL(s.non_committed_editable, 0) as non_committed_editable, IFNULL(s.non_committed_editable_amc, 0) as non_committed_editable_amc, IFNULL(s.non_committed_editable_project, 0) as non_committed_editable_project, IFNULL(s.non_committed_editable_warranty, 0) as non_committed_editable_warranty,
                    cj.period, IFNULL(cj.ptd_val, 0) as ptd, m.single_wbs AS wbs_element_single, m.wbs_type, m.wbs_description,
                    IFNULL(ci.oc_val, 0) as oc_val_raw, m.Merged_wbs_categories, s.updated_by, s.updated_at,
                    -- Ranks
                    ROW_NUMBER() OVER (PARTITION BY m.single_wbs, m.cost_element ORDER BY cj.period DESC) as rank_oc,
                    ROW_NUMBER() OVER (PARTITION BY m.Merged_wbs_categories ORDER BY cj.period DESC) as rank_project
                FROM stg_master_mapping m
                LEFT JOIN stg_cj74_agg cj ON (m.single_wbs = cj.clean_wbs AND m.cost_element = cj.cost_element)
                LEFT JOIN stg_cji5_agg ci ON (m.single_wbs = ci.clean_wbs AND m.cost_element = ci.cost_element)
                LEFT JOIN summary s ON (m.Merged_wbs_categories = s.Merged_wbs_category)
                WHERE cj.ptd_val IS NOT NULL OR ci.oc_val IS NOT NULL OR s.asbl > 0
            ) AS final_src
        `;
        
        await db.query(finalInsertSql);
        res.status(200).json({ message: "Sync Success! Everything is now accurate and error-free." });

    } catch (error) {
        console.error("Full Refresh Error:", error);
        res.status(500).json({ error: error.message });
    }
};


exports.getDashboardFilters = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;

        const buildConditions = (excludeKey) => {
            const { years, periods, customers, active_inactive, loa_names, bu, wbs_type, category_type } = req.query;
            let conditions = ["customer IS NOT NULL", "loa_name IS NOT NULL"];
            let params = [];

            applyRLS(type, allowedCustomers, conditions, params);

            // 🔥 CATEGORY TYPE Logic for Dropdowns
            if (!category_type) {
                conditions.push(`categories <> 'Local Materials'`);
            } else {
                let catArr = Array.isArray(category_type) ? category_type : category_type.split(',').map(v => v.trim());
                const hasAll = catArr.includes('All');
                const hasLM = catArr.includes('Local Materials');
                if (hasAll && !hasLM) conditions.push(`categories <> 'Local Materials'`);
                else if (!hasAll && hasLM) conditions.push(`categories = 'Local Materials'`);
                else if (!hasAll && !hasLM) conditions.push(`categories <> 'Local Materials'`);
            }

            // SYNC BU
            if (bu && excludeKey !== 'bus') {
                const buArray = bu.split(',').filter(Boolean);
                if (buArray.length > 0) {
                    conditions.push(`bu IN (${buArray.map(() => '?').join(',')})`);
                    params.push(...buArray);
                }
            }
            // SYNC WBS TYPE
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

        const buQ = buildConditions('bus');
        const [buRows] = await db.query(`SELECT DISTINCT bu FROM final_dashboard_table ${buQ.whereSql} ORDER BY bu ASC`, buQ.params);

        const wbsQ = buildConditions('wbs_type');
        const [wbsRows] = await db.query(`SELECT DISTINCT wbs_type FROM final_dashboard_table ${wbsQ.whereSql} AND wbs_type IS NOT NULL ORDER BY wbs_type ASC`, wbsQ.params);

        const custQ = buildConditions('customers');
        const [customerRows] = await db.query(`SELECT DISTINCT customer FROM final_dashboard_table ${custQ.whereSql} ORDER BY customer ASC`, custQ.params);

        const perQ = buildConditions('periods');
        const [periodRows] = await db.query(`SELECT DISTINCT period FROM final_dashboard_table ${perQ.whereSql} AND period IS NOT NULL ORDER BY period DESC`, perQ.params);

        const loaQ = buildConditions('loa_names');
        const [loaRows] = await db.query(`SELECT DISTINCT loa_name FROM final_dashboard_table ${loaQ.whereSql} ORDER BY loa_name ASC`, loaQ.params);

        const yearsList = [...new Set(periodRows.map(r => r.period?.split('-')[0]))].filter(Boolean).sort((a,b)=>b-a);

        res.status(200).json({
            category_types: ['All', 'Local Materials'], // 🔥 DYNAMIC FILTER BHEJ RAHE HAIN UI KE LIYE
            bus: buRows.map(r => r.bu),
            wbs_types: wbsRows.map(r => r.wbs_type), 
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

const getDashboardAnalyticsSQL = (groupByCol, showAsbl) => {
    return `
        SELECT 
            ${groupByCol},
            ${showAsbl ? 'ROUND(SUM(type_asbl), 2)' : "'0.00'"} as asbl,
            ROUND(SUM(type_ptd), 2) as ptd,
            ROUND(SUM(type_ptd + type_oc + type_nc), 2) as eac,
            ROUND(SUM(type_oc), 2) as open_commitment,
            ROUND(SUM(type_nc), 2) as non_committed,
            ROUND(${showAsbl ? 'SUM(type_asbl)' : '0.00'} - SUM(type_ptd + type_oc + type_nc), 2) as eac_vs_asbl
        FROM (
            SELECT 
                ${groupByCol}, loa_id, categories, wbs_type,
                MAX(asbl) as type_asbl,
                SUM(ptd) as type_ptd,
                MAX(total_oc_fixed) as type_oc,
                MAX(non_committed_editable) as type_nc
            FROM final_dashboard_table
            {{WHERE_CLAUSE}}
            GROUP BY ${groupByCol}, loa_id, categories, wbs_type
        ) as t
        WHERE (? = 'All' OR ? = '' OR wbs_type = ?)
        GROUP BY ${groupByCol}
        ORDER BY ${groupByCol} ASC
    `;
};

// 1. Business Unit Analytics
exports.getBuAnalytics = async (req, res) => {
    try {
        const { type, allowedCustomers } = req.query;
        let wT = req.query.wbs_type || 'All';
        const showAsbl = wT !== 'All' && wT.toLowerCase() !== 'warranty/other';

        let conditions = ["categories NOT IN ('Not to considered')", "cost_revenue = 'Cost'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, conditions, baseParams);
        applyDashboardFilters(req.query, conditions, baseParams);
        
        const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = getDashboardAnalyticsSQL('bu', showAsbl).replace('{{WHERE_CLAUSE}}', whereSql);

        // Params: Order is baseParams (for inner) then wT (for outer WHERE)
        const [rows] = await db.query(sql, [...baseParams, wT, wT, wT]);
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 2. LOA Name Analytics
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
        const rawSql = getDashboardAnalyticsSQL('loa_name', showAsbl).replace('{{WHERE_CLAUSE}}', whereSql);
        
        // Wrapping to apply final sorting and limit
        const sql = `SELECT * FROM (${rawSql}) final_t ORDER BY asbl DESC ${limitSql}`;

        const [rows] = await db.query(sql, [...baseParams, wT, wT, wT]);
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

const getDashboardTableSQL = (groupByCols, showAsbl) => {
    return `
        SELECT ${groupByCols},
               ${showAsbl ? 'ROUND(SUM(type_asbl), 2)' : "'0.00'"} as asbl,
               ROUND(SUM(type_asbl_loa), 2) as asbl_loa,
               ROUND(SUM(type_ptd), 2) as ptd,
               ROUND(SUM(type_oc), 2) as open_commitment,
               ROUND(SUM(type_nc), 2) as non_committed,
               ROUND(SUM(type_ptd + type_oc + type_nc), 2) as eac,
               ROUND(${showAsbl ? 'SUM(type_asbl)' : '0.00'} - SUM(type_ptd + type_oc + type_nc), 2) as eac_vs_asbl
        FROM (
            SELECT ${groupByCols}, loa_id, categories, wbs_type,
                   MAX(asbl) as type_asbl, MAX(asbl_loa) as type_asbl_loa,
                   SUM(ptd) as type_ptd, MAX(total_oc_fixed) as type_oc, MAX(non_committed_editable) as type_nc
            FROM final_dashboard_table
            {{WHERE_CLAUSE}}
            GROUP BY ${groupByCols}, loa_id, categories, wbs_type
        ) t 
        WHERE (? = 'All' OR ? = '' OR wbs_type = ?)
        GROUP BY ${groupByCols}
    `;
};

// 1. BU ONLY VIEW
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
        const sql = getDashboardTableSQL('bu', showAsbl).replace('{{WHERE_CLAUSE}}', whereSql) + " ORDER BY bu ASC";

        const [rows] = await db.query(sql, [...baseParams, wT, wT, wT]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

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
        const sql = getDashboardTableSQL('bu, customer, loa_id, loa_name', showAsbl).replace('{{WHERE_CLAUSE}}', whereSql) + " HAVING eac_vs_asbl < 0 ORDER BY eac_vs_asbl ASC";

        const [rows] = await db.query(sql, [...baseParams, wT, wT, wT]);
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
        const sql = getDashboardTableSQL('bu, customer, loa_id, loa_name', showAsbl).replace('{{WHERE_CLAUSE}}', whereSql) + " ORDER BY asbl DESC";

        const [rows] = await db.query(sql, [...baseParams, wT, wT, wT]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

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
        const sql = getDashboardTableSQL('customer', showAsbl).replace('{{WHERE_CLAUSE}}', whereSql) + " ORDER BY asbl DESC";

        const [rows] = await db.query(sql, [...baseParams, wT, wT, wT]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

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
                   ${showAsbl ? 'ROUND(SUM(type_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(type_asbl_loa), 2) as asbl_loa,
                   ROUND(SUM(type_ptd), 2) as ptd,
                   ROUND(SUM(type_oc), 2) as open_commitment,
                   ROUND(SUM(type_nc), 2) as non_committed,
                   ROUND(SUM(type_ptd + type_oc + type_nc), 2) as eac,
                   ROUND(${showAsbl ? 'SUM(type_asbl)' : '0.00'} - SUM(type_ptd + type_oc + type_nc), 2) as eac_vs_asbl
            FROM (
                SELECT bu, customer, loa_id, categories, wbs_type,
                       MAX(asbl) as type_asbl, MAX(asbl_loa) as type_asbl_loa,
                       SUM(ptd) as type_ptd, MAX(total_oc_fixed) as type_oc, MAX(non_committed_editable) as type_nc
                FROM final_dashboard_table ${whereSql}
                GROUP BY bu, customer, loa_id, categories, wbs_type
            ) t 
            WHERE (? = 'All' OR ? = '' OR wbs_type = ?)
            GROUP BY bu, customer 
            ORDER BY bu ASC, asbl DESC`;

        const [rows] = await db.query(sql, [...baseParams, wT, wT, wT]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

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
        const sql = getDashboardTableSQL('customer, bu', showAsbl).replace('{{WHERE_CLAUSE}}', whereSql) + " ORDER BY customer ASC";

        const [rows] = await db.query(sql, [...baseParams, wT, wT, wT]);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

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
        
        // 🔥 Nested Query handles MAX(asbl) correctly and WHERE filters at outer level
        const sql = `
            SELECT customer, bu, loa_id, loa_name,
                   ${showAsbl ? 'ROUND(SUM(type_asbl), 2)' : "'0.00'"} as asbl,
                   ROUND(SUM(type_asbl_loa), 2) as asbl_loa,
                   ROUND(SUM(type_ptd), 2) as ptd,
                   ROUND(SUM(type_oc), 2) as open_commitment,
                   ROUND(SUM(type_nc), 2) as non_committed,
                   ROUND(SUM(type_ptd + type_oc + type_nc), 2) as eac,
                   ROUND(${showAsbl ? 'SUM(type_asbl)' : '0.00'} - SUM(type_ptd + type_oc + type_nc), 2) as eac_vs_asbl
            FROM (
                SELECT customer, bu, loa_id, loa_name, categories, wbs_type,
                       MAX(asbl) as type_asbl, MAX(asbl_loa) as type_asbl_loa,
                       SUM(ptd) as type_ptd, MAX(total_oc_fixed) as type_oc, MAX(non_committed_editable) as type_nc
                FROM final_dashboard_table ${whereSql}
                GROUP BY customer, bu, loa_id, loa_name, categories, wbs_type
            ) t 
            WHERE (? = 'All' OR ? = '' OR wbs_type = ?)
            GROUP BY customer, bu, loa_id, loa_name 
            ORDER BY customer ASC`;

        // 🔥 IMPORTANT: baseParams go first, then 3 placeholders for wT
        const [rows] = await db.query(sql, [...baseParams, wT, wT, wT]);
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
        // 1. Update original non_committed in Summary
        await db.query(`
            UPDATE summary 
            SET non_committed = non_committed_editable 
            WHERE ABS(non_committed - non_committed_editable) > 0.01
        `);

        // 2. Update original non_committed in Dashboard Table
        await db.query(`
            UPDATE final_dashboard_table 
            SET non_committed = non_committed_editable 
            WHERE ABS(non_committed - non_committed_editable) > 0.01
        `);

        // 3. Recalculate EAC and Variance globally
        await db.query(`
            UPDATE final_dashboard_table 
            SET eac = (ptd + open_commitment_KEUR + non_committed),
                eac_vs_asbl = (asbl - (ptd + open_commitment_KEUR + non_committed))
        `);

        res.status(200).json({ message: "All changes finalized successfully!" });
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
