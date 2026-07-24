const db = require('../config/db');
const XLSX = require('xlsx');
const fs = require('fs');

const CATEGORY_MAP = [
    { cat: "Local Materials", type: "Cost" }, { cat: "Transportation & Logistic cost", type: "Cost" },
    { cat: "Travel+Training", type: "Cost" }, { cat: "SBU-Design+Dep.+Mig", type: "Cost" },
    { cat: "CE Resources", type: "Cost" }, { cat: "Revenue", type: "Revenue" },
    { cat: "I&C Services", type: "Cost" }, { cat: "DD Resources", type: "Cost" },
    { cat: "Welcome Center Costs", type: "Cost" }, { cat: "Local TAC Support + L3 Support", type: "Cost" },
    { cat: "Repair cost", type: "Cost" }, { cat: "Cost Reclass", type: "Cost" },
    { cat: "Project Management", type: "Cost" }, { cat: "Software Upgrade + NSP Upgrade", type: "Cost" },
    { cat: "3rd Party Cost", type: "Cost" }, { cat: "Not to considered", type: "NTC" },
    { cat: "Additional HW", type: "Cost" }, { cat: "Risk and Contingencies", type: "Cost" },
    { cat: "Quality Audit + FMA", type: "Cost" }, { cat: "Additional Services", type: "Cost" },
    { cat: "Others-Not found in Cost Mapping", type: "Cost" }, 
    { cat: "I&C Services + DD Resources", type: "Cost" }, 
    { cat: "Cross ERP Cost", type: "Cost" }, 
    { cat: "Total", type: "Cost" } 
];

/**
 * 🔥 Optimized Sync: No TRIM() in SQL. 
 * Assumes data in DB is already clean.
 */
const syncProjectWbs = async (arg1, arg2, arg3) => {
    let conn, loa_id, loa_name;

    // Flexible Argument Handling
    if (typeof arg1 === 'string') {
        // Agar pehla argument string hai, matlab connection skip kiya gaya hai
        conn = db; // Default promise pool use karega
        loa_id = arg1;
        loa_name = arg2;
    } else {
        // Agar pehla argument object hai, matlab connection pass kiya gaya hai
        conn = arg1;
        loa_id = arg2;
        loa_name = arg3;
    }

    // Ab 'conn' hamesha valid query object hoga
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
 * 🔥 Core Engine: Trims data at entry point
 */
const processProjectData = async (dataGrid, created_by, mode) => {
    if (!dataGrid || dataGrid.length < 2) throw new Error("No data found or headers missing!");
    
    // Clean headers once
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

    // CLEANING PHASE: Trim everything before processing logic
    for (let cols of dataLines) {
        if (cols.every(c => !c || String(c).trim() === '')) continue;
        
        // Trim inputs immediately
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
    try {
        await connection.beginTransaction();
        let processedLoas = new Set();
        let warningMessage = "";

        for (const loa_id of Object.keys(projectGroups)) {
            const { bu, customer, loa_name, wbs_rows } = projectGroups[loa_id];

            // Direct comparison (Index optimized)
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
                
                // ✅ Pass connection here to keep it in the same transaction
                await syncProjectWbs(connection, loa_id, loa_name); 
            }
            processedLoas.add(loa_id);
        }
        }

        // 🔥 Optimized Dashboard Refresh
        const loaList = Array.from(processedLoas);
        if (loaList.length > 0) {
            await connection.query("DELETE FROM final_dashboard_table WHERE loa_id IN (?)", [loaList]);
            await connection.query(`
                INSERT INTO final_dashboard_table 
                SELECT * FROM final_dashboard WHERE loa_id IN (?)
            `, [loaList]);
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
 * 🔥 Optimized Fix/Cleanup
 */
exports.fixMissingSummaryRows = async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        
        // Timeout ko session level par badhao
        await connection.query("SET SESSION innodb_lock_wait_timeout = 300");

        // 1. Unique Projects ki list lein
        const [projects] = await connection.query(
            "SELECT DISTINCT loa_id, loa_name, ANY_VALUE(bu) as bu, ANY_VALUE(customer) as customer FROM wbs_loa_id_mapping1 GROUP BY loa_id"
        );

        console.log(`🚀 Processing ${projects.length} projects...`);

        for (const p of projects) {
            // BINA transaction ke kaam karenge (Autocommit mode)
            
            // Step A: Missing categories insert karein
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

            // Step B: WBS Sync karein
            // Note: syncProjectWbs ke andar bhi ensure karein ki koi transactional lock na ho
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

exports.fixMissingSummaryRows = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        console.log("🚀 Starting Pro-Level Data Cleanup...");

        // 1. GET ALL UNIQUE PROJECTS
        const [projects] = await connection.query(
            "SELECT DISTINCT TRIM(loa_id) as loa_id, TRIM(loa_name) as loa_name, bu, customer FROM wbs_loa_id_mapping1"
        );

        for (const p of projects) {
            // 2. CLEAN SUMMARY TABLE (Delete duplicates for this project)
            // Hum categories ke basis pe duplicates delete karenge aur latest (max id) ko rakhenge
            await connection.query(`
                DELETE s1 FROM summary s1
                INNER JOIN summary s2 
                WHERE s1.id < s2.id 
                AND s1.loa_id = s2.loa_id 
                AND s1.loa_name = s2.loa_name 
                AND s1.categories = s2.categories 
                AND s1.loa_id = ?`, [p.loa_id]);

            // 3. ENSURE EXACT 24 ROWS
            // Jo categories miss ho gayi hain unhe insert karenge
            for (const catItem of CATEGORY_MAP) {
                const [exists] = await connection.query(
                    "SELECT id FROM summary WHERE loa_id = ? AND categories = ?", 
                    [p.loa_id, catItem.cat]
                );
                if (exists.length === 0) {
                    await connection.query(
                        "INSERT INTO summary (bu, customer, loa_id, loa_name, cost_revenue, categories) VALUES (?,?,?,?,?,?)",
                        [p.bu, p.customer, p.loa_id, p.loa_name, catItem.type, catItem.cat]
                    );
                }
            }

            // 4. SYNC WBS MAPPING
            // Mapping table se saare WBS uthakar summary aur mapping ke merged_wbs column ko update karega
            await syncProjectWbs(p.loa_id, p.loa_name);
        }

        await connection.commit();
        res.status(200).json({ message: "Database Cleaned & Synced Successfully!" });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
};