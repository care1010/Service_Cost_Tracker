const db = require('../config/db');
const XLSX = require('xlsx');
const fs = require('fs');

// 🔥 EXCLUDE LIST FOR CJ74 (Donkey-Proofing)
const EXCLUDED_WBS_TYPES_FOR_CJ74 = ['Warranty', 'Warranty/Other'];


/**
 * Helper: Sync WBS mappings
 */
const syncProjectWbs = async (arg1, arg2, arg3) => {
    let conn, loa_id, loa_name;

    if (typeof arg1 === 'string') {
        conn = db;
        loa_id = arg1;
        loa_name = arg2;
    } else {
        conn = arg1;
        loa_id = arg2;
        loa_name = arg3;
    }

    const [rows] = await conn.query(
        "SELECT DISTINCT single_wbs as wbs FROM wbs_loa_id_mapping1 WHERE loa_id = ? AND loa_name = ?",
        [loa_id, loa_name]
    );
    
    const uniqueWbs = rows.map(r => r.wbs).filter(Boolean);
    const mergedWbsStr = uniqueWbs.join(',');

    await conn.query(
        "UPDATE wbs_loa_id_mapping1 SET merged_wbs = ? WHERE loa_id = ? AND loa_name = ?",
        [mergedWbsStr, loa_id, loa_name]
    );

    await conn.query(`
        UPDATE summary 
        SET merged_wbs = ?,
            Merged_wbs_category = CONCAT(?, '-', categories)
        WHERE loa_id = ? AND loa_name = ?
    `, [mergedWbsStr, mergedWbsStr, loa_id, loa_name]);

    return mergedWbsStr;
};


/**
 * Helper: Naye WBS ke liye cj74_new me dummy rows dalne ka function
 */
const insertCj74DummyData = async (connection, newWbsList, costElements) => {
    if (newWbsList.length === 0 || costElements.length === 0) return;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear(); 
    const currentMonth = (currentDate.getMonth() + 1).toString(); 

    let cj74BatchRows = [];

    for (const wbsObj of newWbsList) {
        const type = (wbsObj.wbs_type || "").trim();
        
        // Naye projects par rule apply hoga (Exclude list check karega)
        const isExcluded = EXCLUDED_WBS_TYPES_FOR_CJ74.some(
            exType => exType.toLowerCase() === type.toLowerCase()
        );

        if (!isExcluded) {
            for (const ce of costElements) {
                // 🔥 NAYA: Aakhiri value 0 add ki hai (NULL ki jagah)
                cj74BatchRows.push([
                    currentYear, 
                    currentMonth, 
                    ce, 
                    wbsObj.wbs_element, 
                    wbsObj.wbs_element,
                    0 // <-- Explicit 0 for val_in_rc
                ]);
            }
        }
    }

    if (cj74BatchRows.length > 0) {
        // 🔥 NAYA: Query mein `val_in_rc` column ka naam bhi add kar diya hai
        await connection.query(
            `INSERT INTO cj74_new (year, per, cost_element, object_1, object_2, val_in_rc) VALUES ?`,
            [cj74BatchRows]
        );
        console.log(`✅ Added ${cj74BatchRows.length} dummy rows with 0 value to cj74_new for ${newWbsList.length} WBS.`);
    }
};


/**
 * 🔥 Core Engine: Processes Project Data with Deadlock-Proof Logic
 */
