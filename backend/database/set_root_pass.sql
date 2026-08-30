ALTER USER 'root'@'localhost' IDENTIFIED BY '123456';
FLUSH PRIVILEGES;

USE ipcmanagement;
UPDATE warehouses SET IsOperationalActive = 0;
UPDATE warehouses SET IsOperationalActive = 1 WHERE warehouseId = UNHEX(REPLACE('ead76aad-c02e-4b49-9e59-90efa2d042e1', '-', '')) OR warehouseCode LIKE '%KHO%' OR warehouseName LIKE '%Kho%' LIMIT 1;
