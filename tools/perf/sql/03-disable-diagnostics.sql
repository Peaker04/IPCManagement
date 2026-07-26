-- ============================================================
-- 03-disable-diagnostics.sql
-- Tắt các log chẩn đoán sau phiên đo để log không phình.
-- ============================================================

SET GLOBAL log_queries_not_using_indexes = OFF;
SET GLOBAL long_query_time = 1.0;   -- giữ slow log ở ngưỡng 1s cho vận hành thường ngày
-- Giữ slow_query_log = ON ở ngưỡng 1s là khuyến nghị; nếu muốn tắt hẳn:
-- SET GLOBAL slow_query_log = OFF;

SELECT @@slow_query_log, @@long_query_time, @@log_queries_not_using_indexes;
