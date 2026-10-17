# Mẫu HANDOFF.md

Quy tắc điền:
- Mọi giá trị `<...>` phải lấy từ dữ liệu đã kiểm tra trong phiên. Không biết thì ghi `UNKNOWN`, không đoán.
- Phần "Đọc trước" giữ ngắn. Log, ảnh, báo cáo dài để file riêng và dẫn link.
- Bảng không có nội dung thì ghi `Không có`, không để hàng mẫu `<...>`.

Sao chép nội dung trong khối dưới đây:

````markdown
# Bàn giao: <tên nhiệm vụ>

## Đọc trước
- Handoff ID: <YYYY-MM-DD-HHMM-slug>
- Thời điểm (múi giờ): <...>
- Phiên/agent giao: <định danh nếu có>
- Mục tiêu: <kết quả mong muốn, 1 câu>
- Chế độ làm việc: <vd TEST FIRST / OBSERVE & REPORT / NO FIX, hoặc được phép FIX>
- Điểm dừng: <đang làm tới đâu>
- Việc đầu tiên tiếp theo: <1 hành động cụ thể>
- Blocker chính: <nội dung, hoặc Không có>

## 1. Yêu cầu, quyền hạn và phạm vi
- Nguồn yêu cầu: <lời user hoặc tài liệu đã duyệt>
- Tiêu chí hoàn thành: <kiểm tra được>
- Được làm: <...>
- Không được làm: <...>
- Người có quyền đổi phạm vi: <...>

## 2. Snapshot
Mỗi repo liên quan một bảng.

| Trường | Giá trị đã xác minh |
|---|---|
| Repo / thư mục làm việc | <...> |
| Branch / commit | <...> |
| Staged / unstaged / untracked | <...> |
| Thay đổi agent nhận chưa thấy được (chỉ có ở máy giao, chưa push...) | <...> |
| Build / bản đang chạy để kiểm thử | <...> |
| Môi trường, runtime | <...> |
| Dữ liệu thử, migration liên quan | <...> |
| Tiến trình đang chạy hoặc bị ngắt | <...> |
| MCP / skill / cấu hình cần có | <...> |

## 3. Tiến độ
| ID | Hạng mục | Trạng thái | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| <...> | <...> | <DONE_VERIFIED / DONE_UNVERIFIED / IN_PROGRESS / TODO / BLOCKED> | <...> | <...> |

## 4. Quyết định và giả thuyết
| ID | Nội dung | Loại | Lý do / bằng chứng | Người xác nhận |
|---|---|---|---|---|
| <...> | <...> | <đã chốt / đề xuất / giả thuyết> | <...> | <...> |

## 5. Đã thử nhưng không thành công
| Cách đã thử | Kết quả | Bằng chứng | Cần thay đổi gì trước khi thử lại |
|---|---|---|---|
| <...> | <...> | <...> | <...> |

## 6. Kiểm thử
- Tầng / vòng hiện tại: <...>
- Test plan: <đường dẫn>
- Kết quả thuộc commit/build: <...>
- Kết quả có thể đã cũ vì: <code hoặc môi trường đã đổi sau lần chạy>

| Case ID | Lệnh / bước chạy | Số lượt đã chạy | Kết quả từng lượt | Bằng chứng |
|---|---|---|---|---|
| <...> | <...> | <...> | <PASS / FAIL / FLAKY / BLOCKED / NOT_RUN> | <...> |

## 7. Nguồn cần đọc
| Thứ tự | File / nguồn | Lý do cần đọc | Truy cập |
|---|---|---|---|
| <...> | <...> | <...> | <đã kiểm tra / MISSING / NOT_ACCESSIBLE> |

## 8. Bước tiếp theo
| Ưu tiên | Việc cần làm | Điều kiện bắt đầu | Tiêu chí hoàn thành |
|---|---|---|---|
| <...> | <...> | <...> | <...> |

## 9. Chưa biết và xung đột
- UNKNOWN: <...>
- Giả định chưa chốt: <...>
- Xung đột giữa đặc tả, code và log: <...>
- Rủi ro nếu làm tiếp khi chưa giải quyết: <...>

## 10. Prompt tiếp nhận
```text
Tiếp nhận bàn giao tại <đường dẫn tuyệt đối tới file này>.
Bắt đầu ở chế độ READ & VERIFY: chưa sửa mã sản phẩm, chưa chạy tác vụ có tác động.
Đọc CLAUDE.md, rồi file bàn giao, sau đó đối chiếu git và môi trường với mục 2.
Trước khi làm, trả lời: A. mục tiêu; B. quyền hạn và điều cấm; C. phần đã và chưa kiểm chứng;
D. phần thiếu hoặc mâu thuẫn; E. việc đầu tiên và tiêu chí hoàn thành.
Mục tiêu: <...>. Điều cấm: <...>. Việc đầu tiên: <...>.
```
````
