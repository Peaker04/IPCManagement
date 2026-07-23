# Iter1 Portion Rule Spec

## Muc tieu

Tai lieu nay chot quy tac khau phan cho workflow Thuc don tuan -> KHSX -> demand nguyen lieu -> de xuat mua hang. Muc tieu la khong de logic production phai nhan he so cung trong code, vi cung mot thuc don co the tinh khac nhau theo khach hang, ca phuc vu, loai menu, ngay, mon an va loai dong trong file Excel.

Trong Iter1 hien tai, he thong dang co:

- Contract khach hang: gia ban mac dinh va `defaultBomRatePercent`.
- Menu schedule: `MenuPrice`, `BomRatePercent`, khach hang, ngay, ca, menu.
- Meal quantity plan: so suat da chot, hoac tam thoi dung so suat import default khi chua co file so suat.
- BOM mon an: dinh luong nguyen lieu tren mot suat.

Portion rule la lop dieu khien nam giua so suat va BOM, de tra loi cau hoi: "voi khach hang/ca/menu/mon nay, can dung bao nhieu phan dinh luong so voi BOM catalog?"

## Pham vi nghiep vu

Rule ap dung khi sinh:

- KHSX line tu menu schedule.
- Material demand line tu KHSX + BOM.
- Purchase suggestion tu demand + ton kho.
- Cost view theo mon/ngay/tuan.
- Audit trace cho nguoi dung biet tai sao so lieu duoc tinh ra.

Rule khong thay the BOM catalog. BOM van la dinh luong goc cua mon an. Portion rule chi dieu chinh cach BOM duoc ap dung theo boi canh van hanh.

## Thu tu uu tien

Neu co nhieu rule cung khop mot dong KHSX, he thong phai chon dung mot rule theo thu tu sau:

1. Dish override
   - Rule gan truc tiep cho `dishId`.
   - Dung khi mot mon co dinh luong rieng cho khach hang/ca/ngay.
   - Vi du: DAV - ca sang - "Mi Quang Tom Thit" dung 100%, nhung ANV - ca sang cung mon do dung 92%.

2. Category / variant / slot rule
   - Rule theo nhom mon hoac dong trong file: `Mon chinh`, `Phu 1`, `Phu 2`, `Rau`, `Canh`, `Trai cay`, `Sua chua`.
   - Co the ket hop voi menu variant: `Man`, `Chay`, `Diet`, `Special`.
   - Dung khi chua co rule rieng cho mon, nhung co quy tac chung cho loai dong.

3. Customer + shift + date rule
   - Rule theo khach hang, ca phuc vu va ngay/thu.
   - Dung khi customer co ty le chung cho ca sang/ca chieu hoac ngay dac biet.

4. Customer contract default
   - Lay tu contract dang hieu luc cua khach hang.
   - Hien tai tuong ung `CustomerContract.DefaultBomRatePercent` va `MenuSchedule.BomRatePercent`.

5. System fallback for demo only
   - Chi duoc phep dung trong demo/MVP khi chua co quantity/portion data chuan.
   - Phai hien thi ro tren UI la tam thoi, vi du `Tam tu import`.
   - Khong duoc dung im lang trong production.

Thu tu tren la acceptance chinh cua PRD-040: `dish override > category > customer default`.

## Du lieu rule de xuat

Mot portion rule can co cac truong toi thieu:

| Truong | Bat buoc | Y nghia |
| --- | --- | --- |
| `portionRuleId` | Co | Khoa chinh/audit trace |
| `customerId` | Co | Rule luon phai gan voi khach hang hoac explicit system default |
| `effectiveFrom` | Co | Ngay bat dau hieu luc |
| `effectiveTo` | Khong | Ngay ket thuc hieu luc |
| `activeWeekDays` | Khong | Thu ap dung: `t2,t3,t4,t5,t6,t7,cn` |
| `shiftNames` | Khong | `MORNING`, `AFTERNOON`, `EVENING` |
| `menuVariant` | Khong | `MAN`, `CHAY`, `DIET`, `SPECIAL` |
| `menuSectionName` | Khong | Ten section file, vi du `MENU MAN CA SANG` |
| `slotName` | Khong | `MON_CHINH`, `PHU_1`, `PHU_2`, `RAU`, `CANH`, `TRAI_CAY`, `SUA_CHUA` |
| `dishId` | Khong | Neu co thi la dish override |
| `dishCategory` | Khong | Nhom mon/danh muc catalog |
| `portionRatePercent` | Co | Ty le ap dung len BOM goc |
| `bomRatePercent` | Khong | Ty le hao hut/phan tram BOM rieng, override schedule neu co |
| `yieldLossPercent` | Khong | Hao hut so che neu can tach rieng |
| `priority` | Co | Uu tien noi bo khi cung cap do dac hieu |
| `status` | Co | `ACTIVE`, `DRAFT`, `INACTIVE` |
| `reason` | Co | Ly do tao/cap nhat |

## Quy tac validate

