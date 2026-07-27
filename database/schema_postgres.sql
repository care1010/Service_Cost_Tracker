-- 2. Create Trigger Function for 'ON UPDATE CURRENT_TIMESTAMP'
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Tables
CREATE TABLE access (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  customer VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE access IS 'User-to-customer access control';

CREATE TABLE cj74_new (
  id SERIAL PRIMARY KEY,
  year INTEGER DEFAULT NULL,
  per VARCHAR(255) DEFAULT NULL,
  cocd VARCHAR(255) DEFAULT NULL,
  proj_def VARCHAR(255) DEFAULT NULL,
  object_1 VARCHAR(255) DEFAULT NULL,
  profit_ctr VARCHAR(255) DEFAULT NULL,
  name2 VARCHAR(255) DEFAULT NULL,
  tcurr TEXT DEFAULT NULL,
  value_trancurr DECIMAL(18,2) DEFAULT NULL,
  obcur VARCHAR(255) DEFAULT NULL,
  val_in_obj_crcy DECIMAL(18,2) DEFAULT NULL,
  val_in_rc DECIMAL(18,2) DEFAULT NULL,
  rcurr VARCHAR(255) DEFAULT NULL,
  cost_element VARCHAR(255) DEFAULT NULL,
  cost_element_name VARCHAR(255) DEFAULT NULL,
  cost_element_descr VARCHAR(255) DEFAULT NULL,
  refdocno VARCHAR(255) DEFAULT NULL,
  document_no VARCHAR(255) DEFAULT NULL,
  doc_date DATE DEFAULT NULL,
  postg_date DATE DEFAULT NULL,
  offst_acct VARCHAR(255) DEFAULT NULL,
  name_of_offsetting_account VARCHAR(255) DEFAULT NULL,
  object_2 VARCHAR(255) DEFAULT NULL,
  material VARCHAR(255) DEFAULT NULL,
  material_description VARCHAR(255) DEFAULT NULL,
  name1 VARCHAR(255) DEFAULT NULL,
  name22 VARCHAR(255) DEFAULT NULL,
  created_on DATE DEFAULT NULL,
  frm VARCHAR(255) DEFAULT NULL,
  user_name VARCHAR(255) DEFAULT NULL,
  object_3 VARCHAR(255) DEFAULT NULL,
  co_object_name VARCHAR(255) DEFAULT NULL,
  pur_doc VARCHAR(255) DEFAULT NULL,
  quantity DECIMAL(18,3) DEFAULT NULL,
  purchase_order_text VARCHAR(255) DEFAULT NULL
);

CREATE TABLE cji5_new (
  id SERIAL PRIMARY KEY,
  project_def VARCHAR(255) DEFAULT NULL,
  wbs_element VARCHAR(255) DEFAULT NULL,
  refdocno VARCHAR(255) DEFAULT NULL,
  item VARCHAR(255) DEFAULT NULL,
  co_object_name VARCHAR(255) DEFAULT NULL,
  supplier VARCHAR(255) DEFAULT NULL,
  name VARCHAR(255) DEFAULT NULL,
  exch_rate DECIMAL(18,6) DEFAULT NULL,
  year INTEGER DEFAULT NULL,
  per VARCHAR(255) DEFAULT NULL,
  cost_element VARCHAR(255) DEFAULT NULL,
  cost_element_descr VARCHAR(255) DEFAULT NULL,
  matl_group VARCHAR(255) DEFAULT NULL,
  material VARCHAR(255) DEFAULT NULL,
  description VARCHAR(255) DEFAULT NULL,
  user_name VARCHAR(255) DEFAULT NULL,
  docc VARCHAR(255) DEFAULT NULL,
  quantity DECIMAL(18,3) DEFAULT NULL,
  qty_plan DECIMAL(18,3) DEFAULT NULL,
  debit_date DATE DEFAULT NULL,
  doc_date DATE DEFAULT NULL,
  cocode VARCHAR(255) DEFAULT NULL,
  report_currency VARCHAR(255) DEFAULT NULL,
  val_in_rep_cur DECIMAL(18,2) DEFAULT NULL,
  tcurr TEXT DEFAULT NULL,
  value_tcur DECIMAL(18,2) DEFAULT NULL,
  obj_curr VARCHAR(255) DEFAULT NULL,
  value_in_obj_crcy DECIMAL(18,2) DEFAULT NULL
);

CREATE TABLE cost_mapping (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) DEFAULT NULL,
  cost_element_group_name VARCHAR(255) DEFAULT NULL,
  cost_element VARCHAR(100) DEFAULT NULL,
  cost_element_name VARCHAR(255) DEFAULT NULL,
  cost_element_desc TEXT DEFAULT NULL,
  cost_revenue VARCHAR(50) DEFAULT NULL,
  categories VARCHAR(100) DEFAULT NULL
);

