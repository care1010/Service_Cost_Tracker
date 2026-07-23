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

// Helper: cleanString for Excel elements
const cleanString = (str) => {
    if (!str) return "";
    return str.toString().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

// 🔥 SELF-HEALING ENGINE (Consolidates & Syncs all WBS elements based on single summary table)
const syncProjectWbs = async (loa_id, loa_name) => {
    // 1. Get all unique single_wbs elements for this loa_id + loa_name combo
    const [rows] = await db.query(
        "SELECT DISTINCT TRIM(single_wbs) as wbs FROM wbs_loa_id_mapping1 WHERE TRIM(loa_id) = ? AND TRIM(loa_name) = ?",
        [loa_id.trim(), loa_name.trim()]
    );
    
    const uniqueWbs = rows.map(r => r.wbs).filter(Boolean);
    if (uniqueWbs.length === 0) return "";

    const mergedWbsStr = uniqueWbs.join(',');

    // 2. Update wbs_loa_id_mapping1 merged_wbs
    await db.query(
        "UPDATE wbs_loa_id_mapping1 SET merged_wbs = ? WHERE TRIM(loa_id) = ? AND TRIM(loa_name) = ?",
        [mergedWbsStr, loa_id.trim(), loa_name.trim()]
    );

    // 3. Update summary table merged_wbs & Merged_wbs_category
    await db.query(`
        UPDATE summary 
        SET merged_wbs = ?,
            Merged_wbs_category = CONCAT(?, '-', categories)
        WHERE TRIM(loa_id) = ? AND TRIM(loa_name) = ?
    `, [mergedWbsStr, mergedWbsStr, loa_id.trim(), loa_name.trim()]);

    return mergedWbsStr;
};

// 🔥 Core Processing Engine (Add Project & Add WBS Addition)
const processProjectData = async (dataGrid, created_by, mode) => {
    if (!dataGrid || dataGrid.length < 2) throw new Error("No data found or headers missing!");
    
    // Header Mapping
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
    let c_bu = "", c_cust = "", c_lid = "", c_lname = "", c_wt = "";

    // Parse Excel/Pasted Grid rows
    for (let cols of dataLines) {
        if (cols.every(c => !c || String(c).trim() === '')) continue;
        const r_bu = cols[idxBu]?.trim(), r_cust = cols[idxCustomer]?.trim(), r_lid = cols[idxLoaId]?.trim(), r_ln = cols[idxLoaName]?.trim(), r_wt = cols[idxWbsType]?.trim(), r_we = cols[idxWbsElement]?.trim(), r_wd = cols[idxWbsDesc]?.trim();
        if (r_bu) c_bu = r_bu; if (r_cust) c_cust = r_cust; if (r_lid) c_lid = r_lid; if (r_ln) c_lname = r_ln; if (r_wt) c_wt = r_wt;
        const loa_id = r_lid || c_lid;
        if (!loa_id) continue;
        if (!projectGroups[loa_id]) projectGroups[loa_id] = { bu: r_bu || c_bu, customer: r_cust || c_cust, loa_id, loa_name: r_ln || c_lname, wbs_rows: [] };
        if (r_we) projectGroups[loa_id].wbs_rows.push({ wbs_type: r_wt || c_wt, wbs_element: r_we, wbs_description: r_wd });
    }

    let processedLoas = new Set();
    let alreadyExistsMessage = "";

    for (const loa_id of Object.keys(projectGroups)) {
        const { bu, customer, loa_name, wbs_rows } = projectGroups[loa_id];
        
        // Extract unique WBS elements from the current upload
        const uploadedWbs = [...new Set(wbs_rows.map(r => r.wbs_element.trim()))].filter(Boolean);
        if (uploadedWbs.length === 0) continue;

        // Check if Project already exists in master summary
        const [exSummary] = await db.query("SELECT id, merged_wbs FROM summary WHERE TRIM(loa_id) = ? LIMIT 1", [loa_id]);

        if (exSummary.length > 0) {
            // =======================================================
            // 🔄 CASE 2: Add WBS in Existing Project (LOA)
            // =======================================================
            console.log(`Action: Adding WBS to Existing Project [${loa_id}]`);

            // Merge existing and new WBS elements for strict uniqueness
            const existingWbs = exSummary[0].merged_wbs ? exSummary[0].merged_wbs.split(',').map(w => w.trim()).filter(Boolean) : [];
            const finalMergedWbs = Array.from(new Set([...existingWbs, ...uploadedWbs])).join(',');

            // A. Update `summary` Table (merged_wbs & Merged_wbs_category)
            await db.query(`
                UPDATE summary 
                SET merged_wbs = ?,
                    Merged_wbs_category = CONCAT(?, '-', categories)
                WHERE TRIM(loa_id) = ?
            `, [finalMergedWbs, finalMergedWbs, loa_id]);

            // B. In `wbs_loa_id_mapping1`, insert only TRULY NEW WBS elements
            const [exMappings] = await db.query("SELECT TRIM(single_wbs) as single_wbs FROM wbs_loa_id_mapping1 WHERE TRIM(loa_id) = ?", [loa_id]);
            const existingMappingWbs = exMappings.map(m => m.single_wbs.toUpperCase());
            let newWbsToMap = wbs_rows.filter(row => !existingMappingWbs.includes(row.wbs_element.toUpperCase()));
            
            if (newWbsToMap.length > 0) {
                const mapRows = newWbsToMap.map(r => [
                    bu, customer, loa_id, loa_name, r.wbs_type, r.wbs_element, r.wbs_description, finalMergedWbs, created_by
                ]);
                await db.query(`
                    INSERT INTO wbs_loa_id_mapping1 
                    (bu, customer, loa_id, loa_name, wbs_type, single_wbs, wbs_description, merged_wbs, created_by) 
                    VALUES ?
                `, [mapRows]);
            }

            // C. Forcefully update `merged_wbs` for ALL rows matching `loa_id` in mapping table
            await db.query("UPDATE wbs_loa_id_mapping1 SET merged_wbs = ? WHERE TRIM(loa_id) = ?", [finalMergedWbs, loa_id]);
            processedLoas.add(loa_id);
        } else {
            // =======================================================
            // 🆕 CASE 1: Add Project (New LOA Entry)
            // =======================================================
            console.log(`Action: Adding Brand New Project [${loa_id}]`);

            const finalMergedWbs = uploadedWbs.join(',');

            // A. Seed Master `summary` Table (24 Categories)
            let summaryRows = CATEGORY_MAP.map(item => [
                bu, customer, loa_id, loa_name, item.type, item.cat, finalMergedWbs, `${finalMergedWbs}-${item.cat}`, 'Active'
            ]);
            await db.query(`
                INSERT INTO summary 
                (bu, customer, loa_id, loa_name, cost_revenue, categories, merged_wbs, Merged_wbs_category, active_inactive) 
                VALUES ?
            `, [summaryRows]);

            // B. Insert mapping rows in `wbs_loa_id_mapping1`
            const mapRows = wbs_rows.map(r => [
                bu, customer, loa_id, loa_name, r.wbs_type, r.wbs_element, r.wbs_description, finalMergedWbs, created_by
            ]);
            await db.query(`
                INSERT INTO wbs_loa_id_mapping1 
                (bu, customer, loa_id, loa_name, wbs_type, single_wbs, wbs_description, merged_wbs, created_by) 
                VALUES ?
            `, [mapRows]);

            processedLoas.add(loa_id);
        }
    }

    // 🚀 Refresh Final Dashboard Table (Strictly matched columns)
    const loaList = Array.from(processedLoas);
    if (loaList.length > 0) {
        await db.query("DELETE FROM final_dashboard_table WHERE loa_id IN (?)", [loaList]);
        await db.query(`INSERT INTO final_dashboard_table (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, wbs_type, wbs_description, wbs_element_single, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, non_committed_editable, unique_key)
            SELECT bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, wbs_type, wbs_description, wbs_element_single, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, non_committed_editable, unique_key FROM final_dashboard WHERE loa_id IN (?)`, [loaList, loaList]);
    }
    
    return { 
        message: `${alreadyExistsMessage}Successfully Processed ${processedLoas.size} Project(s).` 
    };
};

// ==========================================
// EXPORTED API HANDLERS
// ==========================================

exports.processProjectPaste = async (req, res) => {
    try {
        if (!req.body.rawText) return res.status(400).json({ error: "No data pasted" });
        const dataGrid = req.body.rawText.trim().split(/\r?\n/).map(l => l.split('\t'));
        const result = await processProjectData(dataGrid, req.user?.email || 'System', req.body.mode || 'new');
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.uploadProjectFile = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        const wb = XLSX.readFile(req.file.path);
        const dataGrid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        const result = await processProjectData(dataGrid, req.user?.email || 'System', req.body.mode || 'new');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(200).json(result);
    } catch (error) { 
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message }); 
    }
};

