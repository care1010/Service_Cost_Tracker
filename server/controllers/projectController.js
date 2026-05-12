const db = require('../config/db');

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
    { cat: "DISC INTÂ CUST PR OG", type: "Cost" }, { cat: "EXTEND WARRÂ CUST PR", type: "Cost" },
    { cat: "ADD WARR PROV CUST P", type: "Cost" }, { cat: "REL EX WAR PROV C PR", type: "Cost" },
    { cat: "IMPORT FREIGHT FOR", type: "Cost" }, { cat: "Other", type: "Cost" },
    { cat: "I&C Services + DD Resources", type: "Cost" }, { cat: "TPM +EMS Resources", type: "Cost" },
    { cat: "Cross ERP Cost", type: "Cost" },
    { cat: "New Category", type: "Cost" }
];

exports.processProjectPaste = async (req, res) => {
    const { rawText } = req.body;
    if (!rawText || rawText.trim() === '') return res.status(400).json({ error: "No data pasted" });

    try {
        const lines = rawText.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
        const headers = lines[0].split('\t').map(h => h.trim().toUpperCase());
        const dataLines = (headers.includes('BU') || headers.includes('LOA_ID')) ? lines.slice(1) : lines;

        let processedLoas = new Set();
        let skipCount = 0;

        for (let line of dataLines) {
            const cols = line.split('\t').map(c => c.trim());
            if (cols.length < 5) continue;

            const bu = cols[0], customer = cols[1], project_amc = cols[3], loa_id = cols[4], loa_name = cols[5];
            if (!loa_id) continue;

            // 1. WBS Cleaning (Metadata ko list se bahar nikalna)
            let rawWbs = cols.slice(7).filter(w => w && w !== '');
            let pastedWbsList = rawWbs.filter(w => 
                w.toUpperCase() !== loa_id.toUpperCase() && 
                w.toUpperCase() !== loa_name.toUpperCase()
            );

            // 2. Check if Project Exists
            const [exSummary] = await db.query("SELECT wbs FROM summary WHERE TRIM(loa_id) = ? LIMIT 1", [loa_id]);

            if (exSummary.length > 0) {
                // --- CASE: UPDATE EXISTING PROJECT ---
                let dbWbsArray = exSummary[0].wbs ? exSummary[0].wbs.split(',').map(w => w.trim()) : [];
                let newWbsElements = pastedWbsList.filter(w => !dbWbsArray.map(dw => dw.toUpperCase()).includes(w.toUpperCase()));

                if (newWbsElements.length === 0) {
                    skipCount++;
                    continue;
                } else {
                    // 🔥 GLOBAL SYNC LOGIC
                    const updatedWbsList = [...dbWbsArray, ...newWbsElements];
                    const updatedWbsString = updatedWbsList.join(',');

                    // A. Update Summary Table (All 54 rows for this LOA)
                    await db.query("UPDATE summary SET wbs = ? WHERE TRIM(loa_id) = ?", [updatedWbsString, loa_id]);

                    // B. Update Existing Mapping Rows (Purane WBS ki list update karein)
                    await db.query("UPDATE wbs_loa_id_mapping SET wbs = ? WHERE TRIM(loa_id) = ?", [updatedWbsString, loa_id]);

                    // C. Insert New Mapping Rows (Sirf naye WBS ke liye)
                    const newMappingRows = newWbsElements.map(w => [w, updatedWbsString, loa_id, project_amc]);
                    await db.query(`INSERT INTO wbs_loa_id_mapping (wbs_element, wbs, loa_id, warranty_wbs) VALUES ?`, [newMappingRows]);
                    
                    processedLoas.add(loa_id);
                }
            } else {
                // --- CASE: INSERT NEW PROJECT ---
                const combinedWbs = pastedWbsList.join(',');
                const summaryRows = CATEGORY_MAP.map(item => [bu, customer, loa_id, loa_name, item.type, item.cat, combinedWbs, 0, 'Active']);
                await db.query(`INSERT INTO summary (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, asbl, active_inactive) VALUES ?`, [summaryRows]);

                const mappingRows = pastedWbsList.map(w => [w, combinedWbs, loa_id, project_amc]);
                await db.query(`INSERT INTO wbs_loa_id_mapping (wbs_element, wbs, loa_id, warranty_wbs) VALUES ?`, [mappingRows]);
                
                processedLoas.add(loa_id);
            }
        }

        if (processedLoas.size === 0 && skipCount > 0) {
            return res.status(400).json({ error: "Duplicate Data! No new WBS elements found for these projects." });
        }

        // 3. REFRESH DASHBOARD (Targeted)
        const loaList = Array.from(processedLoas);
        if (loaList.length > 0) {
            await db.query("DELETE FROM final_dashboard_table WHERE loa_id IN (?)", [loaList]);
            await db.query(`
                INSERT INTO final_dashboard_table 
                (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key)
                SELECT bu, customer, loa_id, loa_name, cost_revenue, categories, wbs, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key 
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

        res.status(200).json({ message: `Success! Processed: ${processedLoas.size}, Skipped: ${skipCount}` });

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        res.status(500).json({ error: "Processing failed: " + error.message });
    }
};