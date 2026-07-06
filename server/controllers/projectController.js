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
    { cat: "FMA", type: "Cost" }, { cat: "Additional Services", type: "Cost" },
    { cat: "Others-Not found in Cost Mapping", type: "Cost" }, { cat: "Quality Audit +FMA", type: "Cost" },
    { cat: "3rd Party Cost P20", type: "Cost" }, { cat: "MATERIAL USAGE CUST", type: "Cost" },
    { cat: "MATERIAL COCUST SUB", type: "Cost" }, { cat: "MAT COS NSN ON-GOING", type: "Cost" },
    { cat: "MAT.COSÂ MANUALÂ ONG", type: "Cost" }, { cat: "SERVCOS NSN ON-GOING EN", type: "Cost" },
    { cat: "CONTRACTÂ CUST PR OG", type: "Cost" }, { cat: "RAW MAT TO SUBCONTR", type: "Cost" },
    { cat: "MAT COST ACCR CR", type: "Cost" }, { cat: "PROJECT TRAVELÂ CUST", type: "Cost" },
    { cat: "FG PURCH EXT CR", type: "Cost" }, { cat: "FG PURCH EXT CS", type: "Cost" },
    { cat: "SCRFG W/O PR IN CAT", type: "Cost" }, { cat: "SCR FG W/O PROV CR", type: "Cost" },
    { cat: "OTHER COS CUST PR OG", type: "Cost" }, { cat: "SALES FREIGHT CUST P", type: "Cost" },
    { cat: "DUTIES CUST PR OG", type: "Cost" }, { cat: "OTHER DIR CUST PR OG", type: "Cost" },
    { cat: "CR RISKÂ CUST PR OG", type: "Cost" }, { cat: "CONTR BOND CUST PR O", type: "Cost" },
    { cat: "BANK FEES CUST PR OG", type: "Cost" }, { cat: "LETTER OF CRÂ CUST P", type: "Cost" },
    { cat: "DISC INTÂ COM CUST", type: "Cost" }, { cat: "EXTEND WARRÂ CUST PR", type: "Cost" },
    { cat: "ADD WARR PROV CUST P", type: "Cost" }, { cat: "REL EX WAR PROV C PR", type: "Cost" },
    { cat: "IMPORT FREIGHT FOR", type: "Cost" }, { cat: "Other", type: "Cost" },
    { cat: "I&C Services + DD Resources", type: "Cost" }, { cat: "TPM +EMS Resources", type: "Cost" },
    { cat: "Cross ERP Cost", type: "Cost" },
    { cat: "New Category", type: "Cost" }
];

