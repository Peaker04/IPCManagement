-- IPCManagement — Fresh Install Schema
-- Version: v1.0 (EF migration 20260707093741_AddStocktakeEntities)
-- Last updated: 2026-07-08
-- Charset: utf8mb4 / utf8mb4_unicode_ci
--
-- Dùng file này để tạo database trắng hoàn toàn.
-- Chạy sau:
--   dotnet ef database update ...
-- để đánh dấu tất cả migrations đã applied (hoặc chạy Init_EF_History_For_Old_DB.sql).
--
-- KHÔNG dùng file này để nâng cấp database đang có dữ liệu.
-- Dùng "dotnet ef database update" cho database đang chạy.

CREATE DATABASE IF NOT EXISTS ipcManagement
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ipcManagement;

SET FOREIGN_KEY_CHECKS = 0;

-- ─── Drop tables (theo thứ tự FK-safe: child trước parent) ────────────────
DROP TABLE IF EXISTS stocktakelines;
DROP TABLE IF EXISTS stocktakes;
DROP TABLE IF EXISTS approvalassignments;
DROP TABLE IF EXISTS approvalrules;
DROP TABLE IF EXISTS stocksnapshots;
DROP TABLE IF EXISTS currentstocklots;
DROP TABLE IF EXISTS stockmovements;
DROP TABLE IF EXISTS inventoryreturnlines;
DROP TABLE IF EXISTS inventoryreturns;
DROP TABLE IF EXISTS inventoryissuelines;
DROP TABLE IF EXISTS inventoryissues;
DROP TABLE IF EXISTS purchaseorderlines;
DROP TABLE IF EXISTS purchaseorders;
DROP TABLE IF EXISTS inventoryreceiptlines;
DROP TABLE IF EXISTS inventoryreceipts;
DROP TABLE IF EXISTS purchaserequestlines;
DROP TABLE IF EXISTS purchaserequests;
DROP TABLE IF EXISTS supplierquotations;
DROP TABLE IF EXISTS materialrequestlines;
DROP TABLE IF EXISTS materialrequests;
DROP TABLE IF EXISTS productionplanlines;
DROP TABLE IF EXISTS productionplans;
DROP TABLE IF EXISTS approvalhistories;
DROP TABLE IF EXISTS quantityadjustments;
DROP TABLE IF EXISTS mealquantityplanlines;
DROP TABLE IF EXISTS mealquantityplans;
DROP TABLE IF EXISTS quantityimportbatches;
DROP TABLE IF EXISTS menuschedules;
DROP TABLE IF EXISTS menuitems;
DROP TABLE IF EXISTS menus;
DROP TABLE IF EXISTS menuversions;
DROP TABLE IF EXISTS portionrules;
DROP TABLE IF EXISTS bomadjustments;
DROP TABLE IF EXISTS dishbom;
DROP TABLE IF EXISTS dishes;
DROP TABLE IF EXISTS customerimportmappings;
DROP TABLE IF EXISTS customercontracts;
DROP TABLE IF EXISTS ingredients;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS refreshtokens;
DROP TABLE IF EXISTS auditlogs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── Core identity ────────────────────────────────────────────────────────

