const db = require('../config/db');
const XLSX = require('xlsx');
const fs = require('fs');

// 🔥 Updated CATEGORY_MAP with exactly 24 Categories
const CATEGORY_MAP = [
    { cat: "Local Materials", type: "Cost" }, 
    { cat: "Transportation & Logistic cost", type: "Cost" },
    { cat: "Travel+Training", type: "Cost" }, 
    { cat: "SBU-Design+Dep.+Mig", type: "Cost" },
    { cat: "CE Resources", type: "Cost" }, 
    { cat: "Revenue", type: "Revenue" },
    { cat: "I&C Services", type: "Cost" }, 
    { cat: "DD Resources", type: "Cost" },
    { cat: "Welcome Center Costs", type: "Cost" }, 
    { cat: "Local TAC Support + L3 Support", type: "Cost" },
    { cat: "Repair cost", type: "Cost" }, 
    { cat: "Cost Reclass", type: "Cost" },
    { cat: "Project Management", type: "Cost" }, 
    { cat: "Software Upgrade + NSP Upgrade", type: "Cost" },
    { cat: "3rd Party Cost", type: "Cost" }, 
    { cat: "Not to considered", type: "NTC" },
    { cat: "Additional HW", type: "Cost" }, 
    { cat: "Risk and Contingencies", type: "Cost" },
    { cat: "Quality Audit + FMA", type: "Cost" }, 
    { cat: "Additional Services", type: "Cost" },
    { cat: "Others-Not found in Cost Mapping", type: "Cost" }, 
    { cat: "I&C Services + DD Resources", type: "Cost" }, 
    { cat: "Cross ERP Cost", type: "Cost" }, 
    { cat: "Total", type: "Cost" } 
];

const processProjectData = async (dataGrid, created_by) => {
    if (!dataGrid || dataGrid.length < 2) throw new Error("No data found or headers missing!");
    const headers = dataGrid[0].map(h => String(h || "").trim().toUpperCase());
    const idxBu = headers.findIndex(h => h.includes('BUSINESS DIVISION') || h === 'BU');
    const idxCustomer = headers.findIndex(h => h.includes('CT NAME') || h === 'CUSTOMER_');
    const idxLoaId = headers.findIndex(h => h.includes('OPPORTUNITY CODE') || h === 'LOA_ID');
    const idxLoaName = headers.findIndex(h => h.includes('PROJECT DESCRIPTION') || h === 'LOA_NAME');
    const idxWbsType = headers.findIndex(h => h.includes('WBS TYPE'));
    const idxWbsElement = headers.findIndex(h => h === 'WBS');
    const idxWbsDesc = headers.findIndex(h => h.includes('WBS DESCRIPTION'));
    const idxMerged = headers.findIndex(h => h === 'MERGED');

    if (idxLoaId === -1 || idxWbsElement === -1) throw new Error("Invalid Template! LOA ID and WBS are required.");

    const dataLines = dataGrid.slice(1);
    const projectGroups = {};
    let c_bu = "", c_cust = "", c_lid = "", c_lname = "", c_mwbs = "", c_wt = "";

    for (let cols of dataLines) {
        if (cols.every(c => !c || String(c).trim() === '')) continue;
        const r_bu = cols[idxBu]?.trim(), r_cust = cols[idxCustomer]?.trim(), r_lid = cols[idxLoaId]?.trim(), r_ln = cols[idxLoaName]?.trim(), r_wt = cols[idxWbsType]?.trim(), r_we = cols[idxWbsElement]?.trim(), r_wd = cols[idxWbsDesc]?.trim(), r_mw = cols[idxMerged]?.trim();
        if (r_bu) c_bu = r_bu; if (r_cust) c_cust = r_cust; if (r_lid) c_lid = r_lid; if (r_ln) c_lname = r_ln; if (r_mw) c_mwbs = r_mw; if (r_wt) c_wt = r_wt;
        const loa_id = r_lid || c_lid;
        if (!loa_id) continue;
        if (!projectGroups[loa_id]) projectGroups[loa_id] = { bu: r_bu || c_bu, customer: r_cust || c_cust, loa_id, loa_name: r_ln || c_lname, merged_wbs: r_mw || c_mwbs, wbs_rows: [] };
        if (r_we) projectGroups[loa_id].wbs_rows.push({ wbs_type: r_wt || c_wt, wbs_element: r_we, wbs_description: r_wd });
    }

    let processedLoas = new Set();
    const WBS_TYPES_MASTER = ["Project", "AMC", "Warranty/Other"];

    for (const loa_id of Object.keys(projectGroups)) {
        const { bu, customer, loa_name, merged_wbs, wbs_rows } = projectGroups[loa_id];
        const [exSummary] = await db.query("SELECT wbs FROM summary WHERE TRIM(loa_id) = ? LIMIT 1", [loa_id]);

        if (exSummary.length > 0) {
            const [exMappings] = await db.query("SELECT TRIM(wbs_element) as wbs_element FROM wbs_loa_id_mapping1 WHERE TRIM(loa_id) = ?", [loa_id]);
            const existingWbs = exMappings.map(m => m.wbs_element.toUpperCase());
            let newWbs = wbs_rows.filter(row => !existingWbs.includes(row.wbs_element.toUpperCase()));
            if (newWbs.length === 0) continue;
            const updatedWbsStr = Array.from(new Set([...(exSummary[0].wbs?.split(',') || []), ...newWbs.map(r => r.wbs_element)])).join(',');
            await db.query("UPDATE summary SET wbs = ? WHERE TRIM(loa_id) = ?", [updatedWbsStr, loa_id]);
            await db.query("UPDATE wbs_loa_id_mapping1 SET wbs = ? WHERE TRIM(loa_id) = ?", [updatedWbsStr, loa_id]);
            const mapRows = newWbs.map(r => [loa_id, r.wbs_type, r.wbs_element, r.wbs_description, updatedWbsStr, created_by]);
            await db.query("INSERT INTO wbs_loa_id_mapping1 (loa_id, wbs_type, wbs_element, wbs_description, wbs, created_by) VALUES ?", [mapRows]);
            processedLoas.add(loa_id);
        } else {
            // New Project: Insert 24 * 3 Rows
            const finalMergedWbs = merged_wbs || Array.from(new Set(wbs_rows.map(r => r.wbs_element))).join(',');
            let summaryRows = [];
            WBS_TYPES_MASTER.forEach(type => {
                CATEGORY_MAP.forEach(item => {
                    summaryRows.push([bu, customer, loa_id, loa_name, item.type, item.cat, finalMergedWbs, 0, 'Active', type]);
                });
            });
            await db.query("INSERT INTO summary (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, asbl, active_inactive, wbs_type) VALUES ?", [summaryRows]);
            const mapRows = wbs_rows.map(r => [loa_id, r.wbs_type, r.wbs_element, r.wbs_description, finalMergedWbs, created_by]);
            await db.query("INSERT INTO wbs_loa_id_mapping1 (loa_id, wbs_type, wbs_element, wbs_description, wbs, created_by) VALUES ?", [mapRows]);
            processedLoas.add(loa_id);
        }
    }

    const loaList = Array.from(processedLoas);
    if (loaList.length > 0) {
        await db.query("DELETE FROM final_dashboard_table WHERE loa_id IN (?)", [loaList]);
        await db.query(`INSERT INTO final_dashboard_table (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, wbs_type, wbs_description, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key)
            SELECT bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, wbs_type, wbs_description, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key FROM final_dashboard WHERE loa_id IN (?)`, [loaList, loaList]);
    }
    return { message: `Processed: ${processedLoas.size} Projects` };
};