// 🔥 Standardized Core Processing Engine accepting normalized JSON rows
const processProjectData = async (rows, created_by) => {
    if (!rows || rows.length === 0) {
        throw new Error("No data found to process!");
    }

    // Get the keys from the first row (headers are already uppercase and trimmed)
    const firstRowKeys = Object.keys(rows[0]);

    // Dynamic Column Key Matching
    const keyBu = firstRowKeys.find(k => k.includes('BUSINESS DIVISION') || k === 'BU');
    const keyCustomer = firstRowKeys.find(k => k.includes('CT NAME') || k === 'CUSTOMER_');
    const keyLoaId = firstRowKeys.find(k => k.includes('OPPORTUNITY CODE') || k === 'LOA_ID');
    const keyLoaName = firstRowKeys.find(k => k.includes('PROJECT DESCRIPTION') || k === 'LOA_NAME');
    const keyWbsType = firstRowKeys.find(k => k.includes('WBS TYPE'));
    const keyWbsElement = firstRowKeys.find(k => k === 'WBS');
    const keyWbsDesc = firstRowKeys.find(k => k.includes('WBS DESCRIPTION'));
    const keyMerged = firstRowKeys.find(k => k === 'MERGED');

    if (!keyLoaId || !keyWbsElement) {
        throw new Error("Invalid Excel Template! Opportunity Code and WBS columns must be present.");
    }

    const projectGroups = {};
    
    // Carry-forward states for merged cells
    let current_bu = "";
    let current_customer = "";
    let current_loa_id = "";
    let current_loa_name = "";
    let current_merged_wbs = "";

    for (let row of rows) {
        const raw_bu = row[keyBu];
        const raw_customer = row[keyCustomer];
        const raw_loa_id = row[keyLoaId];
        const raw_loa_name = row[keyLoaName];
        const raw_wbs_type = row[keyWbsType];
        const raw_wbs_element = row[keyWbsElement];
        const raw_wbs_description = row[keyWbsDesc];
        const raw_merged_wbs = row[keyMerged];

        const bu = raw_bu || current_bu;
        const customer = raw_customer || current_customer;
        const loa_id = raw_loa_id || current_loa_id;
        const loa_name = raw_loa_name || current_loa_name;
        const wbs_type = raw_wbs_type || null;
        const wbs_element = raw_wbs_element || null;
        const wbs_description = raw_wbs_description || null;
        const merged_wbs = raw_merged_wbs || current_merged_wbs;

        // Update carry-forward state safely
        if (raw_bu) current_bu = raw_bu;
        if (raw_customer) current_customer = raw_customer;
        if (raw_loa_id) current_loa_id = raw_loa_id;
        if (raw_loa_name) current_loa_name = raw_loa_name;
        if (raw_merged_wbs) current_merged_wbs = raw_merged_wbs;

        if (!loa_id) continue;

        if (!projectGroups[loa_id]) {
            projectGroups[loa_id] = {
                bu,
                customer,
                loa_id,
                loa_name,
                merged_wbs,
                wbs_rows: []
            };
        }

        if (wbs_element) {
            projectGroups[loa_id].wbs_rows.push({
                wbs_type,
                wbs_element,
                wbs_description
            });
        }
    }

    let processedLoas = new Set();
    const skippedLoas = new Set(); 
    let skipCount = 0;

    for (const loa_id of Object.keys(projectGroups)) {
        const group = projectGroups[loa_id];
        const { bu, customer, loa_name, merged_wbs, wbs_rows } = group;

        if (wbs_rows.length === 0) continue;

        const [exSummary] = await db.query("SELECT wbs FROM summary WHERE TRIM(loa_id) = ? LIMIT 1", [loa_id]);

        if (exSummary.length > 0) {
            // --- CASE: UPDATE EXISTING PROJECT ---
            let dbWbsArray = exSummary[0].wbs ? exSummary[0].wbs.split(',').map(w => w.trim()) : [];
            
            const [exMappings] = await db.query(
                "SELECT TRIM(wbs_element) as wbs_element FROM wbs_loa_id_mapping1 WHERE TRIM(loa_id) = ?",
                [loa_id]
            );
            const existingMappingWbs = exMappings.map(m => m.wbs_element.toUpperCase());

            let newWbsElements = wbs_rows.filter(row => 
                !existingMappingWbs.includes(row.wbs_element.toUpperCase())
            );

            if (newWbsElements.length === 0) {
                skipCount += wbs_rows.length;
                skippedLoas.add(loa_id); 
                continue;
            } else {
                const newWbsNames = newWbsElements.map(row => row.wbs_element);
                const updatedWbsList = [...dbWbsArray, ...newWbsNames];
                const updatedWbsString = updatedWbsList.join(',');

                await db.query("UPDATE summary SET wbs = ? WHERE TRIM(loa_id) = ?", [updatedWbsString, loa_id]);
                await db.query("UPDATE wbs_loa_id_mapping1 SET wbs = ? WHERE TRIM(loa_id) = ?", [updatedWbsString, loa_id]);

                const newMappingRows = newWbsElements.map(row => [
                    loa_id,
                    row.wbs_type,
                    row.wbs_element,
                    row.wbs_description,
                    updatedWbsString,
                    created_by
                ]);

                await db.query(`
                    INSERT INTO wbs_loa_id_mapping1 
                    (loa_id, wbs_type, wbs_element, wbs_description, wbs, created_by) 
                    VALUES ?
                `, [newMappingRows]);
                
                processedLoas.add(loa_id);
            }
        } else {
            // --- CASE: INSERT NEW PROJECT ---
            const finalMergedWbs = merged_wbs || wbs_rows.map(r => r.wbs_element).join(',');

            const summaryRows = CATEGORY_MAP.map(item => [
                bu, 
                customer, 
                loa_id, 
                loa_name, 
                item.type, 
                item.cat, 
                finalMergedWbs, 
                0, 
                'Active'
            ]);
            
            await db.query(`
                INSERT INTO summary 
                (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, asbl, active_inactive) 
                VALUES ?
            `, [summaryRows]);

            const mappingRows = wbs_rows.map(row => [
                loa_id,
                row.wbs_type,
                row.wbs_element,
                row.wbs_description,
                finalMergedWbs,
                created_by
            ]);

            await db.query(`
                INSERT INTO wbs_loa_id_mapping1 
                (loa_id, wbs_type, wbs_element, wbs_description, wbs, created_by) 
                VALUES ?
            `, [mappingRows]);
            
            processedLoas.add(loa_id);
        }
    }

    if (processedLoas.size === 0 && skipCount > 0) {
        throw new Error(`Duplicate Data! All WBS elements for Project(s) [${Array.from(skippedLoas).join(', ')}] already exist in the database.`);
    }

    // REFRESH DASHBOARD
    const loaList = Array.from(processedLoas);
    if (loaList.length > 0) {
        await db.query("DELETE FROM final_dashboard_table WHERE loa_id IN (?)", [loaList]);
        await db.query(`
            INSERT INTO final_dashboard_table 
            (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, wbs_type, wbs_description, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key)
            SELECT bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, wbs_type, wbs_description, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key 
            FROM final_dashboard WHERE loa_id IN (?)
        `, [loaList]);

        await db.query(`
            UPDATE final_dashboard_table t
            JOIN (
                SELECT loa_name, categories, SUM(open_commitment_KEUR) as total_sum
                FROM final_dashboard_table WHERE loa_id IN (?)
                GROUP BY loa_name, categories
            ) as src ON t.loa_name = src.loa_name AND t.categories = src.categories
            SET t.total_oc_fixed = src.total_sum
            WHERE t.loa_id IN (?)
        `, [loaList, loaList]);
    }

    return {
        message: `Success! Processed: ${processedLoas.size} Projects, Skipped elements: ${skipCount}`
    };
};

