CREATE DATABASE IF NOT EXISTS ipcManagement
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ipcManagement;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS refreshtokens;
DROP TABLE IF EXISTS stocksnapshots;
DROP TABLE IF EXISTS currentstocklots;
DROP TABLE IF EXISTS currentstock;
DROP TABLE IF EXISTS stockmovements;
DROP TABLE IF EXISTS inventoryreturnlines;
DROP TABLE IF EXISTS inventoryreturns;
DROP TABLE IF EXISTS inventoryissuelines;
DROP TABLE IF EXISTS inventoryissues;
DROP TABLE IF EXISTS inventoryreceiptlines;
DROP TABLE IF EXISTS inventoryreceipts;
DROP TABLE IF EXISTS purchaserequestlines;
DROP TABLE IF EXISTS purchaserequests;
DROP TABLE IF EXISTS materialrequestlines;
DROP TABLE IF EXISTS materialrequests;
DROP TABLE IF EXISTS productionplanlines;
DROP TABLE IF EXISTS productionplans;
DROP TABLE IF EXISTS quantityadjustments;
DROP TABLE IF EXISTS mealquantityplanlines;
DROP TABLE IF EXISTS mealquantityplans;
DROP TABLE IF EXISTS quantityimportbatches;
DROP TABLE IF EXISTS menuschedules;
DROP TABLE IF EXISTS menuitems;
DROP TABLE IF EXISTS menus;
DROP TABLE IF EXISTS bomadjustments;
DROP TABLE IF EXISTS dishbom;
DROP TABLE IF EXISTS dishes;
DROP TABLE IF EXISTS ingredients;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS warehouses;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS auditlogs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE roles (
  roleId BINARY(16) PRIMARY KEY,
  roleCode VARCHAR(50) NOT NULL UNIQUE,
  roleName VARCHAR(100) NOT NULL
) ENGINE = InnoDB;

CREATE TABLE users (
  userId BINARY(16) PRIMARY KEY,
  fullName VARCHAR(150) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  roleId BINARY(16) NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roleId) REFERENCES roles(roleId)
) ENGINE = InnoDB;

