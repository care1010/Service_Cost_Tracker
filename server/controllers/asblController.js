const db = require('../config/db');

const cleanString = (str) => {
    if (!str) return "";
    return str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const syncDashboardRow = async (loaId, wbs_type) => {
    await db.query(`
        UPDATE final_dashboard_table 
        SET eac_vs_asbl = (asbl - (ptd + open_commitment_KEUR + non_committed))
        WHERE TRIM(loa_id) = ? AND wbs_type = ?
    `, [loaId, wbs_type]);
};

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

exports.getProjectDetails = async (req, res) => {
    try {
        const { loa_name, wbs_type } = req.query;
        const [rows] = await db.query(`SELECT loa_id, loa_name, cost_revenue, categories, asbl, wbs_type FROM summary WHERE TRIM(loa_name) = TRIM(?) AND wbs_type = ? ORDER BY categories ASC`, [loa_name, wbs_type || 'Project']);
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.getProjectWbsOptions = async (req, res) => {
    try {
        const [proj] = await db.query("SELECT loa_id FROM summary WHERE TRIM(loa_name) = TRIM(?) LIMIT 1", [req.query.loa_name]);
        if (proj.length === 0) return res.json([]);
        const [wbs] = await db.query("SELECT DISTINCT wbs_type, wbs_element FROM wbs_loa_id_mapping1 WHERE loa_id = ?", [proj[0].loa_id]);
        res.json(wbs);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 🔥 Add this to asblController.js
exports.getFilteredProjects = async (req, res) => {
    try {
        const { wbs_type } = req.query;
        if (!wbs_type) return res.json([]);

        // Sirf wahi projects layenge jinme ye wbs_type exist karta hai summary table mein
        const [rows] = await db.query(
            `SELECT DISTINCT loa_id, loa_name 
             FROM summary 
             WHERE wbs_type = ? 
             ORDER BY loa_name ASC`, 
            [wbs_type]
        );
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};