// Database standardisation cleanup script
exports.fixMissingSummaryRows = async (req, res) => {
    try {
        console.log("Starting Smart Cleanup...");
        await db.query(`DELETE FROM summary WHERE loa_id NOT IN (SELECT DISTINCT loa_id FROM wbs_loa_id_mapping1)`);
        const [mappingPairs] = await db.query("SELECT DISTINCT loa_id FROM wbs_loa_id_mapping1");
        let added = 0;
        for (const pair of mappingPairs) {
            for (const item of CATEGORY_MAP) {
                const [exists] = await db.query("SELECT 1 FROM summary WHERE TRIM(loa_id) = ? AND categories = ?", [pair.loa_id.trim(), item.cat]);
                if (exists.length === 0) {
                    const [info] = await db.query("SELECT bu, customer, loa_name, merged_wbs FROM summary WHERE TRIM(loa_id) = ? LIMIT 1", [pair.loa_id.trim()]);
                    if (info.length > 0) {
                        await db.query(`INSERT INTO summary (bu, customer, loa_id, loa_name, cost_revenue, categories, merged_wbs, Merged_wbs_category, asbl, active_inactive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'Active')`, [info[0].bu, info[0].customer, pair.loa_id, info[0].loa_name, item.type, item.cat, info[0].merged_wbs, `${info[0].merged_wbs}-${item.cat}`]);
                        added++;
                    }
                }
            }
        }
        res.status(200).json({ message: "DB Standardized!", rows_inserted: added });
    } catch (error) { res.status(500).json({ error: error.message }); }
};