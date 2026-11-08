# UI conformance — candidate cần Kỳ xác nhận

File này chưa phải conformance matrix và không candidate nào được coi là bug cho tới
khi Kỳ chỉ đúng phần tử trên UI. Mỗi candidate được xác nhận phải có screenshot,
selector/component và harm cụ thể.

## Bảy candidate có dấu vết

- [ ] Locale và số chữ số thập phân không nhất quán.
- [ ] Panel không giữ chiều cao khi cold load/refetch nên layout nhảy.
- [ ] Audit/Nhân viên quá nặng ở lượt mở đầu.
- [ ] Admin có quá nhiều tab cho một work object.
- [ ] Số lượng thiếu đơn vị hoặc không cho biết đó là aggregate của nhiều source-line.
- [ ] Bảng tổng không ghi rõ “tổng cả tuần”.
- [ ] Reload/cache hiển thị trạng thái cũ so với API/DB.

Kỳ cần gạch candidate sai và bổ sung candidate thật cho đủ mười case. Với mỗi
màn ở viewport hẹp nhất, chỉ nhận lỗi trả lời được: phần tử nào làm người dùng
dừng lại, hoặc phải cuộn/đoán mới thao tác được.

## Golden reference

- Chọn ba màn IPC hiện có tương ứng list report, object page và worklist; không
  dùng screenshot Fiori mẫu.
- Lưu ảnh trong `docs/ui-golden/` và ghi SHA-256 vào `docs/EVIDENCE-INDEX.md`.
- Mỗi golden chỉ normative cho danh sách principle ID đi kèm, không phải pixel baseline.
- Luôn so cặp cùng một màn giữa viewport rộng nhất và hẹp nhất; phần tử bắt buộc
  bị mất khi thu hẹp là finding responsive độc lập với golden.

Sau khi Kỳ chốt case và golden, chuyển chúng thành ID nhị phân trong
`docs/UI-CONFORMANCE-MATRIX.md`, rồi mới viết assertion/autofix.
