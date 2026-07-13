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

exports.getFilterOptions = async (req, res) => {
    try {
        const { type, allowedCustomers, bu, wbs, customer, loa_id, loa_name, active_inactive, period, wbs_type, wbs_description } = req.query;

        let baseConditions = ["categories NOT IN ('Not to considered')", "cost_revenue <> 'NTC'"];
        let baseParams = [];
        applyRLS(type, allowedCustomers, baseConditions, baseParams);

        const getFilteredDistinct = async (targetColumn, currentFilters) => {
            let conditions = [...baseConditions];
            let filterValues = [...baseParams];

            // Filter Syncing Logic
            Object.keys(currentFilters).forEach(key => {
                if (key !== targetColumn && currentFilters[key] && currentFilters[key] !== 'All' && currentFilters[key] !== '') {
                    let val = Array.isArray(currentFilters[key]) ? currentFilters[key][0] : currentFilters[key];
                    
                    // WBS filter user ne select kiya hai, toh hum single column check karenge
                    if (key === 'wbs') {
                        conditions.push(`wbs_element_single = ?`);
                    } else {
                        conditions.push(`\`${key}\` = ?`);
                    }
                    filterValues.push(val);
                }
            });

            // Target column adjust karein (WBS dropdown ke liye hum single column se uthayenge)
            let finalTarget = (targetColumn === 'wbs') ? 'wbs_element_single' : targetColumn;

            const sql = `
                SELECT DISTINCT \`${finalTarget}\` as value 
                FROM final_dashboard_table 
                WHERE ${conditions.join(' AND ')} AND \`${finalTarget}\` IS NOT NULL AND \`${finalTarget}\` <> ''
                ORDER BY \`${finalTarget}\` ASC`;

            const [rows] = await db.query(sql, filterValues);
            return rows.map(r => r.value);
        };

        const currentFilters = { bu, wbs, customer, loa_id, loa_name, active_inactive, period, wbs_type, wbs_description };
        
        const [buOpts, wbsOpts, custOpts, loaIdOpts, loaNameOpts, activeOpts, periodOpts, wbsTypeOpts, wbsDescOpts] = await Promise.all([
            getFilteredDistinct('bu', currentFilters),
            getFilteredDistinct('wbs', currentFilters), // Yeh ab wbs_element_single se layega
            getFilteredDistinct('customer', currentFilters),
            getFilteredDistinct('loa_id', currentFilters),
            getFilteredDistinct('loa_name', currentFilters),
            getFilteredDistinct('active_inactive', currentFilters),
            getFilteredDistinct('period', currentFilters),
            getFilteredDistinct('wbs_type', currentFilters),
            getFilteredDistinct('wbs_description', currentFilters)
        ]);

        res.status(200).json({
            bu: buOpts,
            wbs: wbsOpts, // Ab comma-splitting ki zarurat nahi hai!
            customer: custOpts,
            loa_id: loaIdOpts,
            loa_name: loaNameOpts,
            active_inactive: activeOpts,
            period: periodOpts,
            wbs_type: wbsTypeOpts,
            wbs_description: wbsDescOpts
        });
    } catch (error) {
        console.error("Filter Options Error:", error);
        res.status(500).json({ error: error.message });
    }
};