CREATE TABLE customer (
  id SERIAL PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL UNIQUE,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE customer IS 'Master customer list';

-- Apply auto-update trigger
CREATE TRIGGER update_customer_modtime
BEFORE UPDATE ON customer
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TABLE erp_resource (
  id SERIAL PRIMARY KEY,
  tr_global_period VARCHAR(50) DEFAULT NULL,
  lm_nokia_id_name VARCHAR(255) DEFAULT NULL,
  home_country VARCHAR(100) DEFAULT NULL,
  resource_erp_type VARCHAR(100) DEFAULT NULL,
  resource_person_number VARCHAR(50) DEFAULT NULL,
  resource_nokia_id_name VARCHAR(255) DEFAULT NULL,
  time_entry_date DATE DEFAULT NULL,
  recorded_hours DECIMAL(5,2) DEFAULT NULL,
  time_entry_status VARCHAR(50) DEFAULT NULL,
  daily_working_hours DECIMAL(5,2) DEFAULT NULL,
  tr_wbs_care_contract_opp VARCHAR(255) DEFAULT NULL,
  tr_wbs_care_contract_opp_description TEXT DEFAULT NULL,
  svo_id VARCHAR(100) DEFAULT NULL,
  svo_description TEXT DEFAULT NULL,
  gic VARCHAR(100) DEFAULT NULL,
  gic_name VARCHAR(255) DEFAULT NULL,
  customer_team VARCHAR(255) DEFAULT NULL,
  time_approval_date DATE DEFAULT NULL,
  lm_email VARCHAR(255) DEFAULT NULL,
  resource_email VARCHAR(255) DEFAULT NULL,
  created_by VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  month VARCHAR(20) DEFAULT NULL,
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE final_dashboard_table (
  id VARCHAR(700) DEFAULT NULL,
  bu VARCHAR(100) DEFAULT NULL,
  customer VARCHAR(255) DEFAULT NULL,
  loa_id VARCHAR(100) DEFAULT NULL,
  loa_name VARCHAR(255) DEFAULT NULL,
  cost_revenue VARCHAR(100) DEFAULT NULL,
  categories VARCHAR(100) DEFAULT NULL,
  merged_wbs TEXT DEFAULT NULL,
  active_inactive VARCHAR(50) DEFAULT NULL,
  asbl DECIMAL(15,2) DEFAULT NULL,
  asbl_amc DECIMAL(15,2) DEFAULT NULL,
  asbl_project DECIMAL(15,2) DEFAULT NULL,
  asbl_warranty DECIMAL(15,2) DEFAULT NULL,
  asbl_loa DECIMAL(15,2) DEFAULT NULL,
  non_committed DECIMAL(15,2) DEFAULT NULL,
  non_committed_amc DECIMAL(15,2) DEFAULT NULL,
  non_committed_project DECIMAL(15,2) DEFAULT NULL,
  non_committed_warranty DECIMAL(15,2) DEFAULT NULL,
  non_committed_editable DECIMAL(15,2) DEFAULT NULL,
  non_committed_editable_amc DECIMAL(15,2) DEFAULT NULL,
  non_committed_editable_project DECIMAL(15,2) DEFAULT NULL,
  non_committed_editable_warranty DECIMAL(15,2) DEFAULT NULL,
  period VARCHAR(20) DEFAULT NULL,
  ptd DECIMAL(15,2) DEFAULT NULL,
  wbs_element_single VARCHAR(100) DEFAULT NULL,
  wbs_type VARCHAR(100) DEFAULT NULL,
  wbs_description TEXT DEFAULT NULL,
  open_commitment_KEUR DECIMAL(15,2) DEFAULT NULL,
  eac DECIMAL(15,2) DEFAULT NULL,
  eac_vs_asbl DECIMAL(15,2) DEFAULT NULL,
  Merged_wbs_categories TEXT DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE stg_cj74_agg (
  clean_wbs TEXT DEFAULT NULL,
  cost_element VARCHAR(255) DEFAULT NULL,
  period VARCHAR(16) DEFAULT NULL,
  ptd_val DECIMAL(44,6) DEFAULT NULL
);

CREATE TABLE stg_cji5_agg (
  clean_wbs TEXT DEFAULT NULL,
  cost_element TEXT DEFAULT NULL,
  oc_val DECIMAL(44,6) DEFAULT NULL
);

CREATE TABLE stg_master_mapping (
  single_wbs TEXT DEFAULT NULL,
  bu VARCHAR(100) DEFAULT NULL,
  customer VARCHAR(255) DEFAULT NULL,
  loa_id VARCHAR(100) DEFAULT NULL,
  loa_name VARCHAR(255) DEFAULT NULL,
  merged_wbs TEXT DEFAULT NULL,
  wbs_type VARCHAR(100) DEFAULT NULL,
  wbs_description TEXT DEFAULT NULL,
  categories VARCHAR(100) DEFAULT NULL,
  cost_element VARCHAR(100) DEFAULT NULL,
  mapped_cost_revenue VARCHAR(50) DEFAULT NULL,
  Merged_wbs_categories TEXT DEFAULT NULL
);

CREATE TABLE summary (
  id SERIAL PRIMARY KEY,
  bu VARCHAR(255) DEFAULT NULL,
  customer VARCHAR(255) DEFAULT NULL,
  loa_id VARCHAR(255) DEFAULT NULL,
  loa_name TEXT DEFAULT NULL,
  cost_revenue VARCHAR(255) DEFAULT NULL,
  categories VARCHAR(255) DEFAULT NULL,
  merged_wbs TEXT DEFAULT NULL,
  Merged_wbs_category TEXT DEFAULT NULL,
  active_inactive VARCHAR(255) DEFAULT 'Active',
  asbl DECIMAL(15,3) DEFAULT 0.000,
  asbl_amc DECIMAL(15,3) DEFAULT 0.000,
  asbl_project DECIMAL(15,3) DEFAULT 0.000,
  asbl_warranty DECIMAL(15,3) DEFAULT 0.000,
  asbl_loa DECIMAL(15,3) DEFAULT 0.000,
  ptd DECIMAL(15,3) DEFAULT 0.000,
  open_commitment_KEUR DECIMAL(15,3) DEFAULT 0.000,
  non_committed DECIMAL(15,3) DEFAULT 0.000,
  non_committed_amc DECIMAL(15,3) DEFAULT 0.000,
  non_committed_project DECIMAL(15,3) DEFAULT 0.000,
  non_committed_warranty DECIMAL(15,3) DEFAULT 0.000,
  eac DECIMAL(15,3) DEFAULT 0.000,
  eac_vs_asbl DECIMAL(15,3) DEFAULT 0.000,
  non_committed_editable DECIMAL(15,3) DEFAULT 0.000,
  non_committed_editable_amc DECIMAL(15,3) DEFAULT 0.000,
  non_committed_editable_project DECIMAL(15,3) DEFAULT 0.000,
  non_committed_editable_warranty DECIMAL(15,3) DEFAULT 0.000,
  updated_by VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Apply auto-update trigger
CREATE TRIGGER update_summary_modtime
BEFORE UPDATE ON summary
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TABLE temp (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  row_id VARCHAR(500) NOT NULL,
  Non_Commited DECIMAL(10,2) DEFAULT NULL,
  original_non_commited DECIMAL(10,2) DEFAULT NULL,
  timestamp TIMESTAMP NOT NULL
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  type VARCHAR(255) DEFAULT NULL,
  is_active VARCHAR(255) DEFAULT '1',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE users IS 'System login users';

-- Apply auto-update trigger
CREATE TRIGGER update_users_modtime
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TABLE user_activity_logs (
  id SERIAL PRIMARY KEY,
  user_email VARCHAR(255) DEFAULT NULL,
  bu VARCHAR(10) DEFAULT NULL,
  customer VARCHAR(255) DEFAULT NULL,
  loa_name VARCHAR(255) DEFAULT NULL,
  loa_id VARCHAR(20) DEFAULT NULL,
  categories VARCHAR(255) DEFAULT NULL,
  old_value DECIMAL(18,2) DEFAULT NULL,
  new_value DECIMAL(18,2) DEFAULT NULL,
  month_year VARCHAR(20) DEFAULT NULL,
  wbs_type VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active_inactive VARCHAR(20) DEFAULT NULL
);

CREATE TABLE wbs_loa_id_mapping1 (
  id SERIAL PRIMARY KEY,
  bu VARCHAR(100) DEFAULT NULL,
  customer VARCHAR(255) DEFAULT NULL,
  loa_id VARCHAR(100) DEFAULT NULL,
  loa_name VARCHAR(255) DEFAULT NULL,
  wbs_type VARCHAR(100) DEFAULT NULL,
  single_wbs VARCHAR(255) DEFAULT NULL,
  wbs_description TEXT DEFAULT NULL,
  merged_wbs TEXT DEFAULT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Indexes
CREATE INDEX idx_access_email ON access(email);
CREATE INDEX idx_access_customer ON access(customer);

CREATE INDEX idx_customer_is_active ON customer(is_active);

CREATE INDEX idx_bu ON final_dashboard_table(bu);
CREATE INDEX idx_loa_id ON final_dashboard_table(loa_id);
CREATE INDEX idx_dashboard_filters ON final_dashboard_table(customer, loa_name, categories, active_inactive, period);
CREATE INDEX idx_final_bu ON final_dashboard_table(bu);
CREATE INDEX idx_final_loa_id ON final_dashboard_table(loa_id);
CREATE INDEX idx_final_unique_key ON final_dashboard_table(Merged_wbs_categories);
CREATE INDEX idx_final_filters ON final_dashboard_table(customer, loa_name, categories, active_inactive, period);

CREATE INDEX idx_stg_cj74_agg_clean_wbs ON stg_cj74_agg(clean_wbs);
CREATE INDEX idx_stg_cj74_agg_cost_element ON stg_cj74_agg(cost_element);

CREATE INDEX idx_stg_cji5_agg_clean_wbs ON stg_cji5_agg(clean_wbs);
CREATE INDEX idx_stg_cji5_agg_cost_element ON stg_cji5_agg(cost_element);

CREATE INDEX idx_stg_master_mapping_single_wbs ON stg_master_mapping(single_wbs);
CREATE INDEX idx_stg_master_mapping_cost_element ON stg_master_mapping(cost_element);
CREATE INDEX idx_stg_master_mapping_Merged_wbs_categories ON stg_master_mapping(Merged_wbs_categories);

CREATE INDEX idx_sum_loa_cat ON summary(loa_id, categories);
CREATE INDEX idx_sum_merged ON summary(Merged_wbs_category);
CREATE INDEX idx_summary_loa ON summary(loa_id);
CREATE INDEX idx_summary_cat ON summary(categories);

CREATE INDEX idx_wbs_mapping_bu ON wbs_loa_id_mapping1(bu);
CREATE INDEX idx_wbs_mapping_customer ON wbs_loa_id_mapping1(customer);
CREATE INDEX idx_wbs_mapping_loa_id ON wbs_loa_id_mapping1(loa_id);
CREATE INDEX idx_wbs_mapping_loa_name ON wbs_loa_id_mapping1(loa_name);
CREATE INDEX idx_wbs_mapping_wbs_type ON wbs_loa_id_mapping1(wbs_type);
CREATE INDEX idx_wbs_mapping_single_wbs ON wbs_loa_id_mapping1(single_wbs);
CREATE INDEX idx_loa_mapping ON wbs_loa_id_mapping1(loa_id, loa_name);

-- (Note: Indexes for t_cj74_transformed and t_cji5_transformed omitted because their CREATE TABLE blocks were missing in the original snippet)


-- 5. Insert Data
INSERT INTO customer (id, customer_name, is_active, created_at, updated_at) VALUES
(1, 'INDIA BH CT Bharti', 1, '2026-07-23 11:26:23', '2026-07-23 11:26:23'),
(2, 'INDIA BD CT ISP, Media & Connectivity', 1, '2026-07-23 11:26:23', '2026-07-23 11:26:23'),
(3, 'INDIA REL CT Reliance JiO', 1, '2026-07-23 11:26:23', '2026-07-23 11:26:23'),
(4, 'INDIA Cloud CT Cloud Major', 1, '2026-07-23 11:26:23', '2026-07-23 11:26:23'),
(5, 'INDIA TA CT Tata Teleservices (TTSL)', 1, '2026-07-23 11:26:23', '2026-07-23 11:26:23'),
(6, 'INDIA MC ENT CT India', 1, '2026-07-23 11:26:23', '2026-07-23 11:26:23'),
(7, 'INDIA BD CT Business Development', 1, '2026-07-23 11:26:23', '2026-07-23 11:26:23'),
(8, 'INDIA TA CT Tata Communications (TCL)', 1, '2026-07-23 11:26:23', '2026-07-23 11:26:23'),
(9, 'INDIA VFI CT Vodafone Idea', 1, '2026-07-23 11:26:23', '2026-07-23 11:26:23'),
(10, 'INDIA GO CT BSNL/MTNL', 1, '2026-07-24 07:16:06', '2026-07-24 07:16:06');

-- Reset PostgreSQL sequence logic after manual ID inserts
SELECT setval('customer_id_seq', (SELECT MAX(id) FROM customer));


-- 6. Create Views
-- =====================================================================
-- 1. VIEW: join_summary 
-- =====================================================================
CREATE OR REPLACE VIEW join_summary AS 
SELECT 
    s.id::TEXT AS id, -- id is integer, casting to text for downstream CONCAT compatibility
    TRIM(s.bu) AS bu,
    TRIM(s.customer) AS customer,
    TRIM(s.loa_id) AS loa_id,
    TRIM(s.loa_name) AS loa_name,
    TRIM(s.cost_revenue) AS cost_revenue,
    TRIM(REPLACE(TRIM(s.categories), '  ', ' ')) AS categories,
    TRIM(s.merged_wbs) AS merged_wbs,
    TRIM(s.active_inactive) AS active_inactive,
    -- Removed TRIM() from numeric columns to prevent PostgreSQL type-casting errors
    s.asbl AS asbl,
    s.asbl_amc AS asbl_amc,
    s.asbl_project AS asbl_project,
    s.asbl_warranty AS asbl_warranty,
    s.asbl_loa AS asbl_loa,
    s.non_committed AS non_committed,
    s.non_committed_amc AS non_committed_amc,
    s.non_committed_project AS non_committed_project,
    s.non_committed_warranty AS non_committed_warranty,
    s.non_committed_editable AS non_committed_editable,
    s.non_committed_editable_amc AS non_committed_editable_amc,
    s.non_committed_editable_project AS non_committed_editable_project,
    s.non_committed_editable_warranty AS non_committed_editable_warranty,
    s.ptd AS ptd_old,
    s.open_commitment_KEUR AS oc_old,
    TRIM(s.updated_by) AS updated_by,
    s.updated_at AS updated_at,
    -- Replaced MySQL utf8mb4 conversion with standard PostgreSQL CAST to TEXT
    CAST(
        COALESCE(
            NULLIF(TRIM(s.Merged_wbs_category), ''),
            CASE 
                WHEN (TRIM(s.merged_wbs) <> '') AND (TRIM(s.categories) <> '') 
                THEN CONCAT(TRIM(s.merged_wbs), '-', TRIM(REPLACE(TRIM(s.categories), '  ', ' '))) 
                ELSE NULL 
            END
        ) AS TEXT
    ) AS Merged_wbs_categories
FROM summary s;


-- =====================================================================
-- 2. VIEW: v_cj74_transformed
-- =====================================================================
CREATE OR REPLACE VIEW v_cj74_transformed AS 
SELECT 
    c.id AS id, c.year AS year, c.per AS per, c.cocd AS cocd, c.proj_def AS proj_def, 
    c.object_1 AS object_1, c.profit_ctr AS profit_ctr, c.name2 AS name2, c.tcurr AS tcurr, 
    c.value_trancurr AS value_trancurr, c.obcur AS obcur, c.val_in_obj_crcy AS val_in_obj_crcy, 
    c.val_in_rc AS val_in_rc, c.rcurr AS rcurr, c.cost_element AS cost_element, 
    c.cost_element_name AS cost_element_name, c.cost_element_descr AS cost_element_descr, 
    c.refdocno AS refdocno, c.document_no AS document_no, c.doc_date AS doc_date, 
    c.postg_date AS postg_date, c.offst_acct AS offst_acct, 
    c.name_of_offsetting_account AS name_of_offsetting_account, c.object_2 AS object_2, 
    c.material AS material, c.material_description AS material_description, c.name1 AS name1, 
    c.name22 AS name22, c.created_on AS created_on, c.frm AS frm, c.user_name AS user_name, 
    c.object_3 AS object_3, c.co_object_name AS co_object_name, c.pur_doc AS pur_doc, 
    c.quantity AS quantity, c.purchase_order_text AS purchase_order_text,
    
    -- Safe multi-replace for newlines and carriage returns
    TRIM(REPLACE(REPLACE(REPLACE(c.object_1, ' ', ''), CHR(10), ''), CHR(13), '')) AS single_wbs,
    
    (CAST(c.val_in_rc AS DECIMAL(15,2)) / 1000) AS ptd_val,
    
    -- LPAD logic: cast to integer then text to strip bad formats, catching empty strings gracefully
    TRIM(CONCAT(c.year, '-P', LPAD(CAST(NULLIF(TRIM(c.per), '') AS INTEGER)::TEXT, 3, '0'))) AS period,
    
    TRIM(w.loa_id) AS loa_id,
    TRIM(w.merged_wbs) AS merged_wbs,
    TRIM(w.wbs_type) AS wbs_type,
    TRIM(w.wbs_description) AS wbs_description,
    TRIM(REPLACE(cm.categories, '  ', ' ')) AS categories,
    TRIM(COALESCE(w.bu, s.bu)) AS bu,
    TRIM(COALESCE(w.customer, s.customer)) AS customer,
    TRIM(COALESCE(w.loa_name, s.loa_name)) AS loa_name,
    
    CAST(
        TRIM(CONCAT(COALESCE(TRIM(w.merged_wbs), ''), '-', COALESCE(TRIM(REPLACE(cm.categories, '  ', ' ')), ''))) AS TEXT
    ) AS Merged_wbs_categories 

FROM cj74_new c 
LEFT JOIN (
    SELECT 
        UPPER(TRIM(REPLACE(REPLACE(REPLACE(single_wbs, ' ', ''), CHR(10), ''), CHR(13), ''))) AS clean_single_wbs,
        MAX(bu) AS bu, MAX(customer) AS customer, MAX(loa_id) AS loa_id, 
        MAX(loa_name) AS loa_name, MAX(merged_wbs) AS merged_wbs, 
        MAX(wbs_type) AS wbs_type, MAX(wbs_description) AS wbs_description 
    FROM wbs_loa_id_mapping1 
    GROUP BY UPPER(TRIM(REPLACE(REPLACE(REPLACE(single_wbs, ' ', ''), CHR(10), ''), CHR(13), '')))
) w ON (UPPER(TRIM(REPLACE(REPLACE(REPLACE(c.object_1, ' ', ''), CHR(10), ''), CHR(13), ''))) = w.clean_single_wbs) 
LEFT JOIN (
    SELECT cost_element, MAX(categories) AS categories 
    FROM cost_mapping 
    GROUP BY cost_element
) cm ON (TRIM(c.cost_element) = TRIM(cm.cost_element)) 
LEFT JOIN summary s ON (TRIM(w.merged_wbs) = TRIM(s.merged_wbs));


-- =====================================================================
-- 3. VIEW: v_cji5_transformed
-- =====================================================================
CREATE OR REPLACE VIEW v_cji5_transformed AS 
SELECT 
    c.id AS id, c.project_def AS project_def, c.wbs_element AS wbs_element, c.refdocno AS refdocno, 
    c.item AS item, c.co_object_name AS co_object_name, c.supplier AS supplier, c.name AS name, 
    c.exch_rate AS exch_rate, c.year AS year, c.per AS per, c.cost_element AS cost_element, 
    c.cost_element_descr AS cost_element_descr, c.matl_group AS matl_group, c.material AS material, 
    c.description AS description, c.user_name AS user_name, c.docc AS docc, c.quantity AS quantity, 
    c.qty_plan AS qty_plan, c.debit_date AS debit_date, c.doc_date AS doc_date, c.cocode AS cocode, 
    c.report_currency AS report_currency, c.val_in_rep_cur AS val_in_rep_cur, c.tcurr AS tcurr, 
    c.value_tcur AS value_tcur, c.obj_curr AS obj_curr, c.value_in_obj_crcy AS value_in_obj_crcy,
    
    TRIM(c.wbs_element) AS single_wbs,
    (CAST(c.val_in_rep_cur AS DECIMAL(15,2)) / 1000) AS open_commitment_KEUR,
    
    TRIM(w.merged_wbs) AS merged_wbs,
    TRIM(w.loa_id) AS loa_id,
    TRIM(w.wbs_type) AS wbs_type,
    TRIM(w.wbs_description) AS wbs_description,
    TRIM(REPLACE(TRIM(cm.categories), '  ', ' ')) AS categories,
    
    CAST(
        TRIM(
            CASE 
                WHEN (TRIM(w.merged_wbs) <> '') AND (TRIM(cm.categories) <> '') 
                THEN CONCAT(TRIM(w.merged_wbs), '-', TRIM(REPLACE(TRIM(cm.categories), '  ', ' '))) 
                WHEN (TRIM(w.merged_wbs) <> '') THEN TRIM(w.merged_wbs) 
                WHEN (TRIM(cm.categories) <> '') THEN TRIM(REPLACE(TRIM(cm.categories), '  ', ' ')) 
                ELSE NULL 
            END
        ) AS TEXT
    ) AS Merged_wbs_categories 
    
FROM cji5_new c 
LEFT JOIN (
    SELECT 
        TRIM(single_wbs) AS single_wbs, MAX(merged_wbs) AS merged_wbs, 
        MAX(loa_id) AS loa_id, MAX(wbs_type) AS wbs_type, MAX(wbs_description) AS wbs_description 
    FROM wbs_loa_id_mapping1 
    GROUP BY TRIM(single_wbs)
) w ON (TRIM(c.wbs_element) = w.single_wbs) 
LEFT JOIN (
    SELECT 
        TRIM(cost_element) AS cost_element, MAX(categories) AS categories 
    FROM cost_mapping 
    GROUP BY TRIM(cost_element)
) cm ON (TRIM(c.cost_element) = cm.cost_element);


-- =====================================================================
-- 4. VIEW: final_dashboard (Depends on all views above)
-- =====================================================================
CREATE OR REPLACE VIEW final_dashboard AS 
WITH master_keys AS (
    SELECT Merged_wbs_categories FROM join_summary 
    UNION 
    SELECT Merged_wbs_categories FROM v_cj74_transformed 
    UNION 
    SELECT Merged_wbs_categories FROM v_cji5_transformed
) 
SELECT 
    COALESCE(s.id, CONCAT('NEW-', k.Merged_wbs_categories)) AS id,
    COALESCE(s.bu, cj.bu) AS bu,
    COALESCE(s.customer, cj.customer) AS customer,
    COALESCE(s.loa_id, cj.loa_id, ci.loa_id) AS loa_id,
    COALESCE(s.loa_name, cj.loa_name) AS loa_name,
    s.cost_revenue AS cost_revenue,
    s.categories AS categories,
    COALESCE(s.merged_wbs, cj.merged_wbs, ci.merged_wbs) AS merged_wbs,
    COALESCE(s.active_inactive, 'Active') AS active_inactive,
    
    COALESCE(s.asbl, 0) AS asbl,
    COALESCE(s.asbl_amc, 0) AS asbl_amc,
    COALESCE(s.asbl_project, 0) AS asbl_project,
    COALESCE(s.asbl_warranty, 0) AS asbl_warranty,
    COALESCE(s.asbl_loa, 0) AS asbl_loa,
    COALESCE(s.non_committed, 0) AS non_committed,
    COALESCE(s.non_committed_amc, 0) AS non_committed_amc,
    COALESCE(s.non_committed_project, 0) AS non_committed_project,
    COALESCE(s.non_committed_warranty, 0) AS non_committed_warranty,
    COALESCE(s.non_committed_editable, 0) AS non_committed_editable,
    COALESCE(s.non_committed_editable_amc, 0) AS non_committed_editable_amc,
    COALESCE(s.non_committed_editable_project, 0) AS non_committed_editable_project,
    COALESCE(s.non_committed_editable_warranty, 0) AS non_committed_editable_warranty,
    
    cj.period AS period,
    COALESCE(cj.ptd, 0) AS ptd,
    COALESCE(cj.single_wbs, ci.single_wbs) AS wbs_element_single,
    COALESCE(cj.wbs_type, ci.wbs_type) AS wbs_type,
    COALESCE(cj.wbs_description, ci.wbs_description) AS wbs_description,
    
    -- Window functions for dynamic open commitment check
    CASE 
        WHEN (ROW_NUMBER() OVER (PARTITION BY k.Merged_wbs_categories ORDER BY cj.period DESC) = 1) 
        THEN COALESCE(ci.total_oc, 0) 
        ELSE 0 
    END AS open_commitment_KEUR,
    
    (
        (COALESCE(cj.ptd, 0) + 
            CASE 
                WHEN (ROW_NUMBER() OVER (PARTITION BY k.Merged_wbs_categories ORDER BY cj.period DESC) = 1) 
                THEN COALESCE(ci.total_oc, 0) 
                ELSE 0 
            END
        ) + COALESCE(s.non_committed_editable, 0)
    ) AS eac,
    
    (
        COALESCE(s.asbl, 0) - (
            (COALESCE(cj.ptd, 0) + 
                CASE 
                    WHEN (ROW_NUMBER() OVER (PARTITION BY k.Merged_wbs_categories ORDER BY cj.period DESC) = 1) 
                    THEN COALESCE(ci.total_oc, 0) 
                    ELSE 0 
                END
            ) + COALESCE(s.non_committed_editable, 0)
        )
    ) AS eac_vs_asbl,
    
    k.Merged_wbs_categories AS Merged_wbs_categories,
    s.updated_by AS updated_by,
    s.updated_at AS updated_at 
    
FROM master_keys k 
LEFT JOIN join_summary s ON (k.Merged_wbs_categories = s.Merged_wbs_categories) 
LEFT JOIN (
    SELECT 
        Merged_wbs_categories, period, single_wbs, wbs_type, wbs_description, 
        bu, customer, loa_id, loa_name, merged_wbs, SUM(ptd_val) AS ptd 
    FROM v_cj74_transformed 
    GROUP BY Merged_wbs_categories, period, single_wbs, wbs_type, wbs_description, bu, customer, loa_id, loa_name, merged_wbs
) cj ON (k.Merged_wbs_categories = cj.Merged_wbs_categories) 
LEFT JOIN (
    SELECT 
        Merged_wbs_categories, single_wbs, wbs_type, wbs_description, 
        loa_id, merged_wbs, SUM(open_commitment_KEUR) AS total_oc 
    FROM v_cji5_transformed 
    GROUP BY Merged_wbs_categories, single_wbs, wbs_type, wbs_description, loa_id, merged_wbs
) ci ON (k.Merged_wbs_categories = ci.Merged_wbs_categories);