- `portionRatePercent` phai lon hon 0 va khong vuot nguong cau hinh. Mac dinh de xuat: 1-300%.
- `bomRatePercent` neu co phai lon hon 0 va khong vuot 300%.
- `effectiveTo` neu co khong duoc truoc `effectiveFrom`.
- Khong cho hai rule `ACTIVE` bi overlap trong cung do dac hieu va cung thoi gian.
- Neu rule co `dishId`, dish phai ton tai va dang active.
- Neu rule co `slotName`, slot phai nam trong danh muc slot da chuan hoa cua importer.
- Neu rule co `menuVariant`, importer phai map duoc variant tu section/file layout.
- Neu khong tim duoc rule production, he thong phai:
  - cho phep demo fallback neu mode demo/MVP dang bat;
  - hien thi canh bao trong KHSX/demand/cost;
  - ghi audit ly do fallback;
  - khong duoc coi la du lieu chuan.

## Hop dong tinh toan

Input cho moi dong tinh demand:

- Khach hang.
- Ngay phuc vu.
- Ca phuc vu.
- Menu schedule.
- Menu section/layout row.
- Dish.
- So suat final.
- BOM active cua dish.
- Ton kho hien tai cua tung nguyen lieu.

Cong thuc de xuat:

```text
baseRequirement = finalServings * bom.grossQtyPerServing
portionAdjusted = baseRequirement * portionRule.portionRatePercent / 100
bomAdjusted = portionAdjusted * appliedBomRatePercent / 100
lossAdjusted = bomAdjusted / yieldRate
requiredQty = roundQuantity(lossAdjusted)
suggestedPurchaseQty = max(requiredQty - currentStockQty, 0)
```

Trong do:

- `appliedBomRatePercent` uu tien lay tu portion rule neu co, sau do den menu schedule, sau do den customer contract default.
- `yieldRate = 1 - yieldLossPercent / 100`. Neu chua cau hinh hao hut rieng, mac dinh `yieldRate = 1`.
- Round theo `DecimalPolicy.RoundQuantity`.
- Don vi phai quy doi ve don vi BOM truoc khi tru ton kho.

## Trace bat buoc

Moi dong KHSX/demand/cost nen co snapshot de UI va audit giai thich duoc:

| Truong | Y nghia |
| --- | --- |
| `appliedPortionRuleId` | Rule duoc chon |
| `appliedPortionRuleSource` | `DISH_OVERRIDE`, `CATEGORY_SLOT`, `CUSTOMER_SHIFT`, `CONTRACT_DEFAULT`, `DEMO_FALLBACK` |
| `appliedPortionRatePercent` | Ty le portion da ap dung |
| `appliedBomRatePercent` | Ty le BOM da ap dung |
| `servingSource` | `CONFIRMED_QUANTITY`, `DEFAULT_IMPORT`, `MANUAL_OVERRIDE` |
| `calculationSnapshot` | Chuoi JSON ngan hoac DTO de audit |

Neu `servingSource = DEFAULT_IMPORT` hoac `appliedPortionRuleSource = DEMO_FALLBACK`, UI phai hien thi canh bao ro rang.

## UI yeu cau

Trang Thuc don tuan:

- `Ke hoach tuan`: hien thi menu goc theo file khach hang, khong chen thong tin rule vao o mon.
- `KHSX va nhu cau`: moi dong can co mon trong ke hoach, so suat, trang thai BOM, nguon so suat, va sau nay nguon portion rule.
- `Tong hop mua`: tong hop theo customer dang chon, tu demand cua customer do, khong duoc tron voi customer khac.
- `Gia von`: giu flow chon mon va xem gia von theo mon; khi co portion rule thi hien rule dang ap dung.
- `Nguyen lieu mon`: hien BOM/portion cua mon dang chon, khong thay the bang tong hop mua.

Admin/Contract:

- Contract default chi la fallback cua khach hang.
- Rule chi tiet nen nam o surface rieng `Portion Rules` hoac trong tab Contract, co filter theo customer.
- Khi update rule, phai ghi audit `PortionRule`.

## API/schema de xuat cho task tiep theo

Backend API:

- `GET /api/coordination/portion-rules?customerId=&effectiveDate=&shiftName=&dishId=`
- `POST /api/coordination/portion-rules`
- `PUT /api/coordination/portion-rules/{id}`
- `POST /api/coordination/portion-rules/resolve`

Resolve request toi thieu:

```json
{
  "customerId": "uuid",
  "serviceDate": "2026-06-30",
  "shiftName": "MORNING",
  "menuVariant": "MAN",
  "menuSectionName": "MENU MAN CA SANG",
  "slotName": "MON_CHINH",
  "dishId": "uuid"
}
```

Resolve response toi thieu:

```json
{
  "portionRuleId": "uuid",
  "source": "DISH_OVERRIDE",
  "portionRatePercent": 100,
  "bomRatePercent": 100,
  "warnings": []
}
```

Database de xuat:

- Them bang `portionrules`.
- Them cac cot trace vao `productionplanlines` va/hoac `materialrequestlines` neu can audit snapshot sau khi rule thay doi.
- Khong sua BOM catalog de luu rule khach hang, vi BOM la dinh luong goc cua mon.

## Acceptance PRD-040

- Co thu tu uu tien rule ro rang: dish override > category/variant/slot > customer/shift/date > customer contract default > demo fallback.
- Khong chap nhan production logic nhan he so cung ma khong co source/audit.
- Co validate overlap/effective date/status.
- Co hop dong tinh toan cho demand va cost.
- Co trace fields de UI giai thich duoc so lieu.
- Co dinh huong API/schema cho PRD-041/PRD-042.