// --- A. Copy-Paste endpoint ---
exports.processProjectPaste = async (req, res) => {
    const { rawText } = req.body;
    if (!rawText || rawText.trim() === '') return res.status(400).json({ error: "No data pasted" });

    try {
        const lines = rawText.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
        const headers = lines[0].split('\t').map(h => h.trim().toUpperCase());
        const dataLines = lines.slice(1);

        // Normalize text lines to JSON objects
        const rows = dataLines.map(line => {
            const cols = line.split('\t').map(c => c.trim());
            const rowObj = {};
            headers.forEach((header, index) => {
                rowObj[header] = cols[index] || "";
            });
            return rowObj;
        });

        const created_by = req.user?.email || 'System';
        const result = await processProjectData(rows, created_by);
        res.status(200).json({ message: result.message });
    } catch (error) {
        console.error("PASTE PROCESSING ERROR:", error);
        res.status(500).json({ error: error.message });
    }
};

// --- 🔥 B. Optimized File Upload endpoint (Uses sheet_to_json directly) ---
exports.uploadProjectFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Please upload an Excel file" });
        }

        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Parse sheet to raw json rows (retains empty fields as "")
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // Normalize Excel rows keys to strict uppercase for 100% dynamic mapping
        const rows = rawRows.map(row => {
            const rowObj = {};
            Object.keys(row).forEach(key => {
                rowObj[key.trim().toUpperCase()] = String(row[key]).trim();
            });
            return rowObj;
        });

        const created_by = req.user?.email || 'System';
        const result = await processProjectData(rows, created_by);

        // Cleanup temp file
        fs.unlinkSync(req.file.path);

        res.status(200).json({ message: result.message });
    } catch (error) {
        console.error("FILE UPLOAD ERROR:", error);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path); 
        }
        res.status(500).json({ error: error.message });
    }
};