exports.processProjectPaste = async (req, res) => {
    try {
        const dataGrid = req.body.rawText.trim().split(/\r?\n/).map(l => l.split('\t'));
        const result = await processProjectData(dataGrid, req.user?.email || 'System');
        res.status(200).json(result);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.uploadProjectFile = async (req, res) => {
    try {
        const wb = XLSX.readFile(req.file.path);
        const dataGrid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
        const result = await processProjectData(dataGrid, req.user?.email || 'System');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(200).json(result);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// Database Fix script for existing entries
exports.fixMissingSummaryRows = async (req, res) => {
    try {
        console.log("Starting DB Audit and Fix for 24 Categories...");
        const WBS_TYPES = ["Project", "AMC", "Warranty/Other"];
        const [uniqueProjects] = await db.query("SELECT DISTINCT bu, customer, loa_id, loa_name, wbs FROM summary");
        let totalNewRows = 0;

        for (const proj of uniqueProjects) {
            for (const typeStr of WBS_TYPES) {
                for (const item of CATEGORY_MAP) {
                    const [exists] = await db.query(
                        "SELECT 1 FROM summary WHERE TRIM(loa_id) = ? AND TRIM(wbs_type) = ? AND categories = ?",
                        [proj.loa_id.trim(), typeStr.trim(), item.cat]
                    );

                    if (exists.length === 0) {
                        await db.query(
                            `INSERT INTO summary (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, asbl, active_inactive, wbs_type) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Active', ?)`,
                            [proj.bu, proj.customer, proj.loa_id, proj.loa_name, item.type, item.cat, proj.wbs, typeStr]
                        );
                        totalNewRows++;
                    }
                }
            }
        }
        res.status(200).json({ message: "Database Standardized to 24 Categories!", rows_added: totalNewRows });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};