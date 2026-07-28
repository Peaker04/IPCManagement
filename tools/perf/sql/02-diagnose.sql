-- ============================================================
-- 02-diagnose.sql
-- Bộ truy vấn chẩn đoán hiệu năng — chạy SAU khi đã tái hiện
-- thao tác chậm hoặc sau khi chạy load test k6.
-- Mỗi khối chạy riêng, đọc kết quả theo chú thích.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- A. TOP truy vấn chậm nhất theo tổng thời gian tích luỹ
--    (nguồn số 1 để biết phải tối ưu truy vấn nào trước)
-- ────────────────────────────────────────────────────────────
SELECT SUBSTRING(digest_text, 1, 120)                       AS query_sample,
       count_star                                           AS calls,
       ROUND(sum_timer_wait / 1e12, 2)                      AS total_sec,
       ROUND(avg_timer_wait / 1e9, 1)                       AS avg_ms,
       ROUND(max_timer_wait / 1e9, 1)                       AS max_ms,
       sum_rows_examined                                    AS rows_examined,
       sum_rows_sent                                        AS rows_sent,
       ROUND(sum_rows_examined / GREATEST(sum_rows_sent,1)) AS examine_per_sent
FROM performance_schema.events_statements_summary_by_digest
WHERE schema_name IS NOT NULL
  AND schema_name NOT IN ('mysql','performance_schema','sys','information_schema')
ORDER BY sum_timer_wait DESC
LIMIT 20;
-- Đọc kết quả: examine_per_sent lớn (>100) = quét nhiều mà trả về ít
-- → thiếu chỉ mục hoặc điều kiện lọc không dùng được chỉ mục.

-- ────────────────────────────────────────────────────────────
-- B. Truy vấn gây quét toàn bảng (full table scan)
-- ────────────────────────────────────────────────────────────
SELECT query, exec_count, total_latency, rows_examined_avg, no_index_used_count
FROM sys.statements_with_full_table_scans
ORDER BY no_index_used_count DESC
LIMIT 20;

-- ────────────────────────────────────────────────────────────
-- C. Truy vấn phải tạo bảng tạm trên đĩa / sort nặng
-- ────────────────────────────────────────────────────────────
SELECT query, exec_count, total_latency,
       tmp_disk_tables, tmp_tables, sort_merge_passes
FROM sys.statements_with_temp_tables
ORDER BY tmp_disk_tables DESC, tmp_tables DESC
LIMIT 20;

-- ────────────────────────────────────────────────────────────
-- D. Slow log chi tiết của phiên đo (đã bật ở file 01)
-- ────────────────────────────────────────────────────────────
SELECT start_time,
       ROUND(TIME_TO_SEC(query_time) + MICROSECOND(query_time)/1e6, 2) AS sec,
       rows_examined, rows_sent,
       SUBSTRING(CONVERT(sql_text USING utf8mb4), 1, 200)               AS sql_text
FROM mysql.slow_log
ORDER BY query_time DESC
LIMIT 30;

-- ────────────────────────────────────────────────────────────
-- E. Chỉ mục chưa từng được sử dụng (cân nhắc xoá bớt)
-- ────────────────────────────────────────────────────────────
SELECT * FROM sys.schema_unused_indexes
WHERE object_schema NOT IN ('mysql','sys')
LIMIT 50;

-- ────────────────────────────────────────────────────────────
-- F. Khoá ngoại / cột lọc THIẾU chỉ mục (nguy cơ khoá diện rộng)
--    Liệt kê các bảng bị quét toàn bộ nhiều lần
-- ────────────────────────────────────────────────────────────
SELECT object_schema, object_name, rows_full_scanned, latency
FROM sys.schema_tables_with_full_table_scans
ORDER BY rows_full_scanned DESC
LIMIT 20;

-- ────────────────────────────────────────────────────────────
-- G. Bảng tiêu tốn I/O nhiều nhất
-- ────────────────────────────────────────────────────────────
SELECT table_schema, table_name, rows_fetched, rows_inserted, rows_updated,
       io_read_latency, io_write_latency
FROM sys.schema_table_statistics
WHERE table_schema NOT IN ('mysql','sys')
ORDER BY rows_fetched DESC
LIMIT 20;

-- ────────────────────────────────────────────────────────────
-- H. Deadlock gần nhất (nếu nghi ngờ tranh chấp khoá)
-- ────────────────────────────────────────────────────────────
SHOW ENGINE INNODB STATUS\G
-- Tìm mục "LATEST DETECTED DEADLOCK" trong kết quả.

-- ────────────────────────────────────────────────────────────
-- I. Kiểm tra một truy vấn cụ thể: dán truy vấn từ slow log vào đây
--    EXPLAIN ANALYZE cho thời gian THỰC TẾ từng bước (MySQL 8+)
-- ────────────────────────────────────────────────────────────
-- EXPLAIN ANALYZE <dán truy vấn chậm vào đây>;
