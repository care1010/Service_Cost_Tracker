const db = require('../config/db');
const xlsx = require('xlsx');

const formatExcelDate = (excelDate) => {
    if (!excelDate) return null;
    if (typeof excelDate === 'number') {
        const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    if (typeof excelDate === 'string' && excelDate.includes('-')) {
        const parts = excelDate.split('-');
        if (parts.length === 3) {
            let day = parts[0], month = parts[1], year = parts[2];
            if (year.length === 2) year = "20" + year;
            return `${year}-${month}-${day}`;
        }
    }
    return excelDate;
};

exports.uploadPtdData = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });
        const workbook = xlsx.readFile(req.file.path, { cellDates: true });
        const sheetNames = workbook.SheetNames;
        let affectedLoas = new Set();
        const batchSize = 500;

        // ==========================================
        // --- 1. CJI5 SHEET PROCESSING (REPLACE MODE) ---
        // ==========================================
        if (sheetNames.includes('CJI5')) {
            const cji5Data = xlsx.utils.sheet_to_json(workbook.Sheets['CJI5']);

            // 🔥 REPLACE MODE: Truncate existing data first, no need for duplicate check
            await db.query("TRUNCATE TABLE cji5_new");

            const cji5Rows = cji5Data
                .filter(row => row['WBS Element']) // Skip empty rows
                .map(row => {
                    if (row['LOA_ID']) affectedLoas.add(row['LOA_ID'].toString().trim());
                    return [
                        row['Project Def.'], row['WBS Element'], row['RefDocNo'], row['Item'],
                        row['CO object name'], row['Supplier'], row['Name'], row['Year'],
                        row['Per'], row['Cost elem.'], row['Cost element descr.'], row['Matl Group'],
                        row['Material'], row['Description'], row['User Name'], row['DocC'],
                        row['CoCode'], row['Exch. Rate'], row['Quantity'], row['Qty/plan'],
                        formatExcelDate(row['Debit date']), formatExcelDate(row['Doc. Date']),
                        row['Report currency'], row['Val.in rep.cur.'], row['TCurr'], row['Value TCur'], 
                        row['Obj Curr.'], row['Value in Obj. Crcy']
                    ];
                });

            if (cji5Rows.length > 0) {
                const sql = `INSERT INTO cji5_new (project_def, wbs_element, refdocno, item, co_object_name, supplier, name, year, per, cost_element, cost_element_descr, matl_group, material, description, user_name, docc, cocode, exch_rate, quantity, qty_plan, debit_date, doc_date, report_currency, val_in_rep_cur, tcurr, value_tcur, obj_curr, value_in_obj_crcy) VALUES ?`;
                await db.query(sql, [cji5Rows]);
            }
        }

        // ==========================================
        // --- 2. CJ74 SHEET PROCESSING (APPEND MODE) ---
        // ==========================================
        if (sheetNames.includes('CJ74')) {
            const cj74Data = xlsx.utils.sheet_to_json(workbook.Sheets['CJ74']);

            // 🔥 APPEND MODE: Granular duplicate validation to prevent re-uploading same data
            const cj74UniquePairs = Array.from(
                new Set(
                    cj74Data
                        .filter(row => row['Object'] && row['Year'] && row['Per'])
                        .map(row => `${row['Object'].toString().trim()}_${row['Year'].toString().trim()}_${row['Per'].toString().trim()}`)
                )
            ).map(str => {
                const [object_1, year, per] = str.split('_');
                return { object_1, year, per };
            });

            // Batch-check to prevent duplicates
            for (let i = 0; i < cj74UniquePairs.length; i += batchSize) {
                const batch = cj74UniquePairs.slice(i, i + batchSize);
                const conditions = batch.map(() => "(object_1 = ? AND year = ? AND per = ?)").join(" OR ");
                const params = batch.flatMap(item => [item.object_1, item.year, item.per]);

                const [duplicates] = await db.query(
                    `SELECT object_1, year, per FROM cj74_new WHERE ${conditions} LIMIT 1`,
                    params
                );

                if (duplicates.length > 0) {
                    const dup = duplicates[0];
                    return res.status(400).json({
                        error: `CJ74 data already exists for WBS/Object: ${dup.object_1} under Year ${dup.year} - Period ${dup.per}. Duplicate upload is not allowed.`
                    });
                }
            }

            // Actual Append Process
            const cj74Rows = cj74Data
                .filter(row => row['Object']) // Skip empty rows
                .map(row => {
                    if (row['LOA_ID']) affectedLoas.add(row['LOA_ID'].toString().trim());
                    return [
                        row['CoCd'], row['Year'], row['Per'], row['Project def.'], 
                        row['Object'], row['Object'], row['Object'], row['Profit Ctr'], 
                        row['Cost Element'], row['Cost element name'], row['Cost element descr.'], 
                        row['Pur. Doc.'], row['Purchase order text'], row['DocumentNo'], 
                        row['Material'], row['Material Description'], row['Name'], row['RefDocNo'], 
                        row['frm'], row['User Name'], row['Offst.acct'], row['Name of offsetting account'], 
                        row['Quantity'], formatExcelDate(row['Created on']), formatExcelDate(row['Postg Date']), 
                        formatExcelDate(row['Doc. Date']), row['TCurr'], row['Value TranCurr'], 
                        row['ObCur'], row['Value in Obj. Crcy'], row['RCurr'], row['Val.in RC']
                    ];
                });

            if (cj74Rows.length > 0) {
                const sql = `INSERT INTO cj74_new (cocd, year, per, proj_def, object_1, object_2, object_3, profit_ctr, cost_element, cost_element_name, cost_element_descr, pur_doc, purchase_order_text, document_no, material, material_description, name1, refdocno, frm, user_name, offst_acct, name_of_offsetting_account, quantity, created_on, postg_date, doc_date, tcurr, value_trancurr, obcur, val_in_obj_crcy, rcurr, val_in_rc) VALUES ?`;
                await db.query(sql, [cj74Rows]);
            }
        }

        // ==========================================
        // --- 3. DIRECT SPEED SYNC ---
        // ==========================================
        const loaList = Array.from(affectedLoas).filter(id => id);
        
        // Agar excel me LOA_ID column mapped na ho to sab sync karo
        if (loaList.length > 0) {
            await db.query(`
                UPDATE final_dashboard_table f
                LEFT JOIN (SELECT loa_id, categories, SUM(ptd) as ptd_sum FROM join_cj74_final GROUP BY loa_id, categories) cj 
                    ON f.loa_id = cj.loa_id AND f.categories = cj.categories
                LEFT JOIN (SELECT loa_id, categories, SUM(open_commitment_KEUR) as oc_sum FROM join_cji5 GROUP BY loa_id, categories) ci 
                    ON f.loa_id = ci.loa_id AND f.categories = ci.categories
                SET f.ptd = COALESCE(cj.ptd_sum, 0),
                    f.open_commitment_KEUR = COALESCE(ci.oc_sum, 0),
                    f.eac = (COALESCE(cj.ptd_sum, 0) + COALESCE(ci.oc_sum, 0) + f.non_committed),
                    f.eac_vs_asbl = (f.asbl - (COALESCE(cj.ptd_sum, 0) + COALESCE(ci.oc_sum, 0) + f.non_committed))
                WHERE f.loa_id IN (?)
            `, [loaList]);
        }

        res.status(200).json({ message: "PTD Data Uploaded and Dashboard Synced Successfully!" });
    } catch (error) { 
        console.error("PTD ERROR:", error); 
        res.status(500).json({ error: error.message }); 
    }
};