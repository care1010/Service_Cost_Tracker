const db = require('../config/db');

const cleanString = (str) => {
    if (!str) return "";
    return str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const syncDashboardRow = async (loaId) => {
    await db.query(`
        UPDATE final_dashboard_table 
        SET eac = (ptd + open_commitment_KEUR + non_committed),
            eac_vs_asbl = (asbl - (ptd + open_commitment_KEUR + non_committed))
        WHERE TRIM(loa_id) = ?
    `, [loaId]);
};

// 1. Excel Paste Update
exports.processAsblUpdate = async (req, res) => {
    const { rawText } = req.body;
    try {
        const lines = rawText.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
        const headers = lines[0].split('\t').map(h => h.trim());
        const dataLines = lines.slice(1);

        const catIdx = headers.indexOf('Cost Element Mapping');
        const asblIdx = headers.indexOf('ASBL');
        const loaIdIdx = headers.indexOf('LOA ID');

        let currentLoaId = "";
        let pastedDataMap = {}; 

        for (let line of dataLines) {
            const cols = line.split('\t');
            if (cols[loaIdIdx] && cols[loaIdIdx].trim() !== "") currentLoaId = cols[loaIdIdx].trim();
            if (!currentLoaId) continue;
            if (!pastedDataMap[currentLoaId]) pastedDataMap[currentLoaId] = {};
            const cleanCat = cleanString(cols[catIdx]);
            const asblVal = parseFloat((cols[asblIdx] || "0.00").replace(/[^0-9.-]/g, '')) || 0;
            pastedDataMap[currentLoaId][cleanCat] = asblVal;
        }

        let processedLoas = new Set();
        let skipCount = 0;

        for (const loa_id of Object.keys(pastedDataMap)) {
            const [exSummary] = await db.query("SELECT wbs FROM summary WHERE TRIM(loa_id) = ? LIMIT 1", [loa_id]);
            if (exSummary.length === 0) continue;

            const updates = pastedDataMap[loa_id];
            const [dbRows] = await db.query("SELECT id, categories, asbl FROM summary WHERE TRIM(loa_id) = ?", [loa_id]);

            let updatePromises = [];
            for (let row of dbRows) {
                const dbCleanCat = cleanString(row.categories);
                const targetAsbl = updates[dbCleanCat] !== undefined ? updates[dbCleanCat] : null;

                if (targetAsbl !== null && Math.abs(row.asbl - targetAsbl) > 0.001) {
                    updatePromises.push(db.query("UPDATE summary SET asbl = ? WHERE id = ?", [targetAsbl, row.id]));
                    updatePromises.push(db.query(
                        "UPDATE final_dashboard_table SET asbl = ? WHERE TRIM(loa_id) = ? AND TRIM(categories) = ?", 
                        [targetAsbl, loa_id, row.categories]
                    ));
                    processedLoas.add(loa_id);
                }
            }

            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                await syncDashboardRow(loa_id);
            } else {
                skipCount += dbRows.length;
            }
        }

        if (processedLoas.size === 0 && skipCount > 0) {
            return res.status(400).json({ error: "Duplicate Data! No changes detected." });
        }

        res.status(200).json({ message: `Success! Updated in ${processedLoas.size} projects.` });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 2. Manual UI Edit Update
exports.updateManualAsbl = async (req, res) => {
    const { loa_name, updates } = req.body;
    try {
        const promises = updates.map(item => {
            const asblValue = parseFloat(item.asbl) || 0;

            // Update Summary Table
            db.query(
                `UPDATE summary SET asbl = ? WHERE TRIM(loa_name) = TRIM(?) AND TRIM(categories) = TRIM(?)`,
                [asblValue, loa_name, item.categories]
            );

            // Update Dashboard Table
            return db.query(
                `UPDATE final_dashboard_table SET asbl = ? WHERE TRIM(loa_name) = TRIM(?) AND TRIM(categories) = TRIM(?)`,
                [asblValue, loa_name, item.categories]
            );
        });

        await Promise.all(promises);

        // Recalculate EAC
        await db.query(`
            UPDATE final_dashboard_table
            SET 
                eac = (ptd + open_commitment_KEUR + non_committed),
                eac_vs_asbl = (asbl - (ptd + open_commitment_KEUR + non_committed))
            WHERE TRIM(loa_name) = TRIM(?)
        `, [loa_name]);

        res.status(200).json({ message: "Manual changes saved instantly!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 3. Get Project Details
exports.getProjectDetails = async (req, res) => {
    try {
        const { loa_name } = req.query;
        const [rows] = await db.query(`
            SELECT loa_id, loa_name, cost_revenue, categories, MAX(asbl) as asbl
            FROM final_dashboard_table
            WHERE TRIM(loa_name) = TRIM(?)
            AND categories NOT IN ('Not to considered')
            AND cost_revenue <> 'NTC'
            GROUP BY loa_id, loa_name, cost_revenue, categories
            ORDER BY categories ASC
        `, [loa_name]);
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 🔥 4. NEW: Get dynamic WBS Types and Elements for selected project
exports.getProjectWbsOptions = async (req, res) => {
    try {
        const { loa_name } = req.query;
        const [proj] = await db.query("SELECT DISTINCT loa_id FROM final_dashboard_table WHERE TRIM(loa_name) = TRIM(?) LIMIT 1", [loa_name]);
        if (proj.length === 0) return res.status(200).json([]);

        const loa_id = proj[0].loa_id;
        const [wbsRows] = await db.query(
            "SELECT DISTINCT wbs_type, wbs_element FROM wbs_loa_id_mapping1 WHERE TRIM(loa_id) = TRIM(?)",
            [loa_id]
        );
        res.status(200).json(wbsRows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};