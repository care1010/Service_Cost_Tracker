const db = require('../config/db');

const cleanString = (str) => {
    if (!str) return "";
    return str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

// 🔥 CENTRAL SYNC FUNCTION: Ise hum kahin bhi use kar sakte hain
const syncDashboardRow = async (loaId) => {
    // Yeh query direct table mein math calculate karegi (Instant)
    // EAC = ptd + open_commitment + non_committed
    // EAC_VS_ASBL = asbl - EAC
    await db.query(`
        UPDATE final_dashboard_table 
        SET eac = (ptd + open_commitment_KEUR + non_committed),
            eac_vs_asbl = (asbl - (ptd + open_commitment_KEUR + non_committed))
        WHERE TRIM(loa_id) = ?
    `, [loaId]);
};

// 1. Excel Paste Update (Optimized to 5 Seconds)
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
            const asblVal = parseFloat((cols[asblIdx] || "0").replace(/[^0-9.-]/g, '')) || 0;
            if (cleanCat) pastedDataMap[currentLoaId][cleanCat] = asblVal;
        }

        const loaList = Object.keys(pastedDataMap);
        if (loaList.length === 0) return res.status(400).json({ error: "No valid LOA IDs." });

        // Step 1: Fetch current data for comparison
        const [dbRows] = await db.query("SELECT id, loa_id, categories, asbl FROM summary WHERE TRIM(loa_id) IN (?)", [loaList]);

        let changedLoas = new Set();
        let updatePromises = [];

        for (let row of dbRows) {
            const dbLoaId = row.loa_id.trim();
            const dbCleanCat = cleanString(row.categories);
            const targetAsbl = pastedDataMap[dbLoaId][dbCleanCat] !== undefined ? pastedDataMap[dbLoaId][dbCleanCat] : 0;

            if (Math.abs(row.asbl - targetAsbl) > 0.001) {
                // Update Summary Table
                updatePromises.push(db.query("UPDATE summary SET asbl = ? WHERE id = ?", [targetAsbl, row.id]));
                // Update Dashboard Table Directly (No View Join!)
                updatePromises.push(db.query(
                    "UPDATE final_dashboard_table SET asbl = ? WHERE TRIM(loa_id) = ? AND TRIM(categories) = ?", 
                    [targetAsbl, dbLoaId, row.categories]
                ));
                changedLoas.add(dbLoaId);
            }
        }

        if (updatePromises.length === 0) return res.status(400).json({ error: "Duplicate Data! No changes detected." });

        await Promise.all(updatePromises);

        // Step 2: Recalculate EAC and Variance for affected LOAs (Instant)
        for (let loaId of changedLoas) {
            await syncDashboardRow(loaId);
        }

        res.status(200).json({ message: `Success! Updated in ${loaList.length} projects.` });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 2. Manual UI Edit Update (Instant)
exports.updateManualAsbl = async (req, res) => {
    const { loa_id, updates } = req.body; 
    try {
        const promises = updates.map(item => {
            // Update Summary
            db.query("UPDATE summary SET asbl = ? WHERE TRIM(loa_id) = ? AND TRIM(categories) = ?", [item.asbl, loa_id, item.categories]);
            // Update Dashboard Table Directly
            return db.query("UPDATE final_dashboard_table SET asbl = ? WHERE TRIM(loa_id) = ? AND TRIM(categories) = ?", [item.asbl, loa_id, item.categories]);
        });
        await Promise.all(promises);
        
        // Sync EAC/Variance
        await syncDashboardRow(loa_id);

        res.status(200).json({ message: "Manual changes saved instantly!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 3. Get Project Details (Same as before)
exports.getProjectDetails = async (req, res) => {
    try {
        const { loa_id } = req.query;
        const [rows] = await db.query(`
            SELECT loa_id, loa_name, cost_revenue, categories, MAX(asbl) as asbl 
            FROM final_dashboard_table WHERE TRIM(loa_id) = ? 
            GROUP BY loa_id, loa_name, cost_revenue, categories
            ORDER BY cost_revenue DESC, categories ASC
        `, [loa_id]);
        res.status(200).json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
};