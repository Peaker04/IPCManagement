# Warehouse and kitchen logistics

Canonical bounded owner for operational shortcuts, document matching and queues. Shared stock identity/grain/lifecycle belongs to [DOMAIN](../DOMAIN.md); MRX daily transactions belong to [MRX](material-reconciliation.md).

Routes: `/warehouse`, `/chef-dashboard`. This filename remains stable because a retained behavior-test inventory references it; no competing warehouse.md owner is created.

---

## 1. Operational Shortcuts & Navigation Boundaries

1. **Warehouse "Xem tồn kho" Shortcut:**  
   The "Xem tồn kho" shortcut on the Warehouse page navigates to `Tra cứu → Tồn kho hiện tại` within the `/warehouse` route for actors holding the `warehouse.read` permission.  
   - When the user is already on the stock sub-view, this shortcut is automatically suppressed.  
   - Analytical inventory reports (`/reports`) are separate analytical perspectives and must **never** be the destination of this operational shortcut.
2. **Kitchen Handover Shortcut ("Xem bàn giao tại Bếp"):**  
   The shortcut "Xem bàn giao tại Bếp" routes directly to `Ca sản xuất → Nhận & xử lý vật tư` for actors with `production.read` permission.  
   - It represents a navigation shortcut to the kitchen handover workbench, not an in-place mutation on a warehouse slip.  
   - A deep link to a specific slip ID is rendered **only** when the destination route has verified support for consuming that ID.
3. **Issue & Return Document Links ("Đến phân hệ"):**  
   Shared links targeting warehouse issue (`Phiếu xuất kho`) or return slips (`Phiếu hoàn trả`) are labeled generically as *"Đến phân hệ"*, never *"Mở phiếu"*.  
   - Direct links to the Kitchen module are visible only to actors with `production.read`.  
   - Unauthorized actors view document metadata and the designated Kitchen owner without interactive deep links.

---

## 2. Document Rail & Receiving Mechanics

1. **Document Rail Windowing:**  
   The operational document rail on the Warehouse page displays a maximum of the **20 latest operational documents** across the entire system.  
   - Pagination controls within the rail operate locally across this 20-document subset.  
   - The rail is an operational shortcut, not a complete searchable historical archive.
2. **Goods Receipt PO Detail Matching:**  
   When navigating to a receipt slip with an explicit ID (`receiptId`), the receiving panel matches the slip to its associated Purchase Order (PO) via backend data, including POs that may reside on subsequent pages of the list.  
   - If PO retrieval fails or the ID pair is invalid, the UI must display a clear error message.  
   - The UI must **never** substitute an unmatched slip with a different arbitrary receipt.

---

## 3. Surplus Reconciliation & Exception Queue Filtering

1. **Admin Surplus Default Filter:**  
   For Administrators, the surplus reconciliation view defaults to filtering by `allowedActions` as returned by the backend, ensuring immediate visibility into items requiring dispatch or adjustment.  
   - A toggle to "Tất cả số dư" (All balances) is preserved for audit and historical lookup.
2. **Non-Coordinating Role Views:**  
   Roles without coordination authority view all inventory balances without misleading action-queue badges or calls to action.