CREATE TABLE roles (
  roleId    BINARY(16)   PRIMARY KEY,
  roleCode  VARCHAR(50)  NOT NULL UNIQUE,
  roleName  VARCHAR(100) NOT NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE users (
  userId       BINARY(16)   PRIMARY KEY,
  fullName     VARCHAR(150) NOT NULL,
  username     VARCHAR(100) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  roleId       BINARY(16)   NOT NULL,
  isActive     BOOLEAN      NOT NULL DEFAULT TRUE,
  createdAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roleId) REFERENCES roles(roleId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE refreshtokens (
  tokenId          BINARY(16)   PRIMARY KEY,
  userId           BINARY(16)   NOT NULL,
  tokenHash        CHAR(64)     NOT NULL,
  deviceInfo       VARCHAR(200) NOT NULL DEFAULT '',
  createdAt        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiresAt        DATETIME     NOT NULL,
  isUsed           BOOLEAN      NOT NULL DEFAULT FALSE,
  isRevoked        BOOLEAN      NOT NULL DEFAULT FALSE,
  revokedAt        DATETIME     NULL,
  replacedByToken  VARCHAR(64)  NULL,
  FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE auditlogs (
  auditId      BINARY(16)   PRIMARY KEY,
  changedAt    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changedBy    BINARY(16)   NOT NULL,
  businessArea VARCHAR(100) NOT NULL,
  entityName   VARCHAR(100) NOT NULL,
  entityId     BINARY(16)   NULL,
  fieldName    VARCHAR(100) NULL,
  oldValue     TEXT         NULL,
  newValue     TEXT         NULL,
  reason       TEXT         NULL,
  FOREIGN KEY (changedBy) REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Domain lookups ───────────────────────────────────────────────────────

CREATE TABLE customers (
  customerId   BINARY(16)   PRIMARY KEY,
  customerCode VARCHAR(50)  NOT NULL UNIQUE,
  customerName VARCHAR(200) NOT NULL,
  note         TEXT         NULL,
  isActive     BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE warehouses (
  warehouseId   BINARY(16)   PRIMARY KEY,
  warehouseCode VARCHAR(50)  NOT NULL UNIQUE,
  warehouseName VARCHAR(150) NOT NULL,
  warehouseType ENUM('PHULIEUGIAVI','TUOI','DONGLANH','KHAC') NOT NULL DEFAULT 'KHAC',
  note          TEXT         NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE suppliers (
  supplierId   BINARY(16)   PRIMARY KEY,
  supplierCode VARCHAR(50)  NOT NULL UNIQUE,
  supplierName VARCHAR(200) NOT NULL,
  debtPolicy   TEXT         NULL,
  invoicePolicy TEXT        NULL,
  contactName  VARCHAR(150) NULL,
  phone        VARCHAR(30)  NULL,
  address      VARCHAR(255) NULL,
  isActive     BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE units (
  unitId            BINARY(16)    PRIMARY KEY,
  unitCode          VARCHAR(30)   NOT NULL UNIQUE,
  unitName          VARCHAR(100)  NOT NULL,
  baseUnitCode      VARCHAR(30)   NULL,
  convertRateToBase DECIMAL(18,6) NOT NULL DEFAULT 1
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Ingredients & BOM ────────────────────────────────────────────────────

CREATE TABLE ingredients (
  ingredientId   BINARY(16)   PRIMARY KEY,
  ingredientCode VARCHAR(50)  NOT NULL UNIQUE,
  ingredientName VARCHAR(200) NOT NULL,
  unitId         BINARY(16)   NOT NULL,
  warehouseId    BINARY(16)   NOT NULL,
  referencePrice DECIMAL(18,2) NOT NULL DEFAULT 0,
  isFreshDaily   BOOLEAN      NOT NULL DEFAULT FALSE,
  isActive       BOOLEAN      NOT NULL DEFAULT TRUE,
  FOREIGN KEY (unitId)      REFERENCES units(unitId),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE dishes (
  dishId    BINARY(16)   PRIMARY KEY,
  dishCode  VARCHAR(50)  NOT NULL UNIQUE,
  dishName  VARCHAR(200) NOT NULL,
  dishGroup VARCHAR(100) NULL,
  dishType  VARCHAR(100) NULL,
  isActive  BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE dishbom (
  bomId              BINARY(16)    PRIMARY KEY,
  dishId             BINARY(16)    NOT NULL,
  ingredientId       BINARY(16)    NOT NULL,
  unitId             BINARY(16)    NOT NULL,
  grossQtyPerServing DECIMAL(18,6) NOT NULL,
  wasteRatePercent   DECIMAL(5,2)  NOT NULL DEFAULT 0,
  effectiveFrom      DATE          NOT NULL,
  effectiveTo        DATE          NULL,
  -- added by 20260630161000_AddBomVersionStatus
  bomStatus          VARCHAR(20)   NOT NULL DEFAULT 'PUBLISHED',
  FOREIGN KEY (dishId)       REFERENCES dishes(dishId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)       REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE bomadjustments (
  bomAdjustmentId      BINARY(16)    PRIMARY KEY,
  bomId                BINARY(16)    NOT NULL,
  oldGrossQtyPerServing DECIMAL(18,6) NOT NULL,
  newGrossQtyPerServing DECIMAL(18,6) NOT NULL,
  oldWasteRatePercent  DECIMAL(5,2)  NOT NULL,
  newWasteRatePercent  DECIMAL(5,2)  NOT NULL,
  reason               TEXT          NULL,
  adjustedBy           BINARY(16)    NOT NULL,
  adjustedAt           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bomId)       REFERENCES dishbom(bomId),
  FOREIGN KEY (adjustedBy)  REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Customer contracts & portion rules (Phase 2) ─────────────────────────

CREATE TABLE customercontracts (
  contractId           BINARY(16)    PRIMARY KEY,
  customerId           BINARY(16)    NOT NULL,
  effectiveFrom        DATE          NOT NULL,
  effectiveTo          DATE          NULL,
  activeWeekDays       VARCHAR(100)  NOT NULL,
  shiftNames           VARCHAR(100)  NOT NULL,
  defaultMenuPrice     DECIMAL(18,2) NOT NULL,
  defaultBomRatePercent DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  status               VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
  createdAt            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ixCustomerContractsEffective (customerId, effectiveFrom, effectiveTo),
  FOREIGN KEY (customerId) REFERENCES customers(customerId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE customerimportmappings (
  mappingId          BINARY(16)   PRIMARY KEY,
  customerId         BINARY(16)   NOT NULL,
  sourceCustomerCode VARCHAR(100) NOT NULL,
  isActive           BOOLEAN      NOT NULL DEFAULT TRUE,
  createdAt          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uqCustomerImportMappings (customerId, sourceCustomerCode),
  FOREIGN KEY (customerId) REFERENCES customers(customerId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE portionrules (
  portionRuleId     BINARY(16)   PRIMARY KEY,
  customerId        BINARY(16)   NOT NULL,
  dishId            BINARY(16)   NULL,
  effectiveFrom     DATE         NOT NULL,
  effectiveTo       DATE         NULL,
  activeWeekDays    VARCHAR(100) NULL,
  shiftNames        VARCHAR(100) NULL,
  menuVariant       VARCHAR(50)  NULL,
  menuSectionName   VARCHAR(150) NULL,
  slotName          VARCHAR(100) NULL,
  dishCategory      VARCHAR(100) NULL,
  portionRatePercent DECIMAL(5,2) NOT NULL,
  bomRatePercent    DECIMAL(5,2) NULL,
  yieldLossPercent  DECIMAL(5,2) NULL,
  priority          INT          NOT NULL DEFAULT 0,
  status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  reason            TEXT         NOT NULL,
  createdAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ixPortionRulesCustomerEffective (customerId, effectiveFrom, effectiveTo, status),
  FOREIGN KEY (customerId) REFERENCES customers(customerId),
  FOREIGN KEY (dishId)     REFERENCES dishes(dishId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Menus & schedules ────────────────────────────────────────────────────

CREATE TABLE menus (
  menuId   BINARY(16)   PRIMARY KEY,
  menuCode VARCHAR(50)  NOT NULL UNIQUE,
  menuName VARCHAR(200) NOT NULL,
  fromDate DATE         NULL,
  toDate   DATE         NULL,
  isActive BOOLEAN      NOT NULL DEFAULT TRUE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE menuversions (
  menuVersionId     BINARY(16)   PRIMARY KEY,
  customerId        BINARY(16)   NOT NULL,
  weekStartDate     DATE         NOT NULL,
  versionNo         INT          NOT NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  sourceFileName    VARCHAR(255) NULL,
  sourceChecksum    VARCHAR(128) NULL,
  sourceImportBatch VARCHAR(80)  NULL,
  createdBy         BINARY(16)   NULL,
  createdAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  publishedBy       BINARY(16)   NULL,
  publishedAt       DATETIME     NULL,
  updatedAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uqMenuVersionsCustomerWeekVersion (customerId, weekStartDate, versionNo),
  KEY ixMenuVersionsCustomerWeekStatus (customerId, weekStartDate, status),
  FOREIGN KEY (customerId) REFERENCES customers(customerId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE menuitems (
  menuItemId   BINARY(16)   PRIMARY KEY,
  menuId       BINARY(16)   NOT NULL,
  dishId       BINARY(16)   NOT NULL,
  dishSlot     VARCHAR(100) NULL,
  displayOrder INT          NOT NULL DEFAULT 1,
  FOREIGN KEY (menuId) REFERENCES menus(menuId),
  FOREIGN KEY (dishId) REFERENCES dishes(dishId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE menuschedules (
  menuScheduleId BINARY(16)   PRIMARY KEY,
  customerId     BINARY(16)   NOT NULL,
  menuId         BINARY(16)   NOT NULL,
  serviceDate    DATE         NOT NULL,
  weekStartDate  DATE         NOT NULL,
  shiftName      ENUM('MORNING','AFTERNOON') NOT NULL,
  menuPrice      DECIMAL(18,2) NOT NULL DEFAULT 0,
  bomRatePercent DECIMAL(5,2)  NOT NULL DEFAULT 100,
  -- VARCHAR instead of ENUM: supports DRAFT/CONFIRMED/CANCELLED/ACTIVE/SUPERSEDED/LOCKED
  status         VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  FOREIGN KEY (customerId) REFERENCES customers(customerId),
  FOREIGN KEY (menuId)     REFERENCES menus(menuId),
  UNIQUE KEY uqMenuSchedulesCustomerDateShift (customerId, serviceDate, shiftName)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Meal quantity planning ────────────────────────────────────────────────

CREATE TABLE quantityimportbatches (
  importBatchId      BINARY(16)   PRIMARY KEY,
  batchCode          VARCHAR(50)  NOT NULL UNIQUE,
  sourceCompanyName  VARCHAR(200) NULL,
  sourceType         ENUM('EXCEL','API','EMAIL','MANUAL') NOT NULL DEFAULT 'MANUAL',
  importedBy         BINARY(16)   NULL,
  importedAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status             ENUM('RECEIVED','VALIDATED','CONFIRMED','REJECTED') NOT NULL DEFAULT 'RECEIVED',
  FOREIGN KEY (importedBy) REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE mealquantityplans (
  quantityPlanId      BINARY(16)   PRIMARY KEY,
  importBatchId       BINARY(16)   NULL,
  planCode            VARCHAR(50)  NOT NULL UNIQUE,
  serviceDate         DATE         NOT NULL,
  -- added COMPLETED by 20260706033326
  status              ENUM('DRAFT','FORECASTED','CONFIRMED','ADJUSTED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  forecastReceivedAt  DATETIME     NULL,
  confirmedAt         DATETIME     NULL,
  confirmationTime    TIME         NOT NULL DEFAULT '08:30:00',
  confirmedBy         BINARY(16)   NULL,
  -- added by 20260706033326
  completedAt         DATETIME     NULL,
  completedBy         BINARY(16)   NULL,
  rowVersion          TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  FOREIGN KEY (importBatchId) REFERENCES quantityimportbatches(importBatchId),
  FOREIGN KEY (confirmedBy)   REFERENCES users(userId),
  FOREIGN KEY (completedBy)   REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE mealquantityplanlines (
  quantityPlanLineId BINARY(16)   PRIMARY KEY,
  quantityPlanId     BINARY(16)   NOT NULL,
  menuScheduleId     BINARY(16)   NOT NULL,
  customerId         BINARY(16)   NOT NULL,
  menuId             BINARY(16)   NOT NULL,
  shiftName          ENUM('MORNING','AFTERNOON') NOT NULL,
  forecastServings   INT          NOT NULL DEFAULT 0,
  confirmedServings  INT          NOT NULL DEFAULT 0,
  adjustedServings   INT          NOT NULL DEFAULT 0,
  finalServings      INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (quantityPlanId)  REFERENCES mealquantityplans(quantityPlanId),
  FOREIGN KEY (menuScheduleId)  REFERENCES menuschedules(menuScheduleId),
  FOREIGN KEY (customerId)      REFERENCES customers(customerId),
  FOREIGN KEY (menuId)          REFERENCES menus(menuId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE quantityadjustments (
  adjustmentId       BINARY(16)   PRIMARY KEY,
  quantityPlanLineId BINARY(16)   NOT NULL,
  oldServings        INT          NOT NULL,
  newServings        INT          NOT NULL,
  reason             TEXT         NULL,
  adjustedBy         BINARY(16)   NOT NULL,
  adjustedAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quantityPlanLineId) REFERENCES mealquantityplanlines(quantityPlanLineId),
  FOREIGN KEY (adjustedBy)         REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Production planning ──────────────────────────────────────────────────

CREATE TABLE productionplans (
  planId        BINARY(16)   PRIMARY KEY,
  planCode      VARCHAR(50)  NOT NULL UNIQUE,
  planDate      DATE         NOT NULL,
  status        ENUM('CREATED','SENTTOKITCHEN','COMPLETED','CANCELLED') NOT NULL DEFAULT 'CREATED',
  createdBy     BINARY(16)   NOT NULL,
  createdAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- added by 20260702072352 / 20260702121000
  updatedAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  menuVersionId BINARY(16)   NULL,
  weekStartDate DATE         NULL,
  FOREIGN KEY (createdBy) REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE productionplanlines (
  planLineId         BINARY(16)   PRIMARY KEY,
  planId             BINARY(16)   NOT NULL,
  quantityPlanLineId BINARY(16)   NOT NULL,
  customerId         BINARY(16)   NOT NULL,
  menuId             BINARY(16)   NOT NULL,
  dishId             BINARY(16)   NOT NULL,
  shiftName          ENUM('MORNING','AFTERNOON') NOT NULL,
  totalServings      INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (planId)             REFERENCES productionplans(planId),
  FOREIGN KEY (quantityPlanLineId) REFERENCES mealquantityplanlines(quantityPlanLineId),
  FOREIGN KEY (customerId)         REFERENCES customers(customerId),
  FOREIGN KEY (menuId)             REFERENCES menus(menuId),
  FOREIGN KEY (dishId)             REFERENCES dishes(dishId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Material requests (demand) ───────────────────────────────────────────

CREATE TABLE materialrequests (
  requestId    BINARY(16)   PRIMARY KEY,
  requestCode  VARCHAR(50)  NOT NULL UNIQUE,
  planId       BINARY(16)   NOT NULL,
  requestDate  DATE         NOT NULL,
  requestScope ENUM('FULLDAY','MORNING','AFTERNOON') NOT NULL DEFAULT 'FULLDAY',
  status       ENUM('DRAFT','MANAGERAPPROVED','SENTTOWAREHOUSE','EXPORTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  createdBy    BINARY(16)   NOT NULL,
  approvedBy   BINARY(16)   NULL,
  approvedAt   DATETIME     NULL,
  FOREIGN KEY (planId)     REFERENCES productionplans(planId),
  FOREIGN KEY (createdBy)  REFERENCES users(userId),
  FOREIGN KEY (approvedBy) REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE materialrequestlines (
  requestLineId            BINARY(16)    PRIMARY KEY,
  requestId                BINARY(16)    NOT NULL,
  planLineId               BINARY(16)    NOT NULL,
  ingredientId             BINARY(16)    NOT NULL,
  unitId                   BINARY(16)    NOT NULL,
  totalServings            INT           NOT NULL DEFAULT 0,
  grossQtyPerServing       DECIMAL(18,6) NOT NULL DEFAULT 0,
  bomRatePercent           DECIMAL(5,2)  NOT NULL DEFAULT 100,
  totalRequiredQty         DECIMAL(18,6) NOT NULL DEFAULT 0,
  currentStockQty          DECIMAL(18,6) NOT NULL DEFAULT 0,
  suggestedPurchaseQty     DECIMAL(18,6) NOT NULL DEFAULT 0,
  -- added by 20260630065000_AddPortionRuleTraceToDemandLines
  appliedPortionRuleId     BINARY(16)    NULL,
  appliedPortionRatePercent DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  appliedPortionRuleSource VARCHAR(50)   NOT NULL DEFAULT 'CONTRACT_DEFAULT',
  yieldLossPercent         DECIMAL(5,2)  NULL,
  FOREIGN KEY (requestId)   REFERENCES materialrequests(requestId),
  FOREIGN KEY (planLineId)  REFERENCES productionplanlines(planLineId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)      REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Purchase workflow ────────────────────────────────────────────────────

CREATE TABLE purchaserequests (
  purchaseRequestId   BINARY(16)   PRIMARY KEY,
  purchaseRequestCode VARCHAR(50)  NOT NULL UNIQUE,
  requestDate         DATE         NOT NULL,
  purchaseForDate     DATE         NOT NULL,
  shiftName           ENUM('MORNING','AFTERNOON') NULL,
  -- status is varchar to allow: DRAFT/SENTTOSUPPLIER/APPROVED/REJECTED/SENTTOWAREHOUSE/PARTIALRECEIVED/RECEIVED/CANCELLED
  status              VARCHAR(30)  NOT NULL DEFAULT 'DRAFT',
  createdBy           BINARY(16)   NOT NULL,
  approvedBy          BINARY(16)   NULL,
  approvedAt          DATETIME     NULL,
  FOREIGN KEY (createdBy)  REFERENCES users(userId),
  FOREIGN KEY (approvedBy) REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE purchaserequestlines (
  purchaseRequestLineId BINARY(16)    PRIMARY KEY,
  purchaseRequestId     BINARY(16)    NOT NULL,
  materialRequestLineId BINARY(16)    NOT NULL,
  ingredientId          BINARY(16)    NOT NULL,
  supplierId            BINARY(16)    NOT NULL,
  unitId                BINARY(16)    NOT NULL,
  requiredQty           DECIMAL(18,6) NOT NULL DEFAULT 0,
  currentStockQty       DECIMAL(18,6) NOT NULL DEFAULT 0,
  purchaseQty           DECIMAL(18,6) NOT NULL DEFAULT 0,
  estimatedUnitPrice    DECIMAL(18,2) NOT NULL DEFAULT 0,
  -- added by 20260702194500_AddPurchaseLineDeliveryNote
  expectedDeliveryDate  DATE          NULL,
  note                  VARCHAR(500)  NULL,
  FOREIGN KEY (purchaseRequestId)     REFERENCES purchaserequests(purchaseRequestId),
  FOREIGN KEY (materialRequestLineId) REFERENCES materialrequestlines(requestLineId),
  FOREIGN KEY (ingredientId)          REFERENCES ingredients(ingredientId),
  FOREIGN KEY (supplierId)            REFERENCES suppliers(supplierId),
  FOREIGN KEY (unitId)                REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE supplierquotations (
  quotationId   BINARY(16)    PRIMARY KEY,
  supplierId    BINARY(16)    NOT NULL,
  ingredientId  BINARY(16)    NOT NULL,
  unitPrice     DECIMAL(18,2) NOT NULL,
  effectiveFrom DATE          NOT NULL,
  effectiveTo   DATE          NULL,
  note          VARCHAR(255)  NULL,
  isActive      BOOLEAN       NOT NULL DEFAULT TRUE,
  createdAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ixSupplierQuotationsSupplierIngredientEffective (supplierId, ingredientId, effectiveFrom),
  FOREIGN KEY (supplierId)   REFERENCES suppliers(supplierId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE purchaseorders (
  purchaseOrderId   BINARY(16)   PRIMARY KEY,
  purchaseOrderCode VARCHAR(50)  NOT NULL UNIQUE,
  purchaseRequestId BINARY(16)   NOT NULL,
  supplierId        BINARY(16)   NOT NULL,
  orderDate         DATE         NOT NULL,
  status            VARCHAR(30)  NOT NULL DEFAULT 'ORDERED',
  createdBy         BINARY(16)   NOT NULL,
  createdAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ixPurchaseOrdersRequestSupplier (purchaseRequestId, supplierId),
  KEY ixPurchaseOrdersRequest (purchaseRequestId),
  KEY ixPurchaseOrdersSupplier (supplierId),
  FOREIGN KEY (purchaseRequestId) REFERENCES purchaserequests(purchaseRequestId),
  FOREIGN KEY (supplierId)        REFERENCES suppliers(supplierId),
  FOREIGN KEY (createdBy)         REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE purchaseorderlines (
  purchaseOrderLineId   BINARY(16)    PRIMARY KEY,
  purchaseOrderId       BINARY(16)    NOT NULL,
  purchaseRequestLineId BINARY(16)    NOT NULL,
  ingredientId          BINARY(16)    NOT NULL,
  unitId                BINARY(16)    NOT NULL,
  orderedQty            DECIMAL(18,6) NOT NULL,
  receivedQty           DECIMAL(18,6) NOT NULL,
  unitPrice             DECIMAL(18,2) NOT NULL,
  UNIQUE KEY ixPurchaseOrderLinesRequestLine (purchaseRequestLineId),
  KEY ixPurchaseOrderLinesOrder (purchaseOrderId),
  KEY ixPurchaseOrderLinesIngredient (ingredientId),
  KEY ixPurchaseOrderLinesUnit (unitId),
  FOREIGN KEY (purchaseOrderId)       REFERENCES purchaseorders(purchaseOrderId),
  FOREIGN KEY (purchaseRequestLineId) REFERENCES purchaserequestlines(purchaseRequestLineId),
  FOREIGN KEY (ingredientId)          REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)                REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Approval workflow ────────────────────────────────────────────────────

CREATE TABLE approvalhistories (
  approvalHistoryId BINARY(16)   PRIMARY KEY,
  targetType        VARCHAR(50)  NOT NULL,
  targetId          BINARY(16)   NOT NULL,
  decision          VARCHAR(20)  NOT NULL,
  oldStatus         VARCHAR(50)  NULL,
  newStatus         VARCHAR(50)  NULL,
  reason            TEXT         NULL,
  actionBy          BINARY(16)   NOT NULL,
  actionAt          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY ixApprovalHistoriesTarget (targetType, targetId, actionAt),
  FOREIGN KEY (actionBy) REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE approvalrules (
  ruleId       BINARY(16)    PRIMARY KEY,
  ruleName     VARCHAR(200)  NOT NULL,
  documentType VARCHAR(50)   NOT NULL,
  minAmount    DECIMAL(18,2) NULL,
  maxAmount    DECIMAL(18,2) NULL,
  slaHours     INT           NULL,
  isActive     BOOLEAN       NOT NULL DEFAULT TRUE,
  createdAt    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE approvalassignments (
  assignmentId   BINARY(16)  PRIMARY KEY,
  ruleId         BINARY(16)  NOT NULL,
  sequence       INT         NOT NULL,
  approverRole   VARCHAR(50) NOT NULL,
  approverUserId BINARY(16)  NULL,
  isRequired     BOOLEAN     NOT NULL DEFAULT TRUE,
  KEY IX_approvalassignments_ruleId (ruleId),
  KEY IX_approvalassignments_approverUserId (approverUserId),
  FOREIGN KEY (ruleId)         REFERENCES approvalrules(ruleId) ON DELETE CASCADE,
  FOREIGN KEY (approverUserId) REFERENCES users(userId) ON DELETE SET NULL
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Inventory ────────────────────────────────────────────────────────────

CREATE TABLE inventoryreceipts (
  receiptId         BINARY(16)  PRIMARY KEY,
  receiptCode       VARCHAR(50) NOT NULL UNIQUE,
  receiptDate       DATE        NOT NULL,
  warehouseId       BINARY(16)  NOT NULL,
  supplierId        BINARY(16)  NOT NULL,
  purchaseRequestId BINARY(16)  NULL,
  createdBy         BINARY(16)  NOT NULL,
  createdAt         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouseId)       REFERENCES warehouses(warehouseId),
  FOREIGN KEY (supplierId)        REFERENCES suppliers(supplierId),
  FOREIGN KEY (purchaseRequestId) REFERENCES purchaserequests(purchaseRequestId),
  FOREIGN KEY (createdBy)         REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE inventoryreceiptlines (
  receiptLineId         BINARY(16)    PRIMARY KEY,
  receiptId             BINARY(16)    NOT NULL,
  ingredientId          BINARY(16)    NOT NULL,
  unitId                BINARY(16)    NOT NULL,
  quantity              DECIMAL(18,6) NOT NULL DEFAULT 0,
  unitPrice             DECIMAL(18,2) NOT NULL DEFAULT 0,
  amount                DECIMAL(18,2) GENERATED ALWAYS AS (quantity * unitPrice) STORED,
  lotNumber             VARCHAR(100)  NULL,
  manufactureDate       DATE          NULL,
  expiredDate           DATE          NULL,
  -- added by 20260706093000_AddPurchaseRequestLineToInventoryReceipts
  purchaseRequestLineId BINARY(16)    NULL,
  FOREIGN KEY (receiptId)             REFERENCES inventoryreceipts(receiptId),
  FOREIGN KEY (ingredientId)          REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)                REFERENCES units(unitId),
  FOREIGN KEY (purchaseRequestLineId) REFERENCES purchaserequestlines(purchaseRequestLineId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE inventoryissues (
  issueId           BINARY(16)  PRIMARY KEY,
  issueCode         VARCHAR(50) NOT NULL UNIQUE,
  issueDate         DATE        NOT NULL,
  shiftName         ENUM('MORNING','AFTERNOON') NULL,
  warehouseId       BINARY(16)  NOT NULL,
  materialRequestId BINARY(16)  NOT NULL,
  issuedBy          BINARY(16)  NOT NULL,
  receivedBy        BINARY(16)  NULL,
  createdAt         DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- added by 20260702203000_AddInventoryIssueReceivedAt
  receivedAt        DATETIME    NULL,
  FOREIGN KEY (warehouseId)       REFERENCES warehouses(warehouseId),
  FOREIGN KEY (materialRequestId) REFERENCES materialrequests(requestId),
  FOREIGN KEY (issuedBy)          REFERENCES users(userId),
  FOREIGN KEY (receivedBy)        REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE inventoryissuelines (
  issueLineId  BINARY(16)    PRIMARY KEY,
  issueId      BINARY(16)    NOT NULL,
  ingredientId BINARY(16)    NOT NULL,
  unitId       BINARY(16)    NOT NULL,
  requestedQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  issuedQty    DECIMAL(18,6) NOT NULL DEFAULT 0,
  FOREIGN KEY (issueId)      REFERENCES inventoryissues(issueId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)       REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE inventoryreturns (
  returnId    BINARY(16)  PRIMARY KEY,
  returnCode  VARCHAR(50) NOT NULL UNIQUE,
  returnDate  DATE        NOT NULL,
  shiftName   ENUM('MORNING','AFTERNOON') NULL,
  warehouseId BINARY(16)  NOT NULL,
  issueId     BINARY(16)  NOT NULL,
  reason      TEXT        NULL,
  createdBy   BINARY(16)  NOT NULL,
  createdAt   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- added by 20260702204500_AddInventoryReturnType
  returnType  VARCHAR(30) NULL,
  -- added by 20260707085015_AddReceivedToInventoryReturn
  receivedAt  DATETIME    NULL,
  receivedBy  BINARY(16)  NULL,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  FOREIGN KEY (issueId)     REFERENCES inventoryissues(issueId),
  FOREIGN KEY (createdBy)   REFERENCES users(userId),
  FOREIGN KEY (receivedBy)  REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE inventoryreturnlines (
  returnLineId BINARY(16)    PRIMARY KEY,
  returnId     BINARY(16)    NOT NULL,
  ingredientId BINARY(16)    NOT NULL,
  unitId       BINARY(16)    NOT NULL,
  quantity     DECIMAL(18,6) NOT NULL DEFAULT 0,
  FOREIGN KEY (returnId)     REFERENCES inventoryreturns(returnId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)       REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Stock ledger ─────────────────────────────────────────────────────────

CREATE TABLE currentstock (
  warehouseId  BINARY(16)    NOT NULL,
  ingredientId BINARY(16)    NOT NULL,
  unitId       BINARY(16)    NOT NULL,
  currentQty   DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  lastUpdated  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rowVersion   TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (warehouseId, ingredientId),
  FOREIGN KEY (warehouseId)  REFERENCES warehouses(warehouseId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)       REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE stockmovements (
  movementId      BINARY(16)    PRIMARY KEY,
  movementDate    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  warehouseId     BINARY(16)    NOT NULL,
  ingredientId    BINARY(16)    NOT NULL,
  unitId          BINARY(16)    NOT NULL,
  movementType    ENUM('RECEIPT','ISSUE','RETURN','ADJUSTMENT') NOT NULL,
  refTable        VARCHAR(80)   NULL,
  refId           BINARY(16)    NULL,
  quantityIn      DECIMAL(18,6) NOT NULL DEFAULT 0,
  quantityOut     DECIMAL(18,6) NOT NULL DEFAULT 0,
  -- added by 20260703100000_AddStockMovementQuantitySnapshots
  beforeQty       DECIMAL(18,6) NOT NULL DEFAULT 0,
  afterQty        DECIMAL(18,6) NOT NULL DEFAULT 0,
  -- added by 20260703093000_AddLotLevelStock
  lotNumber       VARCHAR(100)  NULL,
  manufactureDate DATE          NULL,
  expiredDate     DATE          NULL,
  reason          TEXT          NULL,
  note            TEXT          NULL,
  performedBy     BINARY(16)    NOT NULL,
  FOREIGN KEY (warehouseId)  REFERENCES warehouses(warehouseId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)       REFERENCES units(unitId),
  FOREIGN KEY (performedBy)  REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE currentstocklots (
  lotStockId      BINARY(16)    PRIMARY KEY,
  warehouseId     BINARY(16)    NOT NULL,
  ingredientId    BINARY(16)    NOT NULL,
  unitId          BINARY(16)    NOT NULL,
  lotNumber       VARCHAR(100)  NULL,
  manufactureDate DATE          NULL,
  expiredDate     DATE          NULL,
  currentQty      DECIMAL(18,6) NOT NULL DEFAULT 0,
  lastUpdated     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouseId)  REFERENCES warehouses(warehouseId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)       REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE stocksnapshots (
  snapshotId   BINARY(16)    PRIMARY KEY,
  warehouseId  BINARY(16)    NOT NULL,
  ingredientId BINARY(16)    NOT NULL,
  unitId       BINARY(16)    NOT NULL,
  periodMonth  DATE          NOT NULL,
  openingQty   DECIMAL(18,6) NOT NULL DEFAULT 0,
  quantityIn   DECIMAL(18,6) NOT NULL DEFAULT 0,
  quantityOut  DECIMAL(18,6) NOT NULL DEFAULT 0,
  closingQty   DECIMAL(18,6) NOT NULL DEFAULT 0,
  generatedAt  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY ixStockSnapshotsIdentity (warehouseId, ingredientId, unitId, periodMonth),
  FOREIGN KEY (warehouseId)  REFERENCES warehouses(warehouseId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)       REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Stocktake (added Phase 2) ────────────────────────────────────────────

CREATE TABLE stocktakes (
  stocktakeId   BINARY(16)    PRIMARY KEY,
  stocktakeCode VARCHAR(50)   NOT NULL UNIQUE,
  warehouseId   BINARY(16)    NOT NULL,
  status        VARCHAR(50)   NOT NULL,
  notes         VARCHAR(1000) NULL,
  createdBy     BINARY(16)    NOT NULL,
  createdAt     DATETIME      NOT NULL,
  approvedBy    BINARY(16)    NULL,
  approvedAt    DATETIME      NULL,
  KEY ixStocktakeWarehouse (warehouseId),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  FOREIGN KEY (createdBy)   REFERENCES users(userId),
  FOREIGN KEY (approvedBy)  REFERENCES users(userId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE stocktakelines (
  lineId         BINARY(16)    PRIMARY KEY,
  stocktakeId    BINARY(16)    NOT NULL,
  ingredientId   BINARY(16)    NOT NULL,
  unitId         BINARY(16)    NOT NULL,
  systemQty      DECIMAL(18,2) NOT NULL,
  actualQty      DECIMAL(18,2) NULL,
  discrepancyQty DECIMAL(18,2) NULL,
  reason         VARCHAR(1000) NULL,
  KEY ixStocktakelineStocktake (stocktakeId),
  FOREIGN KEY (stocktakeId)  REFERENCES stocktakes(stocktakeId) ON DELETE CASCADE,
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId)       REFERENCES units(unitId)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ─── Indexes ──────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX ixRefreshTokensHash          ON refreshtokens(tokenHash);
CREATE INDEX        ixRefreshTokensUserExpiry     ON refreshtokens(userId, expiresAt);
CREATE INDEX        ixAuditLogsChangedBy          ON auditlogs(changedBy, changedAt);
CREATE INDEX        ix_currentstock_ingredient    ON currentstock(ingredientId);
CREATE INDEX        IX_currentstock_unitId        ON currentstock(unitId);
CREATE INDEX        ixDishBomDishEffective        ON dishbom(dishId, effectiveFrom, effectiveTo);
CREATE INDEX        ixMenuSchedulesWeek           ON menuschedules(weekStartDate, serviceDate, shiftName, customerId);
CREATE INDEX        ixMealQuantityPlansDate       ON mealquantityplans(serviceDate, status, confirmedAt);
CREATE INDEX        IX_mealquantityplans_completedBy ON mealquantityplans(completedBy);
CREATE INDEX        ixMaterialRequestsPlan        ON materialrequests(planId, status);
CREATE INDEX        ixPurchaseRequestsDate        ON purchaserequests(purchaseForDate, status);
CREATE INDEX        ixInventoryReceiptLinesExpiry ON inventoryreceiptlines(ingredientId, expiredDate, lotNumber);
CREATE INDEX        purchaseRequestLineId         ON inventoryreceiptlines(purchaseRequestLineId);
CREATE INDEX        ixStockMovementsLookup        ON stockmovements(warehouseId, ingredientId, movementDate);
CREATE INDEX        ixStockMovementsIngredientDate ON stockmovements(ingredientId, movementDate);
CREATE INDEX        ixStockMovementsTypeDate      ON stockmovements(movementType, movementDate);
CREATE INDEX        ixStockMovementsRef           ON stockmovements(refTable, refId);
CREATE INDEX        ixCurrentStockLotsFefo        ON currentstocklots(warehouseId, ingredientId, expiredDate, lotNumber);
CREATE UNIQUE INDEX ixCurrentStockLotsIdentity   ON currentstocklots(warehouseId, ingredientId, unitId, lotNumber, manufactureDate, expiredDate);
CREATE INDEX        ixStockSnapshotsPeriod        ON stocksnapshots(periodMonth, warehouseId, ingredientId);
CREATE INDEX        ixApprovalHistoriesTarget     ON approvalhistories(targetType, targetId, actionAt);
CREATE INDEX        ixSupplierQuotationsIngredient ON supplierquotations(ingredientId);
CREATE UNIQUE INDEX ixStocktakeCode              ON stocktakes(stocktakeCode);
CREATE INDEX        ixStocktakelineIngredient     ON stocktakelines(ingredientId);
CREATE INDEX        IX_stocktakelines_unitId      ON stocktakelines(unitId);
CREATE INDEX        ixMaterialRequestAppliedRule  ON materialrequestlines(appliedPortionRuleId);
CREATE INDEX        IX_inventoryreturns_receivedBy ON inventoryreturns(receivedBy);
CREATE INDEX        IX_approvalassignments_approverUserId ON approvalassignments(approverUserId);
CREATE INDEX        IX_stocktakes_approvedBy      ON stocktakes(approvedBy);
CREATE INDEX        IX_stocktakes_createdBy       ON stocktakes(createdBy);