//Main Summary Table data fetch with server side processing
exports.getWbsSummary = async (req, res) => {
    try {
        // 🔥 FIX: Destructured wbs_type explicitly from query
        const {
            draw,
            start,
            length,
            search,
            showAll,
            type,
            allowedCustomers
        } = req.query;

        const startIdx = parseInt(start) || 0;
        const limitIdx = parseInt(length) || 10;

        let wbsType = req.query.wbs_type;

        if (Array.isArray(wbsType)) {
            wbsType = wbsType[0];
        }

        const showAsbl = wbsType && wbsType !== "All";

        // console.log("[DEBUG] WBS Type:", wbsType);
        // console.log("[DEBUG] Show ASBL:", showAsbl);

        const searchValue = req.query.search?.value || '';

        // 1. Base Conditions
        let conditions = [
            "categories NOT IN ('Not to considered')",
            "cost_revenue <> 'NTC'"
        ];
        let params = [];

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

        applyRLS(type, allowedCustomers, conditions, params);

        if (showAll === 'false') {
            conditions.push("(ABS(asbl) > 0.01 OR ABS(ptd) > 0.01 OR ABS(total_oc_fixed) > 0.01 OR ABS(non_committed_editable) > 0.01)");
        }

        // Dropdown Filters
        const allowedFilters = ['bu', 'wbs', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period', 'wbs_type', 'wbs_description'];
        // getWbsSummary ke filters loop mein ye change karein:
allowedFilters.forEach(key => {
    let value = req.query[key];
    if (Array.isArray(value)) value = value[0];
    if (value && value !== 'All' && value !== '') {
        if (key === 'wbs') {
            // 🔥 Yahan single element par filter hoga
            conditions.push(`wbs_element_single = ?`);
            params.push(value);
        } else if (key === 'wbs_type' || key === 'wbs_description') {
            conditions.push(`${key} = ?`);
            params.push(value);
        } else {
            conditions.push(`${key} = ?`);
            params.push(value);
        }
    }
});

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // KPIs: Hides ASBL sums if showAsbl is false
        const kpiQuery = `
            SELECT 
                ${showAsbl ? "SUM(CASE WHEN cost_revenue = 'Revenue' THEN asbl ELSE 0 END)" : "0"} as asbl_rev,
                ${showAsbl ? "SUM(CASE WHEN cost_revenue = 'Cost' THEN asbl ELSE 0 END)" : "0"} as asbl_cost,
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN ptd ELSE 0 END) as ptd_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN ptd ELSE 0 END) as ptd_cost,
                (SUM(CASE WHEN cost_revenue = 'Revenue' THEN ptd ELSE 0 END) + MAX(CASE WHEN cost_revenue = 'Revenue' THEN total_oc_fixed END) + MAX(CASE WHEN cost_revenue = 'Revenue' THEN non_committed_editable END)) AS eac_rev,
                (SUM(CASE WHEN cost_revenue = 'Cost' THEN ptd ELSE 0 END) + MAX(CASE WHEN cost_revenue = 'Cost' THEN total_oc_fixed END) + MAX(CASE WHEN cost_revenue = 'Cost' THEN non_committed_editable END)) AS eac_cost
            FROM final_dashboard_table
            ${whereClause}
        `;
        const [kpiRes] = await db.query(kpiQuery, params);
        const k = kpiRes[0];

        const calcSm = (rev, cost) => {
            const revenue = Math.abs(Number(rev) || 0);
            const costVal = Number(cost) || 0;
            if (revenue === 0) {
                return "0.00";
            }
            return (((revenue - costVal) / revenue) * 100).toFixed(2);
        };

        const kpis = {
            asbl_sm: calcSm(k.asbl_rev, k.asbl_cost),
            ptd_sm: calcSm(k.ptd_rev, k.ptd_cost),
            eac_sm: calcSm(k.eac_rev, k.eac_cost)
        };

        // Matrix Query
        const matrixQuery = `
            SELECT 
                bu, customer, loa_id, loa_name, cost_revenue, categories,
                MAX(unique_key) as unique_key, 
                ${showAsbl ? 'COALESCE(MAX(asbl), 0)' : 'NULL'} as asbl, -- 🔥 Conditionally Hidden
                COALESCE(MAX(asbl_loa), 0) as asbl_loa, -- 🔥 ALWAYS VISIBLE
                COALESCE(SUM(ptd), 0) as ptd, 
                COALESCE(MAX(total_oc_fixed), 0) as open_commitment, 
                COALESCE(MAX(non_committed), 0) as non_committed_original,
                COALESCE(MAX(non_committed_editable), 0) as non_committed,
                (COALESCE(SUM(ptd), 0) + COALESCE(MAX(total_oc_fixed), 0) + COALESCE(MAX(non_committed_editable), 0)) as eac,
                (${showAsbl ? 'COALESCE(MAX(asbl), 0)' : '0.00'} - (COALESCE(SUM(ptd), 0) + COALESCE(MAX(total_oc_fixed), 0) + COALESCE(MAX(non_committed_editable), 0))) as eac_vs_asbl
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

        let wbsType = req.query.wbs_type;

        if (Array.isArray(wbsType)) {
            wbsType = wbsType[0];
        }

        const showAsbl = wbsType && wbsType !== "All";

        console.log("[DEBUG] WBS Type:", wbsType);
        console.log("[DEBUG] Show ASBL:", showAsbl);

        const searchValue = req.query.search?.value || '';

        let conditions = [
            "categories NOT IN ('Not to considered')",
            "cost_revenue <> 'NTC'"
        ];
        let params = [];

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
            params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        applyRLS(type, allowedCustomers, conditions, params);

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

        const allowedFilters = ['bu', 'wbs', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period', 'wbs_type', 'wbs_description'];
        allowedFilters.forEach(key => {
    let value = req.query[key];
    if (Array.isArray(value)) value = value[0];
    if (value && value !== 'All' && value !== '') {
        if (key === 'wbs') {
            conditions.push(`wbs LIKE ?`);
            params.push(`%${value}%`);
        } else if (key === 'wbs_type' || key === 'wbs_description') {
            // Mapping table ke through filter karein
            conditions.push(`loa_id IN (SELECT loa_id FROM wbs_loa_id_mapping1 WHERE \`${key}\` = ?)`);
            params.push(value);
        } else {
            conditions.push(`${key} = ?`);
            params.push(value);
        }
    }
});

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const sql = `
            SELECT
                bu,
                customer,
                loa_name,
                loa_id,
                cost_revenue,

                ${showAsbl ? 'ROUND(MAX(asbl), 2)' : 'NULL'} AS asbl, -- 🔥 Conditionally Hidden
                ROUND(MAX(asbl_loa), 2) AS asbl_loa, -- 🔥 ALWAYS VISIBLE
                ROUND(SUM(ptd), 2) AS ptd,
                ROUND(MAX(total_oc_fixed), 2) AS open_commitment,
                ROUND(MAX(non_committed_editable), 2) AS non_committed,

                ROUND(
                    SUM(ptd)
                    + MAX(total_oc_fixed)
                    + MAX(non_committed_editable),
                2) AS eac,

                ROUND(
                    ${showAsbl ? 'MAX(asbl)' : '0.00'}
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

        const [countRes] = await db.query(`SELECT COUNT(*) as total FROM (${sql}) temp`, params);
        const [rows] = await db.query(`${sql} LIMIT ?, ?`, [...params, startIdx, limitIdx]);

        console.log("Collapse Rows Count:", countRes[0].total);

        res.status(200).json({
            draw: parseInt(draw) || 0,
            recordsTotal: countRes[0].total,
            recordsFiltered: countRes[0].total,
            data: rows
        });

    } catch (error) {

    console.error("========== WBS SUMMARY ERROR ==========");
    console.error(error);
    console.error(error.stack);

    res.status(500).json({
        success: false,
        message: error.message
    });
}
};