const processProjectData = async (dataGrid, created_by, mode) => {
    if (!dataGrid || dataGrid.length < 2) throw new Error("No data found or headers missing!");
    
    const headers = dataGrid[0].map(h => String(h || "").trim().toUpperCase());
    const idxBu = headers.findIndex(h => h === 'BUSINESS DIVISION (BD)' || h === 'BU');
    const idxCustomer = headers.findIndex(h => h === 'CT NAME (REPORTED CUST)' || h === 'CUSTOMER');
    const idxLoaId = headers.findIndex(h => h === 'OPPORTUNITY CODE' || h === 'LOA_ID');
    const idxLoaName = headers.findIndex(h => h === 'PROJECT DESCRIPTION' || h === 'LOA_NAME');
    const idxWbsType = headers.findIndex(h => h === 'WBS TYPE');
    const idxWbsElement = headers.findIndex(h => h === 'WBS');
    const idxWbsDesc = headers.findIndex(h => h === 'WBS DESCRIPTION');

    const dataLines = dataGrid.slice(1);
    const projectGroups = {};
    let c_bu = "", c_cust = "", c_lid = "", c_lname = "";

    for (let cols of dataLines) {
        if (cols.every(c => !c || String(c).trim() === '')) continue;
        
        const r_bu = cols[idxBu]?.toString().trim() || "";
        const r_cust = cols[idxCustomer]?.toString().trim() || "";
        const r_lid = cols[idxLoaId]?.toString().trim() || "";
        const r_ln = cols[idxLoaName]?.toString().trim() || "";
        
        if (r_bu) c_bu = r_bu; 
        if (r_cust) c_cust = r_cust; 
        if (r_lid) c_lid = r_lid; 
        if (r_ln) c_lname = r_ln;
        
        const loa_id = r_lid || c_lid;
        if (!loa_id) continue;

        if (!projectGroups[loa_id]) {
            projectGroups[loa_id] = { bu: c_bu, customer: c_cust, loa_id, loa_name: c_lname, wbs_rows: [] };
        }
        
        if (cols[idxWbsElement]) {
            projectGroups[loa_id].wbs_rows.push({
                wbs_type: cols[idxWbsType]?.toString().trim() || "",
                wbs_element: cols[idxWbsElement]?.toString().trim() || "",
                wbs_description: cols[idxWbsDesc]?.toString().trim() || ""
            });
        }
    }

    const connection = await db.getConnection();
    let isCommitted = false; // 🔥 Safety flag to track if data is saved

    try {
        await connection.beginTransaction();
        
        const [catRows] = await connection.query("SELECT categories as cat, cost_revenue_type as type FROM master_categories");
        const CATEGORY_MAP = catRows; 

        const [costElementsRows] = await connection.query("SELECT cost_element FROM master_cost_element");
        const costElements = costElementsRows.map(row => row.cost_element);
        
        let processedLoas = new Set();
        let warningMessage = "";

        // MAIN LOOP
        for (const loa_id of Object.keys(projectGroups)) {
            const { bu, customer, loa_name, wbs_rows } = projectGroups[loa_id];

            const [exSummary] = await connection.query(
                "SELECT id FROM summary WHERE loa_id = ? AND loa_name = ? LIMIT 1", 
                [loa_id, loa_name]
            );

            if (mode === 'new') {
                if (exSummary.length > 0) {
                    throw new Error(`LoA ID [${loa_id}] already exists. Use 'Add WBS' mode.`);
                }

                const finalMergedWbs = [...new Set(wbs_rows.map(r => r.wbs_element))].join(',');

                let summaryRows = CATEGORY_MAP.map(item => [
                    bu, customer, loa_id, loa_name, item.type, item.cat, finalMergedWbs, `${finalMergedWbs}-${item.cat}`, 'Active'
                ]);
                await connection.query(`INSERT INTO summary (bu, customer, loa_id, loa_name, cost_revenue, categories, merged_wbs, Merged_wbs_category, active_inactive) VALUES ?`, [summaryRows]);

                const mapRows = wbs_rows.map(r => [bu, customer, loa_id, loa_name, r.wbs_type, r.wbs_element, r.wbs_description, finalMergedWbs, created_by]);
                await connection.query(`INSERT INTO wbs_loa_id_mapping1 (bu, customer, loa_id, loa_name, wbs_type, single_wbs, wbs_description, merged_wbs, created_by) VALUES ?`, [mapRows]);
                
                await insertCj74DummyData(connection, wbs_rows, costElements);

                processedLoas.add(loa_id);

            } else if (mode === 'existing') {
                const [exMappings] = await connection.query(
                    "SELECT single_wbs as wbs, wbs_type as type FROM wbs_loa_id_mapping1 WHERE loa_id = ? AND loa_name = ?", 
                    [loa_id, loa_name]
                );

                const existingKeys = new Set(exMappings.map(m => `${m.wbs}|${m.type}`.toUpperCase()));
                const newWbsToMap = wbs_rows.filter(row => !existingKeys.has(`${row.wbs_element}|${row.wbs_type}`.toUpperCase()));

                if (newWbsToMap.length > 0) {
                    const mapRows = newWbsToMap.map(r => [bu, customer, loa_id, loa_name, r.wbs_type, r.wbs_element, r.wbs_description, "", created_by]);
                    await connection.query(`INSERT INTO wbs_loa_id_mapping1 (bu, customer, loa_id, loa_name, wbs_type, single_wbs, wbs_description, merged_wbs, created_by) VALUES ?`, [mapRows]);
                    
                    await syncProjectWbs(connection, loa_id, loa_name); 

                    await insertCj74DummyData(connection, newWbsToMap, costElements);
                }
                processedLoas.add(loa_id);
            }
        }

        // 🟢 FIX 1: PEHLE DATA SAVE (COMMIT) KARENGE
        await connection.commit();
        isCommitted = true;
        console.log("✅ Primary Database Tables Updated and Committed Successfully!");

        // 🟢 FIX 2: AB AARAM SE DASHBOARD VIEW REFRESH KARENGE
        // .... WBS processing loop ends here ....
        
        // 🔥 FAST DASHBOARD REFRESH LOGIC
        const loaList = Array.from(processedLoas);
        if (loaList.length > 0) {
            console.log("🔄 Refreshing Dashboard Table for LOAs:", loaList);
            await connection.query("DELETE FROM final_dashboard_table WHERE loa_id IN (?)", [loaList]);

            // Hum heavy View ki jagah sidha base tables se fast insert karenge
            await connection.query(`
                INSERT INTO final_dashboard_table (
                    bu, customer, loa_id, loa_name, cost_revenue, categories, active_inactive,
                    wbs_element_single, wbs_type, wbs_description, merged_wbs, Merged_wbs_categories
                )
                SELECT 
                    s.bu, s.customer, s.loa_id, s.loa_name, s.cost_revenue, s.categories, s.active_inactive,
                    m.single_wbs, m.wbs_type, m.wbs_description, m.merged_wbs,
                    CONCAT(m.merged_wbs, '-', s.categories)
                FROM summary s
                LEFT JOIN wbs_loa_id_mapping1 m ON s.loa_id = m.loa_id
                WHERE s.loa_id IN (?)
            `, [loaList]);
            
            console.log("✅ Dashboard Refreshed at Lightning Speed!");
        }

        await connection.commit();
        return { message: `${warningMessage}Successfully Processed ${processedLoas.size} Project(s).` };

    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Fix Missing Summary Rows (Cleanup/Utility)
 */
exports.fixMissingSummaryRows = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.query("SET SESSION innodb_lock_wait_timeout = 300");

        // 🔥 Yahan bhi Hardcoded array ko hatakar DB se fetch kar liya
        const [catRows] = await connection.query("SELECT categories as cat, cost_revenue_type as type FROM master_categories");
        const CATEGORY_MAP = catRows;

        const [projects] = await connection.query(
            "SELECT DISTINCT loa_id, loa_name, ANY_VALUE(bu) as bu, ANY_VALUE(customer) as customer FROM wbs_loa_id_mapping1 GROUP BY loa_id"
        );

        console.log(`🚀 Processing ${projects.length} projects...`);

        for (const p of projects) {
            for (const catItem of CATEGORY_MAP) {
                const [exists] = await connection.query(
                    "SELECT id FROM summary WHERE loa_id = ? AND categories = ? LIMIT 1", 
                    [p.loa_id, catItem.cat]
                );
                
                if (exists.length === 0) {
                    await connection.query(
                        "INSERT INTO summary (bu, customer, loa_id, loa_name, cost_revenue, categories, active_inactive) VALUES (?,?,?,?,?,?,?)",
                        [p.bu, p.customer, p.loa_id, p.loa_name, catItem.type, catItem.cat, 'Active']
                    );
                }
            }
            await syncProjectWbs(connection, p.loa_id, p.loa_name);
            console.log(`✅ ${p.loa_id} sync completed.`);
        }

        res.status(200).json({ message: "Database Synced Successfully!" });

    } catch (error) {
        console.error("Cleanup Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        if (connection) connection.release();
    }
};

// ==========================================
// EXPORTED API HANDLERS
// ==========================================

exports.processProjectPaste = async (req, res) => {
    try {
        const { rawText, mode } = req.body;
        if (!rawText) return res.status(400).json({ error: "No data pasted" });
        const dataGrid = rawText.trim().split(/\r?\n/).map(l => l.split('\t'));
        const result = await processProjectData(dataGrid, req.user?.email || 'System', mode || 'new');
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.uploadProjectFile = async (req, res) => {
    try {
        const { mode } = req.body;
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const wb = XLSX.readFile(req.file.path);
        const dataGrid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        const result = await processProjectData(dataGrid, req.user?.email || 'System', mode || 'new');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(200).json(result);
    } catch (error) { 
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message }); 
    }
};