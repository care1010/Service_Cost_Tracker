-- ============================================================
-- DATABASE
-- ============================================================
CREATE DATABASE IF NOT EXISTS `testing_service_cost`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `testing_service_cost`;

-- ============================================================
-- 1. USERS
-- Who can log in to the system
-- ============================================================
CREATE TABLE `users` (
    `id`         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `email`      VARCHAR(255)    NOT NULL,
    `password`   VARCHAR(255)    NOT NULL,
    `type`       ENUM('admin','viewer','editor') NOT NULL DEFAULT 'viewer',
    `is_active`  TINYINT(1)      NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='System login users';

-- ============================================================
-- 2. CUSTOMER
-- Master list of customers
-- ============================================================
CREATE TABLE `customer` (
    `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `customer_name` VARCHAR(100)    NOT NULL,
    `is_active`     TINYINT(1)      NOT NULL DEFAULT 1,
    `created_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_customer_name` (`customer_name`),
    KEY `idx_customer_is_active` (`is_active`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Master customer list';

-- ============================================================
-- 3. ACCESS
-- Which customers each email can access
-- ============================================================
CREATE TABLE `access` (
    `id`         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `email`      VARCHAR(255)    NOT NULL,
    `customer`   VARCHAR(255)    NOT NULL,
    `created_at` TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_access_email`    (`email`),
    KEY `idx_access_customer` (`customer`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='User-to-customer access control';

-- ============================================================
-- 4. COST_MAPPING
-- Maps cost elements to categories
-- ============================================================
CREATE TABLE `cost_mapping` (
    `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `cost_element`          VARCHAR(100)    NOT NULL,
    `cost_element_name`     VARCHAR(255)    DEFAULT NULL,
    `cost_element_desc`     VARCHAR(500)    DEFAULT NULL,
    `cost_element_group_name` VARCHAR(255)  DEFAULT NULL,
    `category`              VARCHAR(100)    DEFAULT NULL,
    `categories`            VARCHAR(100)    DEFAULT NULL,
    `cost_revenue`          VARCHAR(50)     DEFAULT NULL,
    `created_at`            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_cost_element` (`cost_element`),        -- one row per cost element
    KEY `idx_cost_mapping_category`     (`category`),
    KEY `idx_cost_mapping_categories`   (`categories`),
    KEY `idx_cost_mapping_cost_revenue` (`cost_revenue`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Cost element to category mapping';

-- ============================================================
-- 5. WBS_LOA_ID_MAPPING1
-- Maps WBS codes to LOA/project identifiers
-- ============================================================
CREATE TABLE `wbs_loa_id_mapping1` (
    `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `bu`              VARCHAR(100)    DEFAULT NULL,
    `customer`        VARCHAR(255)    DEFAULT NULL,
    `loa_id`          VARCHAR(100)    DEFAULT NULL,
    `loa_name`        VARCHAR(255)    DEFAULT NULL,
    `wbs_type`        VARCHAR(100)    DEFAULT NULL,
    `single_wbs`      VARCHAR(255)    NOT NULL,             -- the raw WBS code from SAP
    `wbs_description` VARCHAR(768)    DEFAULT NULL,         -- moved from mediumtext
    `merged_wbs`      VARCHAR(768)    DEFAULT NULL,         -- moved from mediumtext
    `created_by`      VARCHAR(100)    DEFAULT NULL,
    `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_wbs_single_wbs`   (`single_wbs`),             -- main join column
    KEY `idx_wbs_merged_wbs`   (`merged_wbs`(255)),
    KEY `idx_wbs_loa_id`       (`loa_id`),
    KEY `idx_wbs_bu`           (`bu`),
    KEY `idx_wbs_customer`     (`customer`),
    KEY `idx_wbs_wbs_type`     (`wbs_type`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='WBS code to LOA ID mapping';

-- ============================================================
-- 6. CJ74_NEW
-- Main SAP cost journal (raw data, ~500k rows)
-- ============================================================
CREATE TABLE `cj74_new` (
    `id`                        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `year`                      SMALLINT        NOT NULL,                   -- 2020, 2024 etc
    `per`                       TINYINT UNSIGNED NOT NULL,                  -- 1-12 (period/month)
    `cocd`                      VARCHAR(10)     DEFAULT NULL,               -- company code
    `proj_def`                  VARCHAR(50)     DEFAULT NULL,
    `object_1`                  VARCHAR(255)    DEFAULT NULL,               -- raw WBS from SAP
    `profit_ctr`                VARCHAR(50)     DEFAULT NULL,
    `name2`                     VARCHAR(255)    DEFAULT NULL,
    `tcurr`                     VARCHAR(10)     DEFAULT NULL,               -- transaction currency (was TEXT!)
    `value_trancurr`            DECIMAL(18,2)   DEFAULT NULL,
    `obcur`                     VARCHAR(10)     DEFAULT NULL,
    `val_in_obj_crcy`           DECIMAL(18,2)   DEFAULT NULL,
    `val_in_rc`                 DECIMAL(18,2)   DEFAULT NULL,
    `rcurr`                     VARCHAR(10)     DEFAULT NULL,
    `cost_element`              VARCHAR(100)    DEFAULT NULL,
    `cost_element_name`         VARCHAR(255)    DEFAULT NULL,
    `cost_element_descr`        VARCHAR(255)    DEFAULT NULL,
    `refdocno`                  VARCHAR(100)    DEFAULT NULL,
    `document_no`               VARCHAR(100)    DEFAULT NULL,
    `doc_date`                  DATE            DEFAULT NULL,
    `postg_date`                DATE            DEFAULT NULL,
    `offst_acct`                VARCHAR(100)    DEFAULT NULL,
    `name_of_offsetting_account` VARCHAR(255)   DEFAULT NULL,
    `object_2`                  VARCHAR(255)    DEFAULT NULL,
    `material`                  VARCHAR(100)    DEFAULT NULL,
    `material_description`      VARCHAR(255)    DEFAULT NULL,
    `name1`                     VARCHAR(255)    DEFAULT NULL,
    `name22`                    VARCHAR(255)    DEFAULT NULL,
    `created_on`                DATE            DEFAULT NULL,
    `frm`                       VARCHAR(50)     DEFAULT NULL,
    `user_name`                 VARCHAR(100)    DEFAULT NULL,
    `object_3`                  VARCHAR(255)    DEFAULT NULL,
    `co_object_name`            VARCHAR(255)    DEFAULT NULL,
    `pur_doc`                   VARCHAR(100)    DEFAULT NULL,
    `quantity`                  DECIMAL(18,3)   DEFAULT NULL,
    `purchase_order_text`       VARCHAR(255)    DEFAULT NULL,
    `upload_at`                 TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    -- 🔥 These 2 indexes fix your 504 timeout on the view
    KEY `idx_cj74_object_1`     (`object_1`),   -- used in JOIN with wbs_loa_id_mapping1
    KEY `idx_cj74_cost_element` (`cost_element`), -- used in JOIN with cost_mapping
    KEY `idx_cj74_year_per`     (`year`, `per`), -- used in WHERE/GROUP BY for period filters
    KEY `idx_cj74_postg_date`   (`postg_date`),  -- used in date range filters
    KEY `idx_cj74_proj_def`     (`proj_def`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='SAP CJ74 raw cost journal data';

-- ============================================================
-- 7. CJI5_NEW
-- SAP CJI5 open commitments raw data
-- ============================================================
CREATE TABLE `cji5_new` (
    `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `project_def`       VARCHAR(255)    DEFAULT NULL,
    `wbs_element`       VARCHAR(255)    DEFAULT NULL,
    `refdocno`          VARCHAR(100)    DEFAULT NULL,
    `item`              VARCHAR(50)     DEFAULT NULL,
    `co_object_name`    VARCHAR(255)    DEFAULT NULL,
    `supplier`          VARCHAR(255)    DEFAULT NULL,
    `name`              VARCHAR(255)    DEFAULT NULL,
    `exch_rate`         DECIMAL(18,6)   DEFAULT NULL,
    `year`              SMALLINT        DEFAULT NULL,
    `per`               TINYINT UNSIGNED DEFAULT NULL,
    `cost_element`      VARCHAR(100)    DEFAULT NULL,
    `cost_element_descr` VARCHAR(255)   DEFAULT NULL,
    `matl_group`        VARCHAR(50)     DEFAULT NULL,
    `material`          VARCHAR(100)    DEFAULT NULL,
    `description`       VARCHAR(255)    DEFAULT NULL,
    `user_name`         VARCHAR(100)    DEFAULT NULL,
    `docc`              VARCHAR(100)    DEFAULT NULL,
    `quantity`          DECIMAL(18,3)   DEFAULT NULL,
    `qty_plan`          DECIMAL(18,3)   DEFAULT NULL,
    `debit_date`        DATE            DEFAULT NULL,
    `doc_date`          DATE            DEFAULT NULL,
    `cocode`            VARCHAR(10)     DEFAULT NULL,
    `report_currency`   VARCHAR(10)     DEFAULT NULL,
    `val_in_rep_cur`    DECIMAL(18,2)   DEFAULT NULL,
    `tcurr`             VARCHAR(10)     DEFAULT NULL,   -- was TEXT!
    `value_tcur`        DECIMAL(18,2)   DEFAULT NULL,
    `obj_curr`          VARCHAR(10)     DEFAULT NULL,
    `value_in_obj_crcy` DECIMAL(18,2)  DEFAULT NULL,
    `upload_at`         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_cji5_wbs_element`  (`wbs_element`),
    KEY `idx_cji5_cost_element` (`cost_element`),
    KEY `idx_cji5_year_per`     (`year`, `per`),
    KEY `idx_cji5_doc_date`     (`doc_date`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='SAP CJI5 open commitment raw data';

-- ============================================================
-- 8. SUMMARY
-- Manually editable budget/forecast data per WBS+category
-- ============================================================
CREATE TABLE `summary` (
    `id`                          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `bu`                          VARCHAR(100)    DEFAULT NULL,
    `customer`                    VARCHAR(255)    DEFAULT NULL,
    `loa_id`                      VARCHAR(100)    DEFAULT NULL,
    `loa_name`                    VARCHAR(255)    DEFAULT NULL,
    `merged_wbs`                  VARCHAR(768)    DEFAULT NULL,
    `wbs_type`                    VARCHAR(100)    DEFAULT NULL,
    `cost_revenue`                VARCHAR(50)     DEFAULT NULL,
    `categories`                  VARCHAR(100)    DEFAULT NULL,
    `merged_wbs_categories`       VARCHAR(500)    DEFAULT NULL,   -- normalized name
    `active_inactive`             ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    -- Budget columns
    `asbl`                        DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `asbl_amc`                    DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `asbl_project`                DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `asbl_warranty`               DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `asbl_loa`                    DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    -- Actuals
    `ptd`                         DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `open_commitment_keur`        DECIMAL(15,3)   NOT NULL DEFAULT 0.000,  -- normalized case
    -- Non-committed
    `non_committed`               DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `non_committed_amc`           DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `non_committed_project`       DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `non_committed_warranty`      DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `non_committed_editable`      DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `non_committed_editable_amc`  DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `non_committed_editable_project` DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    `non_committed_editable_warranty` DECIMAL(15,3) NOT NULL DEFAULT 0.000,
    -- EAC
    `eac`                         DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    `eac_vs_asbl`                 DECIMAL(15,3)   NOT NULL DEFAULT 0.000,
    -- Audit
    `updated_by`                  VARCHAR(255)    DEFAULT NULL,
    `updated_at`                  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `created_at`                  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_summary_loa_id`                (`loa_id`),
    KEY `idx_summary_merged_wbs`            (`merged_wbs`(255)),
    KEY `idx_summary_merged_wbs_categories` (`merged_wbs_categories`(255)),
    KEY `idx_summary_loa_categories`        (`loa_id`, `categories`),
    KEY `idx_summary_active`                (`active_inactive`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Budget, forecast and editable non-committed values per WBS+category';

-- ============================================================
-- 9. FINAL_DASHBOARD_TABLE
-- Denormalized output table for dashboard rendering
-- ============================================================
CREATE TABLE `final_dashboard_table` (
    `id`                              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `bu`                              VARCHAR(100)    DEFAULT NULL,
    `customer`                        VARCHAR(255)    DEFAULT NULL,
    `loa_id`                          VARCHAR(100)    DEFAULT NULL,
    `loa_name`                        VARCHAR(255)    DEFAULT NULL,
    `cost_revenue`                    VARCHAR(100)    DEFAULT NULL,
    `categories`                      VARCHAR(100)    DEFAULT NULL,
    `merged_wbs`                      VARCHAR(768)    DEFAULT NULL,
    `wbs_element_single`              VARCHAR(255)    DEFAULT NULL,
    `wbs_type`                        VARCHAR(100)    DEFAULT NULL,
    `wbs_description`                 VARCHAR(768)    DEFAULT NULL,
    `active_inactive`                 ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    `period`                          VARCHAR(20)     DEFAULT NULL,   -- e.g. 2024-P001
    -- Budget
    `asbl`                            DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `asbl_amc`                        DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `asbl_project`                    DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `asbl_warranty`                   DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `asbl_loa`                        DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    -- Actuals
    `ptd`                             DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `open_commitment_keur`            DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    -- Non-committed
    `non_committed`                   DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `non_committed_amc`               DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `non_committed_project`           DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `non_committed_warranty`          DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `non_committed_editable`          DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `non_committed_editable_amc`      DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `non_committed_editable_project`  DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    `non_committed_editable_warranty` DECIMAL(15,2)   NOT NULL DEFAULT 0.00,
    -- EAC
    `eac`                             DECIMAL(20,3)   NOT NULL DEFAULT 0.000,
    `eac_vs_asbl`                     DECIMAL(20,3)   NOT NULL DEFAULT 0.000,
    -- Composite key
    `merged_wbs_categories`           VARCHAR(500)    DEFAULT NULL,
    -- Audit
    `updated_by`                      VARCHAR(100)    DEFAULT NULL,
    `updated_at`                      DATETIME        DEFAULT NULL,
    `created_at`                      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_fdt_bu`                      (`bu`),
    KEY `idx_fdt_loa_id`                  (`loa_id`),
    KEY `idx_fdt_customer`                (`customer`),
    KEY `idx_fdt_period`                  (`period`),
    KEY `idx_fdt_merged_wbs_categories`   (`merged_wbs_categories`(255)),
    KEY `idx_fdt_active`                  (`active_inactive`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Denormalized dashboard output table, refreshed periodically';

-- ============================================================
-- 10. STG_MASTER_MAPPING
-- Staging: pre-joined WBS + cost element mapping
-- ============================================================
CREATE TABLE `stg_master_mapping` (
    `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `single_wbs`            VARCHAR(255)    DEFAULT NULL,
    `bu`                    VARCHAR(100)    DEFAULT NULL,
    `customer`              VARCHAR(255)    DEFAULT NULL,
    `loa_id`                VARCHAR(100)    DEFAULT NULL,
    `loa_name`              VARCHAR(255)    DEFAULT NULL,
    `merged_wbs`            VARCHAR(768)    DEFAULT NULL,
    `wbs_type`              VARCHAR(100)    DEFAULT NULL,
    `wbs_description`       VARCHAR(768)    DEFAULT NULL,
    `cost_element`          VARCHAR(100)    DEFAULT NULL,
    `categories`            VARCHAR(100)    DEFAULT NULL,
    `mapped_cost_revenue`   VARCHAR(50)     DEFAULT NULL,
    `merged_wbs_categories` VARCHAR(500)    DEFAULT NULL,
    `created_at`            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_stg_mm_single_wbs`             (`single_wbs`),
    KEY `idx_stg_mm_cost_element`           (`cost_element`),
    KEY `idx_stg_mm_loa_id`                (`loa_id`),
    KEY `idx_stg_mm_merged_wbs_categories`  (`merged_wbs_categories`(255))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Staging: pre-computed WBS + cost element cross mapping';

-- ============================================================
-- 11. STG_CJ74_AGG
-- Staging: aggregated CJ74 PTD values per WBS+cost+period
-- ============================================================
CREATE TABLE `stg_cj74_agg` (
    `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `clean_wbs`    VARCHAR(255)    NOT NULL,
    `cost_element` VARCHAR(100)    NOT NULL,
    `period`       VARCHAR(16)     NOT NULL,   -- e.g. 2024-P001
    `ptd_val`      DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
    `created_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_stg_cj74_wbs_cost_period` (`clean_wbs`, `cost_element`, `period`),
    KEY `idx_stg_cj74_clean_wbs`    (`clean_wbs`),
    KEY `idx_stg_cj74_cost_element` (`cost_element`),
    KEY `idx_stg_cj74_period`       (`period`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Staging: aggregated PTD values from CJ74 per WBS+cost_element+period';

-- ============================================================
-- 12. STG_CJI5_AGG
-- Staging: aggregated CJI5 open commitment values per WBS+cost
-- ============================================================
CREATE TABLE `stg_cji5_agg` (
    `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `clean_wbs`    VARCHAR(255)    NOT NULL,
    `cost_element` VARCHAR(100)    NOT NULL,
    `oc_val`       DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
    `created_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_stg_cji5_wbs_cost` (`clean_wbs`, `cost_element`),
    KEY `idx_stg_cji5_clean_wbs`    (`clean_wbs`),
    KEY `idx_stg_cji5_cost_element` (`cost_element`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Staging: aggregated open commitment values from CJI5 per WBS+cost_element';

-- ============================================================
-- 13. T_CJ74_TRANSFORMED
-- Transformed/enriched CJ74 with WBS + category info attached
-- ============================================================
CREATE TABLE `t_cj74_transformed` (
    `id`                        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `sap_wbs`                   VARCHAR(255)    DEFAULT NULL,
    `year`                      SMALLINT        DEFAULT NULL,
    `per`                       TINYINT UNSIGNED DEFAULT NULL,
    `cost_element`              VARCHAR(100)    DEFAULT NULL,
    `cost_element_name`         VARCHAR(255)    DEFAULT NULL,
    `ptd_val`                   DECIMAL(18,6)   DEFAULT NULL,
    `period`                    VARCHAR(20)     DEFAULT NULL,
    `cocd`                      VARCHAR(10)     DEFAULT NULL,
    `proj_def`                  VARCHAR(50)     DEFAULT NULL,
    `profit_ctr`                VARCHAR(50)     DEFAULT NULL,
    `name2`                     VARCHAR(255)    DEFAULT NULL,
    `tcurr`                     VARCHAR(10)     DEFAULT NULL,
    `value_trancurr`            DECIMAL(18,2)   DEFAULT NULL,
    `obcur`                     VARCHAR(10)     DEFAULT NULL,
    `val_in_obj_crcy`           DECIMAL(18,2)   DEFAULT NULL,
    `val_in_rc`                 DECIMAL(18,2)   DEFAULT NULL,
    `rcurr`                     VARCHAR(10)     DEFAULT NULL,
    `cost_element_descr`        VARCHAR(255)    DEFAULT NULL,
    `refdocno`                  VARCHAR(100)    DEFAULT NULL,
    `document_no`               VARCHAR(100)    DEFAULT NULL,
    `doc_date`                  DATE            DEFAULT NULL,
    `postg_date`                DATE            DEFAULT NULL,
    `offst_acct`                VARCHAR(100)    DEFAULT NULL,
    `name_of_offsetting_account` VARCHAR(255)   DEFAULT NULL,
    `material`                  VARCHAR(100)    DEFAULT NULL,
    `material_description`      VARCHAR(255)    DEFAULT NULL,
    `name1`                     VARCHAR(255)    DEFAULT NULL,
    `name22`                    VARCHAR(255)    DEFAULT NULL,
    `created_on`                DATE            DEFAULT NULL,
    `origin_form`               VARCHAR(50)     DEFAULT NULL,
    `user_name`                 VARCHAR(100)    DEFAULT NULL,
    `pur_doc`                   VARCHAR(100)    DEFAULT NULL,
    `quantity`                  DECIMAL(18,3)   DEFAULT NULL,
    `purchase_order_text`       VARCHAR(255)    DEFAULT NULL,
    `loa_id`                    VARCHAR(100)    DEFAULT NULL,
    `wbs_string`                VARCHAR(768)    DEFAULT NULL,   -- was TEXT
    `wbs_type`                  VARCHAR(100)    DEFAULT NULL,
    `wbs_description`           TEXT    DEFAULT NULL,
    `categories`                VARCHAR(255)    DEFAULT NULL,
    `cost_revenue`              VARCHAR(255)    DEFAULT NULL,
    `created_at`                TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_t_cj74_sap_wbs`       (`sap_wbs`),
    KEY `idx_t_cj74_cost_element`  (`cost_element`),
    KEY `idx_t_cj74_period`        (`period`),
    KEY `idx_t_cj74_loa_id`        (`loa_id`),
    KEY `idx_t_cj74_year_per`      (`year`, `per`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Transformed CJ74 with WBS mapping and category info joined';

-- ============================================================
-- 14. T_CJI5_TRANSFORMED
-- Transformed/enriched CJI5 with LOA + category info
-- ============================================================
CREATE TABLE `t_cji5_transformed` (
    `id`                INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `project_def`       VARCHAR(255)    DEFAULT NULL,
    `sap_wbs`           VARCHAR(255)    DEFAULT NULL,
    `refdocno`          VARCHAR(255)    DEFAULT NULL,
    `item`              VARCHAR(255)     DEFAULT NULL,
    `co_object_name`    VARCHAR(255)    DEFAULT NULL,
    `supplier`          VARCHAR(255)    DEFAULT NULL,
    `name`              VARCHAR(255)    DEFAULT NULL,
    `exch_rate`         DECIMAL(18,6)   DEFAULT NULL,
    `year`              VARCHAR(255)        DEFAULT NULL,
    `per`               VARCHAR(255) DEFAULT NULL,
    `cost_element`      VARCHAR(255)    DEFAULT NULL,
    `cost_element_descr` VARCHAR(255)   DEFAULT NULL,
    `matl_group`        VARCHAR(255)     DEFAULT NULL,
    `material`          VARCHAR(255)    DEFAULT NULL,
    `description`       VARCHAR(255)    DEFAULT NULL,
    `user_name`         VARCHAR(255)    DEFAULT NULL,
    `docc`              VARCHAR(255)    DEFAULT NULL,
    `quantity`          DECIMAL(18,3)   DEFAULT NULL,
    `qty_plan`          DECIMAL(18,3)   DEFAULT NULL,
    `debit_date`        DATE            DEFAULT NULL,
    `doc_date`          DATE            DEFAULT NULL,
    `cocode`            VARCHAR(255)     DEFAULT NULL,
    `report_currency`   VARCHAR(255)     DEFAULT NULL,
    `val_in_rep_cur`    DECIMAL(18,2)   DEFAULT NULL,
    `tcurr`             VARCHAR(255)     DEFAULT NULL,
    `value_tcur`        DECIMAL(18,2)   DEFAULT NULL,
    `obj_curr`          VARCHAR(255)     DEFAULT NULL,
    `value_in_obj_crcy` DECIMAL(18,2)  DEFAULT NULL,
    `oc_val`            DECIMAL(18,6)   DEFAULT NULL,
    `loa_id`            VARCHAR(255)    DEFAULT NULL,
    `wbs_type`          VARCHAR(255)    DEFAULT NULL,
    `categories`        VARCHAR(255)    DEFAULT NULL,
    `created_at`        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_t_cji5_sap_wbs`      (`sap_wbs`),
    KEY `idx_t_cji5_cost_element` (`cost_element`),
    KEY `idx_t_cji5_loa_id`       (`loa_id`),
    KEY `idx_t_cji5_year_per`     (`year`, `per`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Transformed CJI5 with LOA mapping and category info joined';

-- ============================================================
-- 15. ERP_RESOURCE
-- Resource time tracking from ERP system
-- ============================================================
CREATE TABLE `erp_resource` (
    `id`                                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `tr_global_period`                    VARCHAR(255)     DEFAULT NULL,
    `lm_nokia_id_name`                    VARCHAR(255)    DEFAULT NULL,
    `home_country`                        VARCHAR(255)    DEFAULT NULL,
    `resource_erp_type`                   VARCHAR(255)    DEFAULT NULL,
    `resource_person_number`              VARCHAR(255)     DEFAULT NULL,
    `resource_nokia_id_name`              VARCHAR(255)    DEFAULT NULL,
    `time_entry_date`                     DATE            DEFAULT NULL,
    `recorded_hours`                      DECIMAL(5,2)    DEFAULT NULL,
    `time_entry_status`                   VARCHAR(255)     DEFAULT NULL,
    `daily_working_hours`                 DECIMAL(5,2)    DEFAULT NULL,
    `tr_wbs_care_contract_opp`            VARCHAR(255)    DEFAULT NULL,
    `tr_wbs_care_contract_opp_description` TEXT           DEFAULT NULL,
    `svo_id`                              VARCHAR(255)    DEFAULT NULL,
    `svo_description`                     TEXT            DEFAULT NULL,
    `gic`                                 VARCHAR(255)    DEFAULT NULL,
    `gic_name`                            VARCHAR(255)    DEFAULT NULL,
    `customer_team`                       VARCHAR(255)    DEFAULT NULL,
    `time_approval_date`                  DATE            DEFAULT NULL,
    `lm_email`                            VARCHAR(255)    DEFAULT NULL,
    `resource_email`                      VARCHAR(255)    DEFAULT NULL,
    `month`                               VARCHAR(255)     DEFAULT NULL,
    `created_by`                          VARCHAR(255)    DEFAULT NULL,
    `upload_date`                         DATETIME        DEFAULT CURRENT_TIMESTAMP,
    `created_at`                          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_erp_tr_global_period`              (`tr_global_period`),
    KEY `idx_erp_resource_person_number`        (`resource_person_number`),
    KEY `idx_erp_time_entry_status`             (`time_entry_status`),
    KEY `idx_erp_tr_wbs_care_contract_opp`      (`tr_wbs_care_contract_opp`),
    KEY `idx_erp_svo_id`                        (`svo_id`),
    KEY `idx_erp_gic`                           (`gic`),
    KEY `idx_erp_lm_email`                      (`lm_email`),
    KEY `idx_erp_resource_email`                (`resource_email`),
    KEY `idx_erp_month`                         (`month`),
    KEY `idx_erp_time_entry_date`               (`time_entry_date`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='ERP resource time entry data';

-- ============================================================
-- 16. USER_ACTIVITY_LOGS
-- Audit trail of user edits on non_committed values
-- ============================================================
CREATE TABLE `user_activity_logs` (
    `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `user_email`      VARCHAR(255)    NOT NULL,
    `bu`              VARCHAR(255)     DEFAULT NULL,
    `customer`        VARCHAR(255)    DEFAULT NULL,
    `loa_name`        VARCHAR(255)    DEFAULT NULL,
    `loa_id`          VARCHAR(255)     DEFAULT NULL,
    `categories`      VARCHAR(255)    DEFAULT NULL,
    `wbs_type`        VARCHAR(255)    DEFAULT NULL,
    `active_inactive` VARCHAR(255)     DEFAULT NULL,
    `old_value`       DECIMAL(18,2)   DEFAULT NULL,
    `new_value`       DECIMAL(18,2)   DEFAULT NULL,
    `month_year`      VARCHAR(255)     DEFAULT NULL,
    `created_at`      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_ual_user_email`  (`user_email`),
    KEY `idx_ual_loa_id`      (`loa_id`),
    KEY `idx_ual_created_at`  (`created_at`)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Audit log of all user edits to non-committed values';

-- ============================================================
-- 17. TEMP
-- Temporary edits holding table (in-session changes)
-- ============================================================
CREATE TABLE `temp` (
    `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `user_id`               INT UNSIGNED    NOT NULL,
    `row_id`                VARCHAR(255)    NOT NULL,
    `non_committed`         DECIMAL(10,2)   DEFAULT NULL,
    `original_non_committed` DECIMAL(10,2)  DEFAULT NULL,
    `created_at`            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_temp_user_id` (`user_id`),
    KEY `idx_temp_row_id`  (`row_id`(255))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci
  COMMENT='Temporary table for holding unsaved user edits';










-- ============================================================
-- VIEWS
-- ============================================================
CREATE OR REPLACE VIEW `testing_service_cost`.`v_cj74_transformed` AS
WITH clean_wbs AS (
    -- De-duplicate WBS mapping once
    SELECT
        UCASE(TRIM(REPLACE(REPLACE(REPLACE(single_wbs, ' ', ''), '\n', ''), '\r', ''))) AS clean_single_wbs,
        MAX(bu)              AS bu,
        MAX(customer)        AS customer,
        MAX(loa_id)          AS loa_id,
        MAX(loa_name)        AS loa_name,
        MAX(merged_wbs)      AS merged_wbs,
        MAX(wbs_type)        AS wbs_type,
        MAX(wbs_description) AS wbs_description
    FROM `testing_service_cost`.`wbs_loa_id_mapping1`
    GROUP BY UCASE(TRIM(REPLACE(REPLACE(REPLACE(single_wbs, ' ', ''), '\n', ''), '\r', '')))
),
clean_cost AS (
    -- De-duplicate cost mapping once
    SELECT
        TRIM(cost_element)              AS cost_element,
        MAX(TRIM(categories))           AS categories,
        MAX(TRIM(cost_revenue))         AS cost_revenue
    FROM `testing_service_cost`.`cost_mapping`
    GROUP BY TRIM(cost_element)
)

SELECT
    -- WBS identifier (cleaned)
    TRIM(REPLACE(REPLACE(REPLACE(c.object_1, ' ', ''), '\n', ''), '\r', ''))    AS single_wbs,

    -- Period info
    TRIM(c.year)                                                                 AS year,
    TRIM(c.per)                                                                  AS per,
    TRIM(CONCAT(c.year, '-P', LPAD(CAST(c.per AS UNSIGNED), 3, '0')))           AS period,

    -- Cost element
    TRIM(c.cost_element)                                                         AS cost_element,
    TRIM(c.cost_element_name)                                                    AS cost_element_name,
    TRIM(c.cost_element_descr)                                                   AS cost_element_descr,

    -- PTD value in thousands
    CAST(c.val_in_rc AS DECIMAL(15,2)) / 1000                                   AS ptd_val,

    -- Company / project
    TRIM(c.cocd)                                                                 AS cocd,
    TRIM(c.proj_def)                                                             AS proj_def,
    TRIM(c.profit_ctr)                                                           AS profit_ctr,
    TRIM(c.name2)                                                                AS name2,

    -- Currency
    TRIM(c.tcurr)                                                                AS tcurr,
    c.value_trancurr                                                             AS value_trancurr,
    TRIM(c.obcur)                                                                AS obcur,
    c.val_in_obj_crcy                                                            AS val_in_obj_crcy,
    c.val_in_rc                                                                  AS val_in_rc,
    TRIM(c.rcurr)                                                                AS rcurr,

    -- Document info
    TRIM(c.refdocno)                                                             AS refdocno,
    TRIM(c.document_no)                                                          AS document_no,
    c.doc_date                                                                   AS doc_date,
    c.postg_date                                                                 AS postg_date,

    -- Offset account
    TRIM(c.offst_acct)                                                           AS offst_acct,
    TRIM(c.name_of_offsetting_account)                                           AS name_of_offsetting_account,

    -- Material
    TRIM(c.material)                                                             AS material,
    TRIM(c.material_description)                                                 AS material_description,

    -- Vendor names
    TRIM(c.name1)                                                                AS name1,
    TRIM(c.name22)                                                               AS name22,

    -- Misc
    c.created_on                                                                 AS created_on,
    TRIM(c.frm)                                                                  AS origin_form,
    TRIM(c.user_name)                                                            AS user_name,
    TRIM(c.pur_doc)                                                              AS pur_doc,
    c.quantity                                                                   AS quantity,
    TRIM(c.purchase_order_text)                                                  AS purchase_order_text,

    -- From WBS mapping
    TRIM(w.loa_id)                                                               AS loa_id,
    TRIM(w.bu)                                                                   AS bu,
    TRIM(w.customer)                                                             AS customer,
    TRIM(w.loa_name)                                                             AS loa_name,
    TRIM(w.merged_wbs)                                                           AS merged_wbs,
    TRIM(w.wbs_type)                                                             AS wbs_type,
    TRIM(w.wbs_description)                                                      AS wbs_description,

    -- From cost mapping
    TRIM(REPLACE(cm.categories, '  ', ' '))                                      AS categories,
    TRIM(cm.cost_revenue)                                                        AS cost_revenue,

    -- 🔑 Composite key — HYPHEN separator (consistent with join_summary & v_cji5)
    CONVERT(
        CONCAT(
            IFNULL(TRIM(w.merged_wbs), ''),
            '-',
            IFNULL(TRIM(REPLACE(cm.categories, '  ', ' ')), '')
        )
        USING utf8mb4
    )                                                                            AS Merged_wbs_categories

FROM `testing_service_cost`.`cj74_new` c

LEFT JOIN clean_wbs w
    ON UCASE(TRIM(REPLACE(REPLACE(REPLACE(c.object_1, ' ', ''), '\n', ''), '\r', ''))) = w.clean_single_wbs

LEFT JOIN clean_cost cm
    ON TRIM(c.cost_element) = cm.cost_element;


CREATE OR REPLACE VIEW `testing_service_cost`.`v_cji5_transformed` AS

WITH clean_wbs AS (
    -- Same UCASE logic as v_cj74 for consistency
    SELECT
        UCASE(TRIM(REPLACE(REPLACE(REPLACE(single_wbs, ' ', ''), '\n', ''), '\r', ''))) AS clean_single_wbs,
        MAX(bu)              AS bu,
        MAX(customer)        AS customer,
        MAX(loa_id)          AS loa_id,
        MAX(loa_name)        AS loa_name,
        MAX(merged_wbs)      AS merged_wbs,
        MAX(wbs_type)        AS wbs_type,
        MAX(wbs_description) AS wbs_description
    FROM `testing_service_cost`.`wbs_loa_id_mapping1`
    GROUP BY UCASE(TRIM(REPLACE(REPLACE(REPLACE(single_wbs, ' ', ''), '\n', ''), '\r', '')))
),
clean_cost AS (
    SELECT
        TRIM(cost_element)              AS cost_element,
        MAX(TRIM(categories))           AS categories,
        MAX(TRIM(cost_revenue))         AS cost_revenue
    FROM `testing_service_cost`.`cost_mapping`
    GROUP BY TRIM(cost_element)
)

SELECT
    -- WBS identifier
    TRIM(c.wbs_element)                                                          AS single_wbs,

    -- Open commitment value in thousands
    CAST(c.val_in_rep_cur AS DECIMAL(15,2)) / 1000                              AS open_commitment_KEUR,

    -- From WBS mapping
    TRIM(w.loa_id)                                                               AS loa_id,
    TRIM(w.bu)                                                                   AS bu,
    TRIM(w.customer)                                                             AS customer,
    TRIM(w.loa_name)                                                             AS loa_name,
    TRIM(w.merged_wbs)                                                           AS merged_wbs,
    TRIM(w.wbs_type)                                                             AS wbs_type,
    TRIM(w.wbs_description)                                                      AS wbs_description,

    -- From cost mapping
    TRIM(REPLACE(cm.categories, '  ', ' '))                                      AS categories,
    TRIM(cm.cost_revenue)                                                        AS cost_revenue,

    -- 🔑 Composite key — HYPHEN separator (consistent with v_cj74 & join_summary)
    CONVERT(
        CONCAT(
            IFNULL(TRIM(w.merged_wbs), ''),
            '-',
            IFNULL(TRIM(REPLACE(cm.categories, '  ', ' ')), '')
        )
        USING utf8mb4
    )                                                                            AS Merged_wbs_categories

FROM `testing_service_cost`.`cji5_new` c

LEFT JOIN clean_wbs w
    ON UCASE(TRIM(REPLACE(REPLACE(REPLACE(c.wbs_element, ' ', ''), '\n', ''), '\r', ''))) = w.clean_single_wbs

LEFT JOIN clean_cost cm
    ON TRIM(c.cost_element) = cm.cost_element;





CREATE OR REPLACE VIEW `testing_service_cost`.`join_summary` AS

SELECT
    TRIM(s.id)                                          AS id,
    TRIM(s.bu)                                          AS bu,
    TRIM(s.customer)                                    AS customer,
    TRIM(s.loa_id)                                      AS loa_id,
    TRIM(s.loa_name)                                    AS loa_name,
    TRIM(s.cost_revenue)                                AS cost_revenue,
    TRIM(REPLACE(TRIM(s.categories), '  ', ' '))        AS categories,
    TRIM(s.merged_wbs)                                  AS merged_wbs,
    TRIM(s.active_inactive)                             AS active_inactive,

    -- Budget columns
    IFNULL(s.asbl, 0)                                   AS asbl,
    IFNULL(s.asbl_amc, 0)                               AS asbl_amc,
    IFNULL(s.asbl_project, 0)                           AS asbl_project,
    IFNULL(s.asbl_warranty, 0)                          AS asbl_warranty,
    IFNULL(s.asbl_loa, 0)                               AS asbl_loa,

    -- Non-committed columns
    IFNULL(s.non_committed, 0)                          AS non_committed,
    IFNULL(s.non_committed_amc, 0)                      AS non_committed_amc,
    IFNULL(s.non_committed_project, 0)                  AS non_committed_project,
    IFNULL(s.non_committed_warranty, 0)                 AS non_committed_warranty,
    IFNULL(s.non_committed_editable, 0)                 AS non_committed_editable,
    IFNULL(s.non_committed_editable_amc, 0)             AS non_committed_editable_amc,
    IFNULL(s.non_committed_editable_project, 0)         AS non_committed_editable_project,
    IFNULL(s.non_committed_editable_warranty, 0)        AS non_committed_editable_warranty,

    -- Old values (kept for backward compatibility)
    TRIM(s.ptd)                                         AS ptd_old,
    TRIM(s.open_commitment_KEUR)                        AS oc_old,

    -- Audit
    TRIM(s.updated_by)                                  AS updated_by,
    TRIM(s.updated_at)                                  AS updated_at,

    -- 🔑 Composite key — prefer stored value, fallback to built value
    CONVERT(
        COALESCE(
            NULLIF(TRIM(s.Merged_wbs_category), ''),
            CASE
                WHEN TRIM(s.merged_wbs) != '' AND TRIM(s.categories) != ''
                THEN CONCAT(
                        TRIM(s.merged_wbs),
                        '-',
                        TRIM(REPLACE(TRIM(s.categories), '  ', ' '))
                     )
                ELSE NULL
            END
        )
        USING utf8mb4
    )                                                   AS Merged_wbs_categories

FROM `testing_service_cost`.`summary` s;




CREATE OR REPLACE VIEW `testing_service_cost`.`final_dashboard` AS

-- Step 1: All unique Merged_wbs_categories keys from all 3 sources
WITH master_keys AS (
    SELECT Merged_wbs_categories FROM `testing_service_cost`.`join_summary`
    UNION  -- UNION removes duplicates automatically
    SELECT Merged_wbs_categories FROM `testing_service_cost`.`v_cj74_transformed`
    UNION
    SELECT Merged_wbs_categories FROM `testing_service_cost`.`v_cji5_transformed`
),

-- Step 2: Aggregate CJ74 PTD per key+period
cj_agg AS (
    SELECT
        Merged_wbs_categories,
        period,
        MAX(single_wbs)       AS single_wbs,
        MAX(wbs_type)         AS wbs_type,
        MAX(wbs_description)  AS wbs_description,
        MAX(bu)               AS bu,
        MAX(customer)         AS customer,
        MAX(loa_id)           AS loa_id,
        MAX(loa_name)         AS loa_name,
        MAX(merged_wbs)       AS merged_wbs,
        SUM(ptd_val)          AS ptd
    FROM `testing_service_cost`.`v_cj74_transformed`
    GROUP BY Merged_wbs_categories, period
),

-- Step 3: Aggregate CJI5 open commitment per key
ci_agg AS (
    SELECT
        Merged_wbs_categories,
        MAX(single_wbs)       AS single_wbs,
        MAX(wbs_type)         AS wbs_type,
        MAX(wbs_description)  AS wbs_description,
        MAX(loa_id)           AS loa_id,
        MAX(merged_wbs)       AS merged_wbs,
        SUM(open_commitment_KEUR) AS total_oc
    FROM `testing_service_cost`.`v_cji5_transformed`
    GROUP BY Merged_wbs_categories
),

-- Step 4: Rank periods per key — latest period gets open_commitment
ranked AS (
    SELECT
        k.Merged_wbs_categories,
        cj.period,
        cj.single_wbs,
        cj.wbs_type,
        cj.wbs_description,
        cj.bu,
        cj.customer,
        cj.loa_id,
        cj.loa_name,
        cj.merged_wbs,
        cj.ptd,
        ROW_NUMBER() OVER (
            PARTITION BY k.Merged_wbs_categories
            ORDER BY cj.period DESC
        ) AS rn
    FROM master_keys k
    LEFT JOIN cj_agg cj ON k.Merged_wbs_categories = cj.Merged_wbs_categories
)

-- Step 5: Final SELECT
SELECT
    COALESCE(s.id, CONCAT('NEW-', k.Merged_wbs_categories))     AS id,
    COALESCE(s.bu, r.bu)                                         AS bu,
    COALESCE(s.customer, r.customer)                             AS customer,
    COALESCE(s.loa_id, r.loa_id, ci.loa_id)                     AS loa_id,
    COALESCE(s.loa_name, r.loa_name)                             AS loa_name,
    s.cost_revenue                                               AS cost_revenue,
    s.categories                                                 AS categories,
    COALESCE(s.merged_wbs, r.merged_wbs, ci.merged_wbs)         AS merged_wbs,
    COALESCE(s.active_inactive, 'Active')                        AS active_inactive,

    -- Budget
    IFNULL(s.asbl, 0)                                            AS asbl,
    IFNULL(s.asbl_amc, 0)                                        AS asbl_amc,
    IFNULL(s.asbl_project, 0)                                    AS asbl_project,
    IFNULL(s.asbl_warranty, 0)                                   AS asbl_warranty,
    IFNULL(s.asbl_loa, 0)                                        AS asbl_loa,

    -- Non-committed
    IFNULL(s.non_committed, 0)                                   AS non_committed,
    IFNULL(s.non_committed_amc, 0)                               AS non_committed_amc,
    IFNULL(s.non_committed_project, 0)                           AS non_committed_project,
    IFNULL(s.non_committed_warranty, 0)                          AS non_committed_warranty,
    IFNULL(s.non_committed_editable, 0)                          AS non_committed_editable,
    IFNULL(s.non_committed_editable_amc, 0)                      AS non_committed_editable_amc,
    IFNULL(s.non_committed_editable_project, 0)                  AS non_committed_editable_project,
    IFNULL(s.non_committed_editable_warranty, 0)                 AS non_committed_editable_warranty,

    -- Period & actuals
    r.period                                                     AS period,
    IFNULL(r.ptd, 0)                                             AS ptd,
    COALESCE(r.single_wbs, ci.single_wbs)                       AS wbs_element_single,
    COALESCE(r.wbs_type, ci.wbs_type)                           AS wbs_type,
    COALESCE(r.wbs_description, ci.wbs_description)             AS wbs_description,

    -- Open commitment — only on latest period row
    CASE WHEN r.rn = 1 THEN IFNULL(ci.total_oc, 0) ELSE 0 END  AS open_commitment_KEUR,

    -- EAC = PTD + OC + non_committed_editable
    (
        IFNULL(r.ptd, 0)
        + CASE WHEN r.rn = 1 THEN IFNULL(ci.total_oc, 0) ELSE 0 END
        + IFNULL(s.non_committed_editable, 0)
    )                                                            AS eac,

    -- EAC vs ASBL
    (
        IFNULL(s.asbl, 0)
        - (
            IFNULL(r.ptd, 0)
            + CASE WHEN r.rn = 1 THEN IFNULL(ci.total_oc, 0) ELSE 0 END
            + IFNULL(s.non_committed_editable, 0)
          )
    )                                                            AS eac_vs_asbl,

    k.Merged_wbs_categories                                     AS Merged_wbs_categories,
    s.updated_by                                                 AS updated_by,
    s.updated_at                                                 AS updated_at

FROM master_keys k
LEFT JOIN `testing_service_cost`.`join_summary` s
    ON k.Merged_wbs_categories = s.Merged_wbs_categories
LEFT JOIN ranked r
    ON k.Merged_wbs_categories = r.Merged_wbs_categories
LEFT JOIN ci_agg ci
    ON k.Merged_wbs_categories = ci.Merged_wbs_categories;