CREATE TABLE refreshtokens (
  tokenId BINARY(16) PRIMARY KEY,
  userId BINARY(16) NOT NULL,
  tokenHash CHAR(64) NOT NULL,
  deviceInfo VARCHAR(200) NOT NULL DEFAULT '',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiresAt DATETIME NOT NULL,
  isUsed BOOLEAN NOT NULL DEFAULT FALSE,
  isRevoked BOOLEAN NOT NULL DEFAULT FALSE,
  revokedAt DATETIME NULL,
  replacedByToken VARCHAR(64) NULL,
  FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE auditlogs (
  auditId BINARY(16) PRIMARY KEY,
  changedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changedBy BINARY(16) NOT NULL,
  businessArea VARCHAR(100) NOT NULL,
  entityName VARCHAR(100) NOT NULL,
  entityId BINARY(16) NULL,
  fieldName VARCHAR(100) NULL,
  oldValue TEXT NULL,
  newValue TEXT NULL,
  reason TEXT NULL,
  FOREIGN KEY (changedBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE customers (
  customerId BINARY(16) PRIMARY KEY,
  customerCode VARCHAR(50) NOT NULL UNIQUE,
  customerName VARCHAR(200) NOT NULL,
  note TEXT NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE = InnoDB;

CREATE TABLE warehouses (
  warehouseId BINARY(16) PRIMARY KEY,
  warehouseCode VARCHAR(50) NOT NULL UNIQUE,
  warehouseName VARCHAR(150) NOT NULL,
  warehouseType ENUM('PHULIEUGIAVI','TUOI','DONGLANH','KHAC') NOT NULL DEFAULT 'KHAC',
  note TEXT NULL
) ENGINE = InnoDB;

CREATE TABLE suppliers (
  supplierId BINARY(16) PRIMARY KEY,
  supplierCode VARCHAR(50) NOT NULL UNIQUE,
  supplierName VARCHAR(200) NOT NULL,
  debtPolicy TEXT NULL,
  invoicePolicy TEXT NULL,
  contactName VARCHAR(150) NULL,
  phone VARCHAR(30) NULL,
  address VARCHAR(255) NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE = InnoDB;

CREATE TABLE units (
  unitId BINARY(16) PRIMARY KEY,
  unitCode VARCHAR(30) NOT NULL UNIQUE,
  unitName VARCHAR(100) NOT NULL,
  baseUnitCode VARCHAR(30) NULL,
  convertRateToBase DECIMAL(18,6) NOT NULL DEFAULT 1
) ENGINE = InnoDB;

CREATE TABLE ingredients (
  ingredientId BINARY(16) PRIMARY KEY,
  ingredientCode VARCHAR(50) NOT NULL UNIQUE,
  ingredientName VARCHAR(200) NOT NULL,
  unitId BINARY(16) NOT NULL,
  warehouseId BINARY(16) NOT NULL,
  referencePrice DECIMAL(18,2) NOT NULL DEFAULT 0,
  isFreshDaily BOOLEAN NOT NULL DEFAULT FALSE,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (unitId) REFERENCES units(unitId),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId)
) ENGINE = InnoDB;

CREATE TABLE currentstock (
  warehouseId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  currentQty DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  lastUpdated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rowVersion TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (warehouseId, ingredientId),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId) REFERENCES units(unitId)
) ENGINE = InnoDB;

CREATE TABLE dishes (
  dishId BINARY(16) PRIMARY KEY,
  dishCode VARCHAR(50) NOT NULL UNIQUE,
  dishName VARCHAR(200) NOT NULL,
  dishGroup VARCHAR(100) NULL,
  dishType VARCHAR(100) NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE = InnoDB;

CREATE TABLE dishbom (
  bomId BINARY(16) PRIMARY KEY,
  dishId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  grossQtyPerServing DECIMAL(18,6) NOT NULL,
  wasteRatePercent DECIMAL(5,2) NOT NULL DEFAULT 0,
  effectiveFrom DATE NOT NULL,
  effectiveTo DATE NULL,
  FOREIGN KEY (dishId) REFERENCES dishes(dishId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId) REFERENCES units(unitId)
) ENGINE = InnoDB;

CREATE TABLE bomadjustments (
  bomAdjustmentId BINARY(16) PRIMARY KEY,
  bomId BINARY(16) NOT NULL,
  oldGrossQtyPerServing DECIMAL(18,6) NOT NULL,
  newGrossQtyPerServing DECIMAL(18,6) NOT NULL,
  oldWasteRatePercent DECIMAL(5,2) NOT NULL,
  newWasteRatePercent DECIMAL(5,2) NOT NULL,
  reason TEXT NULL,
  adjustedBy BINARY(16) NOT NULL,
  adjustedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bomId) REFERENCES dishbom(bomId),
  FOREIGN KEY (adjustedBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE menus (
  menuId BINARY(16) PRIMARY KEY,
  menuCode VARCHAR(50) NOT NULL UNIQUE,
  menuName VARCHAR(200) NOT NULL,
  fromDate DATE NULL,
  toDate DATE NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE = InnoDB;

CREATE TABLE menuitems (
  menuItemId BINARY(16) PRIMARY KEY,
  menuId BINARY(16) NOT NULL,
  dishId BINARY(16) NOT NULL,
  dishSlot VARCHAR(100) NULL,
  displayOrder INT NOT NULL DEFAULT 1,
  FOREIGN KEY (menuId) REFERENCES menus(menuId),
  FOREIGN KEY (dishId) REFERENCES dishes(dishId)
) ENGINE = InnoDB;

CREATE TABLE menuschedules (
  menuScheduleId BINARY(16) PRIMARY KEY,
  customerId BINARY(16) NOT NULL,
  menuId BINARY(16) NOT NULL,
  serviceDate DATE NOT NULL,
  weekStartDate DATE NOT NULL,
  shiftName ENUM('MORNING','AFTERNOON') NOT NULL,
  menuPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
  bomRatePercent DECIMAL(5,2) NOT NULL DEFAULT 100,
  status ENUM('DRAFT','CONFIRMED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  FOREIGN KEY (customerId) REFERENCES customers(customerId),
  FOREIGN KEY (menuId) REFERENCES menus(menuId),
  UNIQUE KEY uqMenuSchedulesCustomerDateShift (customerId, serviceDate, shiftName)
) ENGINE = InnoDB;

CREATE TABLE quantityimportbatches (
  importBatchId BINARY(16) PRIMARY KEY,
  batchCode VARCHAR(50) NOT NULL UNIQUE,
  sourceCompanyName VARCHAR(200) NULL,
  sourceType ENUM('EXCEL','API','EMAIL','MANUAL') NOT NULL DEFAULT 'MANUAL',
  importedBy BINARY(16) NULL,
  importedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('RECEIVED','VALIDATED','CONFIRMED','REJECTED') NOT NULL DEFAULT 'RECEIVED',
  FOREIGN KEY (importedBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE mealquantityplans (
  quantityPlanId BINARY(16) PRIMARY KEY,
  importBatchId BINARY(16) NULL,
  planCode VARCHAR(50) NOT NULL UNIQUE,
  serviceDate DATE NOT NULL,
  status ENUM('DRAFT','FORECASTED','CONFIRMED','ADJUSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  forecastReceivedAt DATETIME NULL,
  confirmedAt DATETIME NULL,
  confirmationTime TIME NOT NULL DEFAULT '08:30:00',
  confirmedBy BINARY(16) NULL,
  FOREIGN KEY (importBatchId) REFERENCES quantityimportbatches(importBatchId),
  FOREIGN KEY (confirmedBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE mealquantityplanlines (
  quantityPlanLineId BINARY(16) PRIMARY KEY,
  quantityPlanId BINARY(16) NOT NULL,
  menuScheduleId BINARY(16) NOT NULL,
  customerId BINARY(16) NOT NULL,
  menuId BINARY(16) NOT NULL,
  shiftName ENUM('MORNING','AFTERNOON') NOT NULL,
  forecastServings INT NOT NULL DEFAULT 0,
  confirmedServings INT NOT NULL DEFAULT 0,
  adjustedServings INT NOT NULL DEFAULT 0,
  finalServings INT NOT NULL DEFAULT 0,
  FOREIGN KEY (quantityPlanId) REFERENCES mealquantityplans(quantityPlanId),
  FOREIGN KEY (menuScheduleId) REFERENCES menuschedules(menuScheduleId),
  FOREIGN KEY (customerId) REFERENCES customers(customerId),
  FOREIGN KEY (menuId) REFERENCES menus(menuId)
) ENGINE = InnoDB;

CREATE TABLE quantityadjustments (
  adjustmentId BINARY(16) PRIMARY KEY,
  quantityPlanLineId BINARY(16) NOT NULL,
  oldServings INT NOT NULL,
  newServings INT NOT NULL,
  reason TEXT NULL,
  adjustedBy BINARY(16) NOT NULL,
  adjustedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quantityPlanLineId) REFERENCES mealquantityplanlines(quantityPlanLineId),
  FOREIGN KEY (adjustedBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE productionplans (
  planId BINARY(16) PRIMARY KEY,
  planCode VARCHAR(50) NOT NULL UNIQUE,
  planDate DATE NOT NULL,
  status ENUM('CREATED','SENTTOKITCHEN','COMPLETED','CANCELLED') NOT NULL DEFAULT 'CREATED',
  createdBy BINARY(16) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (createdBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE productionplanlines (
  planLineId BINARY(16) PRIMARY KEY,
  planId BINARY(16) NOT NULL,
  quantityPlanLineId BINARY(16) NOT NULL,
  customerId BINARY(16) NOT NULL,
  menuId BINARY(16) NOT NULL,
  dishId BINARY(16) NOT NULL,
  shiftName ENUM('MORNING','AFTERNOON') NOT NULL,
  totalServings INT NOT NULL DEFAULT 0,
  FOREIGN KEY (planId) REFERENCES productionplans(planId),
  FOREIGN KEY (quantityPlanLineId) REFERENCES mealquantityplanlines(quantityPlanLineId),
  FOREIGN KEY (customerId) REFERENCES customers(customerId),
  FOREIGN KEY (menuId) REFERENCES menus(menuId),
  FOREIGN KEY (dishId) REFERENCES dishes(dishId)
) ENGINE = InnoDB;

CREATE TABLE materialrequests (
  requestId BINARY(16) PRIMARY KEY,
  requestCode VARCHAR(50) NOT NULL UNIQUE,
  planId BINARY(16) NOT NULL,
  requestDate DATE NOT NULL,
  requestScope ENUM('FULLDAY','MORNING','AFTERNOON') NOT NULL DEFAULT 'FULLDAY',
  status ENUM('DRAFT','MANAGERAPPROVED','SENTTOWAREHOUSE','EXPORTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  createdBy BINARY(16) NOT NULL,
  approvedBy BINARY(16) NULL,
  approvedAt DATETIME NULL,
  FOREIGN KEY (planId) REFERENCES productionplans(planId),
  FOREIGN KEY (createdBy) REFERENCES users(userId),
  FOREIGN KEY (approvedBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE materialrequestlines (
  requestLineId BINARY(16) PRIMARY KEY,
  requestId BINARY(16) NOT NULL,
  planLineId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  totalServings INT NOT NULL DEFAULT 0,
  grossQtyPerServing DECIMAL(18,6) NOT NULL DEFAULT 0,
  bomRatePercent DECIMAL(5,2) NOT NULL DEFAULT 100,
  totalRequiredQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  currentStockQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  suggestedPurchaseQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  FOREIGN KEY (requestId) REFERENCES materialrequests(requestId),
  FOREIGN KEY (planLineId) REFERENCES productionplanlines(planLineId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId) REFERENCES units(unitId)
) ENGINE = InnoDB;

CREATE TABLE purchaserequests (
  purchaseRequestId BINARY(16) PRIMARY KEY,
  purchaseRequestCode VARCHAR(50) NOT NULL UNIQUE,
  requestDate DATE NOT NULL,
  purchaseForDate DATE NOT NULL,
  shiftName ENUM('MORNING','AFTERNOON') NULL,
  status ENUM('DRAFT','SENTTOSUPPLIER','APPROVED','REJECTED','SENTTOWAREHOUSE','PARTIALRECEIVED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  createdBy BINARY(16) NOT NULL,
  approvedBy BINARY(16) NULL,
  approvedAt DATETIME NULL,
  FOREIGN KEY (createdBy) REFERENCES users(userId),
  FOREIGN KEY (approvedBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE purchaserequestlines (
  purchaseRequestLineId BINARY(16) PRIMARY KEY,
  purchaseRequestId BINARY(16) NOT NULL,
  materialRequestLineId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  supplierId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  requiredQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  currentStockQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  purchaseQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  estimatedUnitPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (purchaseRequestId) REFERENCES purchaserequests(purchaseRequestId),
  FOREIGN KEY (materialRequestLineId) REFERENCES materialrequestlines(requestLineId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (supplierId) REFERENCES suppliers(supplierId),
  FOREIGN KEY (unitId) REFERENCES units(unitId)
) ENGINE = InnoDB;

CREATE TABLE inventoryreceipts (
  receiptId BINARY(16) PRIMARY KEY,
  receiptCode VARCHAR(50) NOT NULL UNIQUE,
  receiptDate DATE NOT NULL,
  warehouseId BINARY(16) NOT NULL,
  supplierId BINARY(16) NOT NULL,
  purchaseRequestId BINARY(16) NULL,
  createdBy BINARY(16) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  FOREIGN KEY (supplierId) REFERENCES suppliers(supplierId),
  FOREIGN KEY (purchaseRequestId) REFERENCES purchaserequests(purchaseRequestId),
  FOREIGN KEY (createdBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE inventoryreceiptlines (
  receiptLineId BINARY(16) PRIMARY KEY,
  receiptId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  quantity DECIMAL(18,6) NOT NULL DEFAULT 0,
  unitPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
  amount DECIMAL(18,2) GENERATED ALWAYS AS (quantity * unitPrice) STORED,
  lotNumber VARCHAR(100) NULL,
  manufactureDate DATE NULL,
  expiredDate DATE NULL,
  FOREIGN KEY (receiptId) REFERENCES inventoryreceipts(receiptId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId) REFERENCES units(unitId)
) ENGINE = InnoDB;

CREATE TABLE inventoryissues (
  issueId BINARY(16) PRIMARY KEY,
  issueCode VARCHAR(50) NOT NULL UNIQUE,
  issueDate DATE NOT NULL,
  shiftName ENUM('MORNING','AFTERNOON') NULL,
  warehouseId BINARY(16) NOT NULL,
  materialRequestId BINARY(16) NOT NULL,
  issuedBy BINARY(16) NOT NULL,
  receivedBy BINARY(16) NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  FOREIGN KEY (materialRequestId) REFERENCES materialrequests(requestId),
  FOREIGN KEY (issuedBy) REFERENCES users(userId),
  FOREIGN KEY (receivedBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE inventoryissuelines (
  issueLineId BINARY(16) PRIMARY KEY,
  issueId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  requestedQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  issuedQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  FOREIGN KEY (issueId) REFERENCES inventoryissues(issueId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId) REFERENCES units(unitId)
) ENGINE = InnoDB;

CREATE TABLE inventoryreturns (
  returnId BINARY(16) PRIMARY KEY,
  returnCode VARCHAR(50) NOT NULL UNIQUE,
  returnDate DATE NOT NULL,
  shiftName ENUM('MORNING','AFTERNOON') NULL,
  warehouseId BINARY(16) NOT NULL,
  issueId BINARY(16) NOT NULL,
  reason TEXT NULL,
  createdBy BINARY(16) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  FOREIGN KEY (issueId) REFERENCES inventoryissues(issueId),
  FOREIGN KEY (createdBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE inventoryreturnlines (
  returnLineId BINARY(16) PRIMARY KEY,
  returnId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  quantity DECIMAL(18,6) NOT NULL DEFAULT 0,
  FOREIGN KEY (returnId) REFERENCES inventoryreturns(returnId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId) REFERENCES units(unitId)
) ENGINE = InnoDB;

CREATE TABLE stockmovements (
  movementId BINARY(16) PRIMARY KEY,
  movementDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  warehouseId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  movementType ENUM('RECEIPT','ISSUE','RETURN','ADJUSTMENT') NOT NULL,
  refTable VARCHAR(80) NULL,
  refId BINARY(16) NULL,
  quantityIn DECIMAL(18,6) NOT NULL DEFAULT 0,
  quantityOut DECIMAL(18,6) NOT NULL DEFAULT 0,
  beforeQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  afterQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  lotNumber VARCHAR(100) NULL,
  manufactureDate DATE NULL,
  expiredDate DATE NULL,
  reason TEXT NULL,
  note TEXT NULL,
  performedBy BINARY(16) NOT NULL,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId) REFERENCES units(unitId),
  FOREIGN KEY (performedBy) REFERENCES users(userId)
) ENGINE = InnoDB;

CREATE TABLE currentstocklots (
  lotStockId BINARY(16) PRIMARY KEY,
  warehouseId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  lotNumber VARCHAR(100) NULL,
  manufactureDate DATE NULL,
  expiredDate DATE NULL,
  currentQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  lastUpdated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId) REFERENCES units(unitId)
) ENGINE = InnoDB;

CREATE TABLE stocksnapshots (
  snapshotId BINARY(16) PRIMARY KEY,
  warehouseId BINARY(16) NOT NULL,
  ingredientId BINARY(16) NOT NULL,
  unitId BINARY(16) NOT NULL,
  periodMonth DATE NOT NULL,
  openingQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  quantityIn DECIMAL(18,6) NOT NULL DEFAULT 0,
  quantityOut DECIMAL(18,6) NOT NULL DEFAULT 0,
  closingQty DECIMAL(18,6) NOT NULL DEFAULT 0,
  generatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  FOREIGN KEY (ingredientId) REFERENCES ingredients(ingredientId),
  FOREIGN KEY (unitId) REFERENCES units(unitId)
) ENGINE = InnoDB;

CREATE INDEX ixAuditLogsChangedBy ON auditlogs(changedBy, changedAt);
CREATE INDEX ixDishBomDishEffective ON dishbom(dishId, effectiveFrom, effectiveTo);
CREATE INDEX ixMenuSchedulesWeek ON menuschedules(weekStartDate, serviceDate, shiftName, customerId);
CREATE INDEX ixMealQuantityPlansDate ON mealquantityplans(serviceDate, status, confirmedAt);
CREATE INDEX ixMaterialRequestsPlan ON materialrequests(planId, status);
CREATE INDEX ixPurchaseRequestsDate ON purchaserequests(purchaseForDate, status);
CREATE INDEX ixInventoryReceiptLinesExpiry ON inventoryreceiptlines(ingredientId, expiredDate, lotNumber);
CREATE INDEX ixStockMovementsLookup ON stockmovements(warehouseId, ingredientId, movementDate);
CREATE INDEX ixStockMovementsIngredientDate ON stockmovements(ingredientId, movementDate);
CREATE INDEX ixStockMovementsTypeDate ON stockmovements(movementType, movementDate);
CREATE INDEX ixStockMovementsRef ON stockmovements(refTable, refId);
CREATE INDEX ixCurrentStockLotsFefo ON currentstocklots(warehouseId, ingredientId, expiredDate, lotNumber);
CREATE INDEX ixCurrentStockLotsIdentity ON currentstocklots(warehouseId, ingredientId, unitId, lotNumber, manufactureDate, expiredDate);
CREATE UNIQUE INDEX ixStockSnapshotsIdentity ON stocksnapshots(warehouseId, ingredientId, unitId, periodMonth);
CREATE INDEX ixStockSnapshotsPeriod ON stocksnapshots(periodMonth, warehouseId, ingredientId);

CREATE UNIQUE INDEX ixRefreshTokensHash ON refreshtokens(tokenHash);
CREATE INDEX ixRefreshTokensUserExpiry ON refreshtokens(userId, expiresAt);
CREATE INDEX ix_currentstock_ingredient ON currentstock(ingredientId);
CREATE INDEX IX_currentstock_unitId ON currentstock(unitId);

