const db = require('../config/db');

// Helper to handle RLS on summary table
const applyRLSLocal = (userType, allowedCustomers, conditions, params) => {
    if (userType === 'super_admin') return;
    
    if (allowedCustomers) {
        const customersArray = allowedCustomers.split(',').map(c => c.trim()).filter(Boolean);
        if (customersArray.length > 0) {
            conditions.push(`customer IN (?)`);
            params.push(customersArray);
        } else {
            conditions.push("1=0"); // Block if no customers assigned
        }
    } else {
        conditions.push("1=0");
    }
};

// 🔥 1. getFilteredProjects (Fix for empty dropdowns)
exports.getFilteredProjects = async (req, res) => {
    try {
        const { wbs_type, type, allowedCustomers } = req.query;

        console.log("===== getFilteredProjects =====");
        console.log("wbs_type:", wbs_type);
        console.log("type:", type);
        console.log("allowedCustomers:", allowedCustomers);

        let conditions = ["wbs_type = ?"];
        let params = [wbs_type];

        applyRLSLocal(type, allowedCustomers, conditions, params);

        const sql = `
            SELECT DISTINCT loa_id, loa_name, customer
            FROM summary
            WHERE ${conditions.join(" AND ")}
            ORDER BY loa_name
        `;

        console.log("SQL:", sql);
        console.log("Params:", params);

        const [rows] = await db.query(sql, params);

        console.log("Rows:", rows.length);

        res.json(rows);

    } catch(err){
        console.log(err);
    }
}

// 🔥 2. getProjectDetails (Fix for data fetch)
exports.getProjectDetails = async (req, res) => {
    try {
        const { loa_name, wbs_type, type, allowedCustomers } = req.query;
        if (!loa_name || !wbs_type) return res.json([]);

        let conditions = ["TRIM(loa_name) = TRIM(?)", "wbs_type = ?"];
        let params = [loa_name, wbs_type];

        applyRLSLocal(type, allowedCustomers, conditions, params);

        const sql = `
            SELECT loa_id, loa_name, cost_revenue, categories, asbl, wbs_type 
            FROM summary 
            WHERE ${conditions.join(' AND ')} 
            ORDER BY categories ASC`;

        const [rows] = await db.query(sql, params);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ... updateManualAsbl, processAsblUpdate, getProjectWbsOptions logic remains same as provided before ...

// 4. Excel Paste Update
exports.processAsblUpdate = async (req, res) => {
    const { rawText, wbs_type } = req.body; 
    try {
        const lines = req.body.rawText.trim().split(/\r?\n/).filter(l => l !== '');
        const headers = lines[0].split('\t').map(h => h.trim());
        const dataLines = lines.slice(1);
        const catIdx = headers.indexOf('Cost Element Mapping'), asblIdx = headers.indexOf('ASBL'), loaIdIdx = headers.indexOf('LOA ID');
        let pastedDataMap = {}; 
        for (let line of dataLines) {
            const cols = line.split('\t');
            const lId = cols[loaIdIdx]?.trim();
            if (!lId) continue;
            if (!pastedDataMap[lId]) pastedDataMap[lId] = {};
            pastedDataMap[lId][cleanString(cols[catIdx])] = parseFloat(cols[asblIdx]?.replace(/[^0-9.-]/g, '')) || 0;
        }
        for (const loa_id of Object.keys(pastedDataMap)) {
            const updates = pastedDataMap[loa_id];
            const [dbRows] = await db.query("SELECT id, categories FROM summary WHERE TRIM(loa_id) = ? AND wbs_type = ?", [loa_id, wbs_type]);
            for (let row of dbRows) {
                const targetAsbl = updates[cleanString(row.categories)];
                if (targetAsbl !== undefined) {
                    await db.query("UPDATE summary SET asbl = ? WHERE id = ?", [targetAsbl, row.id]);
                    await db.query("UPDATE final_dashboard_table SET asbl = ? WHERE TRIM(loa_id) = ? AND TRIM(categories) = ? AND wbs_type = ?", [targetAsbl, loa_id, row.categories, wbs_type]);
                }
            }
            await syncDashboardRow(loa_id, wbs_type);
        }
        res.status(200).json({ message: "Updated successfully!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 5. Manual UI Edit Update
exports.updateManualAsbl = async (req, res) => {
    const { loa_name, wbs_type, updates } = req.body;
    try {
        const promises = updates.map(item => {
            const val = parseFloat(item.asbl) || 0;
            db.query(`UPDATE summary SET asbl = ? WHERE TRIM(loa_name) = TRIM(?) AND TRIM(categories) = TRIM(?) AND wbs_type = ?`, [val, loa_name, item.categories, wbs_type]);
            return db.query(`UPDATE final_dashboard_table SET asbl = ? WHERE TRIM(loa_name) = TRIM(?) AND TRIM(categories) = TRIM(?) AND wbs_type = ?`, [val, loa_name, item.categories, wbs_type]);
        });
        await Promise.all(promises);
        await db.query(`UPDATE final_dashboard_table SET eac_vs_asbl = (asbl - (ptd + open_commitment_KEUR + non_committed)) WHERE TRIM(loa_name) = TRIM(?) AND wbs_type = ?`, [loa_name, wbs_type]);
        res.status(200).json({ message: "Saved!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 6. Project WBS Options
exports.getProjectWbsOptions = async (req, res) => {
    try {
        const [proj] = await db.query("SELECT loa_id FROM summary WHERE TRIM(loa_name) = TRIM(?) LIMIT 1", [req.query.loa_name]);
        if (proj.length === 0) return res.json([]);
        const [wbs] = await db.query("SELECT DISTINCT wbs_type, wbs_element FROM wbs_loa_id_mapping1 WHERE loa_id = ?", [proj[0].loa_id]);
        res.json(wbs);
    } catch (error) { res.status(500).json({ error: error.message }); }
};