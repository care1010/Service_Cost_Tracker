const db = require('../config/db');
const ExcelJS = require('exceljs');


exports.getWbsSummary = async (req, res) => {
    try {
        const { draw, start, length, search, showAll } = req.query; // 🔥 showAll parameter liya
        const startIdx = parseInt(start) || 0;
        const limitIdx = parseInt(length) || 10;

        // 1. Base Conditions (Hamesha filter honge)
        let conditions = [
            "categories NOT IN ('Local Materials', 'Not to considered')",
            "cost_revenue <> 'NTC'"
        ];

        // 2. 🔥 ZERO ROWS FILTER (Sirf tab lagao jab showAll 'true' NA HO)
        if (showAll !== 'true') {
            conditions.push("(ABS(asbl) > 0.01 OR ABS(ptd) > 0.01 OR ABS(total_oc_fixed) > 0.01 OR ABS(non_committed) > 0.01)");
        }

        let params = [];
        const allowedFilters = ['wbs', 'customer', 'loa_id', 'loa_name', 'active_inactive', 'period'];
        
        allowedFilters.forEach(key => {
            let value = req.query[key];
            if (Array.isArray(value)) value = value[0];
            if (value && value !== 'All' && value !== '') {
                conditions.push(`${key} = ?`);
                params.push(value);
            }
        });

        const whereClause = " WHERE " + conditions.join(" AND ");

        // 3. KPI Query (Same as before)
        const kpiQuery = `
            SELECT 
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN unique_asbl ELSE 0 END) as asbl_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN unique_asbl ELSE 0 END) as asbl_cost,
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN total_ptd ELSE 0 END) as ptd_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN total_ptd ELSE 0 END) as ptd_cost,
                SUM(CASE WHEN cost_revenue = 'Revenue' THEN (total_ptd + unique_oc + unique_nc) ELSE 0 END) as eac_rev,
                SUM(CASE WHEN cost_revenue = 'Cost' THEN (total_ptd + unique_oc + unique_nc) ELSE 0 END) as eac_cost
            FROM (
                SELECT cost_revenue, MAX(asbl) as unique_asbl, SUM(ptd) as total_ptd, MAX(total_oc_fixed) as unique_oc, MAX(non_committed) as unique_nc
                FROM final_dashboard_table ${whereClause}
                GROUP BY loa_name, categories, cost_revenue
            ) as grouped_metrics
        `;
        const [kpiRes] = await db.query(kpiQuery, params);
        
        // 4. Matrix Query
        const matrixQuery = `
            SELECT 
                bu, customer, loa_id, loa_name, cost_revenue, categories,
                MAX(asbl) as asbl, 
                MAX(asbl_loa) as asbl_loa, 
                SUM(ptd) as ptd, 
                MAX(total_oc_fixed) as open_commitment, 
                
                -- 🔥 YAHAN DHAYAN DEIN:
                MAX(non_committed) as non_committed_original, -- Purani value
                MAX(non_committed_editable) as non_committed, -- Nayi edited value (UI pe ye dikhegi)
                
                -- EAC calculation ab edited value use karegi
                (SUM(ptd) + MAX(total_oc_fixed) + MAX(non_committed_editable)) as eac,
                (MAX(asbl) - (SUM(ptd) + MAX(total_oc_fixed) + MAX(non_committed_editable))) as eac_vs_asbl
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
            kpis: {
                asbl_sm: kpiRes[0].asbl_rev === 0 ? "0.00" : (((Math.abs(kpiRes[0].asbl_rev) - Math.abs(kpiRes[0].asbl_cost)) / Math.abs(kpiRes[0].asbl_rev)) * 100).toFixed(2),
                ptd_sm: kpiRes[0].ptd_rev === 0 ? "0.00" : (((Math.abs(kpiRes[0].ptd_rev) - Math.abs(kpiRes[0].ptd_cost)) / Math.abs(kpiRes[0].ptd_rev)) * 100).toFixed(2),
                eac_sm: kpiRes[0].eac_rev === 0 ? "0.00" : (((Math.abs(kpiRes[0].eac_rev) - Math.abs(kpiRes[0].eac_cost)) / Math.abs(kpiRes[0].eac_rev)) * 100).toFixed(2)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 🔥 Naya Update Function (Dono tables ke liye)
exports.updateNonCommitted = async (req, res) => {
    const { updates } = req.body;
    try {
        for (let item of updates) {
            // 🔥 Sirf editable column ko update karein
            await db.query("UPDATE summary SET non_committed_editable = ? WHERE loa_name = ? AND categories = ?", [item.value, item.loa_name, item.categories]);
            await db.query("UPDATE final_dashboard_table SET non_committed_editable = ? WHERE loa_name = ? AND categories = ?", [item.value, item.loa_name, item.categories]);
        }
        res.status(200).json({ message: "Adjustment Saved!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};


// --- 2. getFilterOptions mein loa_name ki list add karein ---
exports.getFilterOptions = async (req, res) => {
    try {
        const queries = [
            db.query(`SELECT DISTINCT wbs FROM final_dashboard_table WHERE wbs IS NOT NULL ORDER BY wbs`),
            db.query(`SELECT DISTINCT customer FROM final_dashboard_table WHERE customer IS NOT NULL ORDER BY customer`),
            db.query(`SELECT DISTINCT loa_id FROM final_dashboard_table WHERE loa_id IS NOT NULL ORDER BY loa_id`),
            db.query(`SELECT DISTINCT loa_name FROM final_dashboard_table WHERE loa_name IS NOT NULL ORDER BY loa_name`),
            db.query(`SELECT DISTINCT active_inactive FROM final_dashboard_table WHERE active_inactive IS NOT NULL ORDER BY active_inactive`),
            db.query(`SELECT DISTINCT period FROM final_dashboard_table WHERE period IS NOT NULL ORDER BY period DESC`)
        ];
        
        const [wbs, cust, lid, lname, act, per] = await Promise.all(queries);

        res.status(200).json({
            wbs: wbs[0].map(r => r.wbs),
            customer: cust[0].map(r => r.customer),
            loa_id: lid[0].map(r => r.loa_id),
            loa_name: lname[0].map(r => r.loa_name), // Yeh missing tha
            active_inactive: act[0].map(r => r.active_inactive),
            period: per[0].map(r => r.period)
        });
    } catch (error) { res.status(500).json({ error: error.message }); }
};


// 2. 🔥 Naya Update Function (Dono tables ke liye)
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
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Dashboard_Export.xlsx');
        
        const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });
        const worksheet = workbook.addWorksheet('Data');
        
        worksheet.columns = [
            { header: 'BU', key: 'bu', width: 10 },
            { header: 'Customer', key: 'customer', width: 25 },
            { header: 'LOA ID', key: 'loa_id', width: 20 },
            { header: 'LOA Name', key: 'loa_name', width: 35 },
            { header: 'Cost/Revenue', key: 'cost_revenue', width: 15 },
            { header: 'Category', key: 'categories', width: 25 },
            { header: 'ASBL', key: 'asbl', width: 15 },
            { header: 'PTD', key: 'ptd', width: 15 },
            { header: 'Open Com', key: 'total_oc_fixed', width: 15 },
            { header: 'Non Committed', key: 'non_committed', width: 15 },
            { header: 'EAC', key: 'eac', width: 15 },
            { header: 'EAC VS ASBL', key: 'eac_vs_asbl', width: 15 }
        ];

        const [rows] = await db.query(`SELECT * FROM final_dashboard_table`);

        rows.forEach(row => {
            const excelRow = worksheet.addRow(row);
            // Agar editable original se alag hai toh Excel cell blue kar do
            if (parseFloat(row.non_committed_editable) !== parseFloat(row.non_committed)) {
                excelRow.getCell('non_committed').fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'D9EAD3' } // Light Blue
                };
            }
            excelRow.commit();
        });

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
        const [viewCheck] = await db.query("SELECT COUNT(*) as count FROM v_summary_final");
        
        if (viewCheck[0].count > 0) {
            // Agar View mein data hai, tabhi purani table saaf karke naya data bharein
            await db.query("TRUNCATE TABLE final_dashboard_table");
            await db.query("INSERT INTO final_dashboard_table SELECT * FROM v_summary_final");
            
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
            throw new Error("View 'v_summary_final' is empty. Refresh aborted to save existing data.");
        }

    } catch (error) {
        console.error("DETAILED ERROR:", error); // Yeh terminal mein asli wajah batayega
        res.status(500).json({ error: error.message });
    }
};

exports.fullRefresh = async (req, res) => {
    try {
        await db.query("TRUNCATE TABLE final_dashboard_table");
        await db.query("INSERT INTO final_dashboard_table SELECT * FROM final_dashboard");
        // Update total_oc_fixed for Matrix view
        await db.query(`
            UPDATE final_dashboard_table t
            JOIN (SELECT loa_name, categories, SUM(open_commitment_KEUR) as total_sum FROM final_dashboard_table GROUP BY loa_name, categories) as src 
            ON t.loa_name = src.loa_name AND t.categories = src.categories
            SET t.total_oc_fixed = src.total_sum
        `);
        res.status(200).json({ message: "Full Dashboard Refresh Complete!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 1. BU Wise Aggregation
exports.getBuAnalytics = async (req, res) => {
    try {
        const sql = `
            SELECT bu, 
                   SUM(asbl) as asbl, 
                   SUM(ptd) as ptd, 
                   SUM(eac) as eac 
            FROM final_dashboard_table 
            WHERE categories NOT IN ('Local Materials', 'Not to considered')
            GROUP BY bu`;
        const [rows] = await db.query(sql);
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 2. LOA Name Wise Aggregation (Top 10 Projects for better visibility)
exports.getLoaAnalytics = async (req, res) => {
    try {
        const sql = `
            SELECT loa_name, 
                   SUM(asbl) as asbl, 
                   SUM(ptd) as ptd, 
                   SUM(eac) as eac 
            FROM final_dashboard_table 
            WHERE categories NOT IN ('Local Materials', 'Not to considered')
            GROUP BY loa_name 
            ORDER BY asbl DESC 
            LIMIT 10`; // Sirf Top 10 dikhayenge taaki graph messy na ho
        const [rows] = await db.query(sql);
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};