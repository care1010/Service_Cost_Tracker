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
    { cat: "DISC INTÂ COM CUST", type: "Cost" }, { cat: "EXTEND WARRÂ CUST PR", type: "Cost" },
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
        const dataLines = lines.slice(1);

        // Dynamic Column Index Mapping
        const idxBu = headers.findIndex(h => h.includes('BUSINESS DIVISION') || h === 'BU');
        const idxCustomer = headers.findIndex(h => h.includes('CT NAME') || h === 'CUSTOMER_');
        const idxLoaId = headers.findIndex(h => h.includes('OPPORTUNITY CODE') || h === 'LOA_ID');
        const idxLoaName = headers.findIndex(h => h.includes('PROJECT DESCRIPTION') || h === 'LOA_NAME');
        const idxWbsType = headers.findIndex(h => h.includes('WBS TYPE'));
        const idxWbsElement = headers.findIndex(h => h === 'WBS');
        const idxWbsDesc = headers.findIndex(h => h.includes('WBS DESCRIPTION'));
        const idxMerged = headers.findIndex(h => h === 'MERGED');

        if (idxLoaId === -1 || idxWbsElement === -1) {
            return res.status(400).json({ error: "Invalid Excel Template! Opportunity Code and WBS columns must be present." });
        }

        const projectGroups = {};
        
        // Carry-forward states for merged cells
        let current_bu = "";
        let current_customer = "";
        let current_loa_id = "";
        let current_loa_name = "";
        let current_merged_wbs = "";

        for (let line of dataLines) {
            if (line.trim() === '') continue; // Skip truly empty lines safely

            let cols = line.split('\t').map(c => c.trim());

            // 🔥 MASTER FIX: If browser/excel stripped leading empty cells on row 2,3,4, pad them dynamically
            if (cols.length < headers.length) {
                const paddingCount = headers.length - cols.length;
                const padding = Array(paddingCount).fill("");
                cols.unshift(...padding); // Prepend empty elements to perfectly align indexes
            }

            // Mapping columns dynamically based on detected indexes
            const bu = (idxBu !== -1 && cols[idxBu]) ? cols[idxBu] : current_bu;
            const customer = (idxCustomer !== -1 && cols[idxCustomer]) ? cols[idxCustomer] : current_customer;
            const loa_id = (idxLoaId !== -1 && cols[idxLoaId]) ? cols[idxLoaId] : current_loa_id;
            const loa_name = (idxLoaName !== -1 && cols[idxLoaName]) ? cols[idxLoaName] : current_loa_name;
            const wbs_type = (idxWbsType !== -1 && cols[idxWbsType]) ? cols[idxWbsType] : null;
            const wbs_element = (idxWbsElement !== -1 && cols[idxWbsElement]) ? cols[idxWbsElement] : null;
            const wbs_description = (idxWbsDesc !== -1 && cols[idxWbsDesc]) ? cols[idxWbsDesc] : null;
            const merged_wbs = (idxMerged !== -1 && cols[idxMerged]) ? cols[idxMerged] : current_merged_wbs;

            // Update carry-forward state safely
            if (idxBu !== -1 && cols[idxBu]) current_bu = cols[idxBu];
            if (idxCustomer !== -1 && cols[idxCustomer]) current_customer = cols[idxCustomer];
            if (idxLoaId !== -1 && cols[idxLoaId]) current_loa_id = cols[idxLoaId];
            if (idxLoaName !== -1 && cols[idxLoaName]) current_loa_name = cols[idxLoaName];
            if (idxMerged !== -1 && cols[idxMerged]) current_merged_wbs = cols[idxMerged];

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
        let skipCount = 0;
        const created_by = req.user?.email || 'System';

        for (const loa_id of Object.keys(projectGroups)) {
            const group = projectGroups[loa_id];
            const { bu, customer, loa_name, merged_wbs, wbs_rows } = group;

            if (wbs_rows.length === 0) continue;

            // Check if Project exists in summary
            const [exSummary] = await db.query("SELECT wbs FROM summary WHERE TRIM(loa_id) = ? LIMIT 1", [loa_id]);

            if (exSummary.length > 0) {
                // --- CASE: UPDATE EXISTING PROJECT ---
                let dbWbsArray = exSummary[0].wbs ? exSummary[0].wbs.split(',').map(w => w.trim()) : [];
                
                // Compare with actual existing rows in mapping table instead of summary.wbs list (Desync Proof)
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
                    continue;
                } else {
                    const newWbsNames = newWbsElements.map(row => row.wbs_element);
                    const updatedWbsList = [...dbWbsArray, ...newWbsNames];
                    const updatedWbsString = updatedWbsList.join(',');

                    // A. Update Summary Table (All 54 rows for this LOA)
                    await db.query("UPDATE summary SET wbs = ? WHERE TRIM(loa_id) = ?", [updatedWbsString, loa_id]);

                    // B. Update Existing Mapping Rows
                    await db.query("UPDATE wbs_loa_id_mapping1 SET wbs = ? WHERE TRIM(loa_id) = ?", [updatedWbsString, loa_id]);

                    // C. Insert New Mapping Rows
                    const newMappingRows = newWbsElements.map(row => [
                        loa_id,                // Column 1: loa_id
                        row.wbs_type,          // Column 2: wbs_type
                        row.wbs_element,       // Column 3: wbs_element (Individual WBS Element)
                        row.wbs_description,   // Column 4: wbs_description
                        updatedWbsString,      // Column 5: wbs (Merged comma-separated string)
                        created_by             // Column 6: created_by
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

                // A. Insert into summary table
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

                // B. Insert into wbs_loa_id_mapping1
                const mappingRows = wbs_rows.map(row => [
                    loa_id,                // Column 1: loa_id
                    row.wbs_type,          // Column 2: wbs_type
                    row.wbs_element,       // Column 3: wbs_element (Individual WBS Element)
                    row.wbs_description,   // Column 4: wbs_description
                    finalMergedWbs,        // Column 5: wbs (Merged comma-separated string)
                    created_by             // Column 6: created_by
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
            return res.status(400).json({ error: "Duplicate Data! No new WBS elements found for these projects." });
        }

        // 3. REFRESH DASHBOARD (Targeted)
        const loaList = Array.from(processedLoas);
        if (loaList.length > 0) {
            await db.query("DELETE FROM final_dashboard_table WHERE loa_id IN (?)", [loaList]);
            await db.query(`
                INSERT INTO final_dashboard_table 
                (bu, customer, loa_id, loa_name, cost_revenue, categories, wbs,wbs_type, wbs_description, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key)
                SELECT bu, customer, loa_id, loa_name, cost_revenue, categories, wbs,wbs_type, wbs_description, asbl, asbl_loa, non_committed, active_inactive, period, ptd, open_commitment_KEUR, eac, eac_vs_asbl, unique_key 
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

        res.status(200).json({ message: `Processed: ${processedLoas.size} Projects, Skipped data: ${skipCount}` });

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        res.status(500).json({ error: "Processing failed: " + error.message });
    }
};