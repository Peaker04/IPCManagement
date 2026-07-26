-- ============================================================
-- 01-enable-diagnostics.sql
-- Bật các cơ chế chẩn đoán hiệu năng của MySQL 8 (chạy bằng root).
-- Chạy TRƯỚC khi bắt đầu phiên đo hiệu năng.
-- Lưu ý: các SET GLOBAL này mất hiệu lực khi restart MySQL.
-- ============================================================

-- 1. Slow query log: ghi mọi truy vấn chậm hơn 0.5 giây
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 0.5;
SET GLOBAL log_output = 'TABLE';          -- ghi vào mysql.slow_log để dễ SELECT
TRUNCATE TABLE mysql.slow_log;            -- xoá dữ liệu cũ trước phiên đo

-- 2. Tạm thời ghi cả truy vấn không dùng chỉ mục (TẮT lại sau phiên đo!)
SET GLOBAL log_queries_not_using_indexes = ON;
SET GLOBAL min_examined_row_limit = 1000; -- bỏ qua các truy vấn quét < 1000 dòng cho đỡ nhiễu

-- 3. Reset bộ đếm thống kê để số liệu chỉ phản ánh phiên đo hiện tại
TRUNCATE TABLE performance_schema.events_statements_summary_by_digest;

-- 4. Xác nhận cấu hình
SELECT @@slow_query_log      AS slow_log_on,
       @@long_query_time     AS threshold_sec,
       @@log_output          AS log_output,
       @@log_queries_not_using_indexes AS log_no_index,
       @@innodb_buffer_pool_size / 1024 / 1024 AS buffer_pool_mb;
