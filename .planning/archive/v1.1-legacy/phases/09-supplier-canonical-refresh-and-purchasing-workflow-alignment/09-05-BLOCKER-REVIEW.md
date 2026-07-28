# Phase 09 Plan 05: Blocker Review

> Review-only artifact. It does not authorize a mapping, policy edit, reconciliation apply, or shared/live database mutation.

```yaml
approval_status: pending
accepted_mapping:
source_workbook_sha256: 4A91F9EA847068ABEB147EFF7ED7401B029D698F73E495641099DD9FA552BC88
manifest_hash: 7532E2FC55EA98AFA992DA1ABE20EB71AEEF7DFBC15C8F59946E662482306CE3
database_identity: ipc_lane1
database_fingerprint: 5FBA836102CB8CE9B1F25A7FAB7C5F9E97FA887E68981C86C11186B8B245A65B
blocker_count: 1174
unique_group_count: 104
```

## Review rules

- Every candidate and accepted mapping is blank until explicit human approval.
- Invalid and out-of-window dates are listed as evidence only; no corrected date is inferred.
- `09-05-BLOCKER-REVIEW.json` is canonical and contains every source sheet, row, raw value, and complete `raw_cells` object for all 1,174 occurrences.
- `09-05-BLOCKER-REVIEW.csv` is the group-level review sheet with all source references.

## Disposable lane lifecycle

```text
InitialRestore=ipc_e2e_template->ipc_lane1
InitialRestoreTableCount=56
InitialRestoreVerify=PASS
CaptureMigrations=20260721120000_AddPurchaseHistoryReconciliation,20260722160000_MakePurchaseRequestLineSupplierOptional
ReviewCaptureApplyRequestSent=false
SuccessfulReconciliationApply=false
RestoreBack=ipc_e2e_template->ipc_lane1
RestoreBackTableCount=56
RestoreBackVerify=PASS
VerifiedTemplateFingerprint=7813E4A8814A9DA4AAD8FA52D5EC3ED9868242950AD5DEB4BF45716FEBA25E41
ProtectedSqlSha256=B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53
ProtectedSqlPorcelain=?? backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql
ProtectedSqlTracked=false
```

The earlier checkpoint sent one exact apply request only as a negative guard probe. It returned HTTP 409 because blockers remained, and the manifest/database fingerprint stayed unchanged with zero reconciliation writes. This review capture sent no apply request.

## Reconciled totals

| Category | Blockers | Unique groups |
|---|---:|---:|
| DATE_AFTER_AS_OF_WINDOW | 28 | 1 |
| DATE_INVALID | 67 | 3 |
| INGREDIENT_CATALOG_AMBIGUOUS | 184 | 67 |
| INGREDIENT_MISSING | 23 | 1 |
| INGREDIENT_SUPPLIER_AMBIGUOUS | 4 | 4 |
| UNIT_AMBIGUOUS | 4 | 2 |
| UNIT_UNKNOWN | 864 | 26 |
| **TOTAL** | **1,174** | **104** |

## DATE_AFTER_AS_OF_WINDOW

| Group | Raw value | Current normalized | Count | Source examples | Candidate | Confidence | Approval |
|---|---|---|---:|---|---|---|---|
| 65111ADFCE8F | 49555 | 49555 | 28 | 1.Rau:1809; 1.Rau:1810; 1.Rau:1811; 1.Rau:1812; 1.Rau:1813; 1.Rau:1814; +22 more in JSON | <blank> | none | pending |

## DATE_INVALID

| Group | Raw value | Current normalized | Count | Source examples | Candidate | Confidence | Approval |
|---|---|---|---:|---|---|---|---|
| 705209CCA983 | <blank> | <blank> | 64 | 1.Rau:11658; 1.Rau:11659; 1.Rau:11660; 1.Rau:11661; 1.Rau:11662; 1.Rau:11663; +58 more in JSON | <blank> | none | pending |
| 24C20677972A | 414797 | <blank> | 2 | 7.Tr.cây:67; 7.Tr.cây:68 | <blank> | none | pending |
| 60EEFC5AAB50 | 414798 | <blank> | 1 | 7.Tr.cây:69 | <blank> | none | pending |

## INGREDIENT_CATALOG_AMBIGUOUS

| Group | Raw value | Current normalized | Count | Source examples | Candidate | Confidence | Approval |
|---|---|---|---:|---|---|---|---|
| 56CB5933BD92 | Ba ro | Ba ro | 1 | 1.Rau:10768 | <blank> | none | pending |
| CD870CDAD06F | Bánh tráng gói ram | Bánh tráng gói ram | 1 | 2.G.Vi:987 | <blank> | none | pending |
| 866821E238DA | Bì ngòi xanh | Bì ngòi xanh | 2 | 1.Rau:11430; 1.Rau:11527 | <blank> | none | pending |
| 520DFDC77AF8 | Bó đỏ non | Bó đỏ non | 1 | 1.Rau:11583 | <blank> | none | pending |
| CDAA02A15B05 | Bò vai | Bò vai | 2 | 16.ĐL S.Ngọc:262; 16.ĐL S.Ngọc:264 | <blank> | none | pending |
| 7FC3F357EB56 | Bông cải xanh | Bông cải xanh | 2 | 1.Rau:10559; 1.Rau:11481 | <blank> | none | pending |
| 41905210DB38 | Bông lí | Bông lí | 1 | 1.Rau:9925 | <blank> | none | pending |
| 6B14FFEC2A80 | Búp giò heo nạc- chặt ~112lát/16,5kg | Búp giò heo nạc- chặt ~112lát/16,5kg | 1 | 12.TS Dì Tài:1226 | <blank> | none | pending |
| 9BB549E8DC8F | Cá cam 300-501 | Cá cam 300-501 | 2 | 16.ĐL S.Ngọc:276; 16.ĐL S.Ngọc:278 | <blank> | none | pending |
| 936FF2826EA3 | Cải con | Cải con | 1 | 1.Rau:11642 | <blank> | none | pending |
| 80013FF77B70 | Cảithiaf | Cảithiaf | 1 | 1.Rau:9691 | <blank> | none | pending |
| 2B7320C93063 | Căn cuộn chay | Căn cuộn chay | 2 | 9.Chay:1181; 9.Chay:1197 | <blank> | none | pending |
| 8877DDDDCBE7 | Chuối cây (ăn rau sống) | Chuối cây (ăn rau sống) | 9 | 1.Rau:3304; 1.Rau:3413; 1.Rau:3689; 1.Rau:3850; 1.Rau:10622; 1.Rau:10755; +3 more in JSON | <blank> | none | pending |
| 320BCEF4932D | Chuối cây trắng (ăn rau sống) | Chuối cây trắng (ăn rau sống) | 3 | 1.Rau:3386; 1.Rau:3909; 1.Rau:4031 | <blank> | none | pending |
| 9C40232BA906 | Cốt lết cắt lát mỏng ( đập sẵn ~11lát/kg) | Cốt lết cắt lát mỏng ( đập sẵn ~11lát/kg) | 3 | 12.TS Dì Tài:1064; 12.TS Dì Tài:1136; 12.TS Dì Tài:1209 | <blank> | none | pending |
| 38EFBF131DA6 | Cốt lết cắt lát mỏng đập sẵn ( 11-12lát/kg) | Cốt lết cắt lát mỏng đập sẵn ( 11-12lát/kg) | 1 | 12.TS Dì Tài:1055 | <blank> | none | pending |
| 3977CC538BFF | Cốt lết cắt mỏng (~10lát/kg) | Cốt lết cắt mỏng (~10lát/kg) | 1 | 12.TS Dì Tài:1156 | <blank> | none | pending |
| 7965BEFC8AEF | Cốt lết cắt sẵn ( cây nhỏ) | Cốt lết cắt sẵn ( cây nhỏ) | 2 | 11.ĐL TT:347; 11.ĐL TT:352 | <blank> | none | pending |
| 2DECFD47F36E | Cốt lết cây to cắt mỏng (~12lát/kg | Cốt lết cây to cắt mỏng (~12lát/kg | 1 | 12.TS Dì Tài:1091 | <blank> | none | pending |
| EA8BA534EBF2 | Cốt lết cây to cắt mỏng (~12lát/kg) | Cốt lết cây to cắt mỏng (~12lát/kg) | 1 | 12.TS Dì Tài:1111 | <blank> | none | pending |
| 3645B4C1D120 | Cốt lết tươi cắt sẵn ( 11lát/suất) | Cốt lết tươi cắt sẵn ( 11lát/suất) | 1 | 12.TS Dì Tài:1178 | <blank> | none | pending |
| 4B23058222D8 | Đậu bắp ( lựa non) | Đậu bắp ( lựa non) | 1 | 1.Rau:10172 | <blank> | none | pending |
| 11573CA58500 | Đậu chiên lát lớn | Đậu chiên lát lớn | 1 | 9.Chay:1200 | <blank> | none | pending |
| 359B9D74C539 | Đậu khuôn chiên lớn | Đậu khuôn chiên lớn | 1 | 9.Chay:1208 | <blank> | none | pending |
| EBACD2D6B260 | Đậu khuôn sống lấy nhỏ | Đậu khuôn sống lấy nhỏ | 1 | 9.Chay:1123 | <blank> | none | pending |
| 433787F59F55 | Dẻ sườn bò | Dẻ sườn bò | 2 | 12.TS Dì Tài:1168; 12.TS Dì Tài:1175 | <blank> | none | pending |
| 3D8465C7B80C | Diếp cá | Diếp cá | 2 | 1.Rau:10514; 1.Rau:11653 | <blank> | none | pending |
| D7EC84160822 | Đù gà chay | Đù gà chay | 2 | 9.Chay:1137; 9.Chay:1184 | <blank> | none | pending |
| 468A37002237 | Đùi gà tỏi nhỏ | Đùi gà tỏi nhỏ | 1 | 11.ĐL TT:389 | <blank> | none | pending |
| F6E446558691 | Đùi má | Đùi má | 2 | 11.ĐL TT:342; 11.ĐL TT:344 | <blank> | none | pending |
| 5EA7A55B6195 | Giò | Giò | 2 | 12.TS Dì Tài:1149; 12.TS Dì Tài:1215 | <blank> | none | pending |
| 398B1A06430E | Heo đùi mông ( đặc tề sẵn) | Heo đùi mông ( đặc tề sẵn) | 2 | 12.TS Dì Tài:1240; 12.TS Dì Tài:1246 | <blank> | none | pending |
| 4B8CC6307CB0 | Heo đùi mông ( lựa miếng nạc, đặc tề sẵn) | Heo đùi mông ( lựa miếng nạc, đặc tề sẵn) | 2 | 12.TS Dì Tài:989; 12.TS Dì Tài:1016 | <blank> | none | pending |
| 18AEF1D30F50 | Heo đùi mông (tề sẵn) | Heo đùi mông (tề sẵn) | 1 | 12.TS Dì Tài:289 | <blank> | none | pending |
| 5C90E05EA2ED | Heo mỡ có da | Heo mỡ có da | 2 | 12.TS Dì Tài:1123; 12.TS Dì Tài:1157 | <blank> | none | pending |
| 7599F158304F | Lá lót to ( để gói) | Lá lót to ( để gói) | 1 | 1.Rau:10964 | <blank> | none | pending |
| 82008D581555 | Lòng bò | Lòng bò | 3 | 12.TS Dì Tài:1001; 12.TS Dì Tài:1071; 12.TS Dì Tài:1124 | <blank> | none | pending |
| 48F1471667B3 | Mắm nêm dì cẩn | Mắm nêm dì cẩn | 6 | 2.G.Vi:951; 2.G.Vi:985; 2.G.Vi:986; 2.G.Vi:1029; 2.G.Vi:1039; 2.G.Vi:1041 | <blank> | none | pending |
| 06353D65E2E8 | Măng xắt | Măng xắt | 1 | 1.Rau:10306 | <blank> | none | pending |
| F362193D49E3 | Mỡ | Mỡ | 1 | 12.TS Dì Tài:1217 | <blank> | none | pending |
| D9A58EF2EC19 | Mỡ đặc có da | Mỡ đặc có da | 1 | 12.TS Dì Tài:1252 | <blank> | none | pending |
| 6D5EEB43C321 | Nấm bào ngư | Nấm bào ngư | 77 | 1.Rau:7458; 1.Rau:7491; 1.Rau:7520; 1.Rau:7573; 1.Rau:7614; 1.Rau:7645; +71 more in JSON | <blank> | none | pending |
| 3119F4D89AC3 | Nấm bào ngừ | Nấm bào ngừ | 2 | 1.Rau:10133; 1.Rau:11565 | <blank> | none | pending |
| 4B27EB6EC613 | Ớt chuông đỏ vàng | Ớt chuông đỏ vàng | 1 | 1.Rau:11048 | <blank> | none | pending |
| 0AC3432B3142 | Ớt chuông vàng xanh | Ớt chuông vàng xanh | 1 | 1.Rau:10420 | <blank> | none | pending |
| 8214CCD87868 | Ớt chuông xanh | Ớt chuông xanh | 2 | 1.Rau:10746; 1.Rau:10832 | <blank> | none | pending |
| CB7B401DCEB0 | Ớt chuông xanh đỏ | Ớt chuông xanh đỏ | 2 | 1.Rau:11561; 1.Rau:11649 | <blank> | none | pending |
| F1324027C560 | Pa ro | Pa ro | 1 | 1.Rau:9949 | <blank> | none | pending |
| 85694C27489E | Phúc chúc chay | Phúc chúc chay | 1 | 2.G.Vi:1050 | <blank> | none | pending |
| 4F4AEC793782 | Rau củ thập cẩm | Rau củ thập cẩm | 1 | 1.Rau:11245 | <blank> | none | pending |
| A0D41626CA6D | Sườn dừa chay | Sườn dừa chay | 1 | 9.Chay:1199 | <blank> | none | pending |
| 26C2B37C4AD5 | Sườn heo pater | Sườn heo pater | 3 | 11.ĐL TT:357; 11.ĐL TT:413; 11.ĐL TT:420 | <blank> | none | pending |
| CAE11137F506 | Thăn bò | Thăn bò | 2 | 12.TS Dì Tài:1216; 12.TS Dì Tài:1259 | <blank> | none | pending |
| 8192A6417AD8 | Thịt bò dẻ sườn | Thịt bò dẻ sườn | 1 | 12.TS Dì Tài:1105 | <blank> | none | pending |
| 48C7CCD92C38 | Thịt mỡ đặc có da | Thịt mỡ đặc có da | 2 | 12.TS Dì Tài:1242; 12.TS Dì Tài:1266 | <blank> | none | pending |
| CADC03D1B08D | Thịt mỡ tấm | Thịt mỡ tấm | 1 | 12.TS Dì Tài:1065 | <blank> | none | pending |
| 13484479E297 | Thịt mỡ tấm có da | Thịt mỡ tấm có da | 1 | 12.TS Dì Tài:1210 | <blank> | none | pending |
| 6B30E083A512 | Tỏi cánh gà | Tỏi cánh gà | 2 | 11.ĐL TT:379; 11.ĐL TT:417 | <blank> | none | pending |
| E109D3B5B433 | Tương ớt chai | Tương ớt chai | 1 | 2.G.Vi:1021 | <blank> | none | pending |
| 946EC9A80F86 | Xương giá heo | Xương giá heo | 1 | 12.TS Dì Tài:1153 | <blank> | none | pending |
| 90A3154C3715 | Xương heo- chặt cục nạc (17cục/2,5kg) | Xương heo- chặt cục nạc (17cục/2,5kg) | 1 | 12.TS Dì Tài:1236 | <blank> | none | pending |
| 28E47305C2C4 | Xương mềm ( có thịt) | Xương mềm ( có thịt) | 1 | 12.TS Dì Tài:970 | <blank> | none | pending |
| 8138DA38A1D8 | Xương mềm ( nhiều thịt) | Xương mềm ( nhiều thịt) | 1 | 12.TS Dì Tài:1005 | <blank> | none | pending |
| 88CA611C6E13 | Xương mềm ( nhiều thịt)- 140 cục | Xương mềm ( nhiều thịt)- 140 cục | 1 | 12.TS Dì Tài:1146 | <blank> | none | pending |
| 63BE34533E3B | Xương mềm ( nhiều thịt)- 62cục | Xương mềm ( nhiều thịt)- 62cục | 1 | 12.TS Dì Tài:1116 | <blank> | none | pending |
| 060ED1C842BF | Xương mềm ( nhiều thịt)~88 lát | Xương mềm ( nhiều thịt)~88 lát | 1 | 12.TS Dì Tài:1030 | <blank> | none | pending |
| 2952E8544ABC | Xương mềm, xươg đuôi | Xương mềm, xươg đuôi | 1 | 12.TS Dì Tài:941 | <blank> | none | pending |

## INGREDIENT_MISSING

| Group | Raw value | Current normalized | Count | Source examples | Candidate | Confidence | Approval |
|---|---|---|---:|---|---|---|---|
| B8390EB58F5B | <blank> | <blank> | 23 | 1.Rau:11700; 18. Tôm:152; 18. Tôm:174; 2.G.Vi:47654; 20.SC Lif:19; 20.SC Lif:20; +17 more in JSON | <blank> | none | pending |

## INGREDIENT_SUPPLIER_AMBIGUOUS

| Group | Raw value | Current normalized | Count | Source examples | Candidate | Confidence | Approval |
|---|---|---|---:|---|---|---|---|
| 64243A8F941B | Cá nục bông 200 - 400 | Cá nục bông 200 - 400 | 1 | 11.ĐL TT:89 | <blank> | none | pending |
| FB08A29BED4B | Giò heo búp chặt sẵn (ko móng) - ~199lát/30kg | Giò heo búp chặt sẵn (ko móng) - ~199lát/30kg | 1 | 12.TS Dì Tài:1110 | <blank> | none | pending |
| 4BDC239740F8 | Giò heo búp chặt sẵn (ko móng) - ~54lát/8kg | Giò heo búp chặt sẵn (ko móng) - ~54lát/8kg | 1 | 12.TS Dì Tài:1085 | <blank> | none | pending |
| 86D1744CF9BD | Xương heo ( lựa nhiều thịt) - chặt ~212 lát/31,5kg | Xương heo ( lựa nhiều thịt) - chặt ~212 lát/31,5kg | 1 | 12.TS Dì Tài:1193 | <blank> | none | pending |

## UNIT_AMBIGUOUS

| Group | Raw value | Current normalized | Count | Source examples | Candidate | Confidence | Approval |
|---|---|---|---:|---|---|---|---|
| 9BED26A3F11E | canh | canh | 3 | 2.G.Vi:189; 2.G.Vi:194; 2.G.Vi:285 | <blank> | none | pending |
| F1E82A1B1AAF | kh | kh | 1 | 9.Chay:115 | <blank> | none | pending |

## UNIT_UNKNOWN

| Group | Raw value | Current normalized | Count | Source examples | Candidate | Confidence | Approval |
|---|---|---|---:|---|---|---|---|
| 07FDC5FEAC95 | <blank> | <blank> | 68 | 1.Rau:2038; 1.Rau:6804; 1.Rau:11700; 18. Tôm:152; 18. Tôm:174; 2.G.Vi:47654; +62 more in JSON | <blank> | none | pending |
| F7045753A917 | Bành | Bành | 28 | 2.G.Vi:176; 2.G.Vi:277; 2.G.Vi:366; 2.G.Vi:453; 2.G.Vi:503; 2.G.Vi:546; +22 more in JSON | <blank> | none | pending |
| 8C91B5E9B07E | Bao | Bao | 287 | 2.G.Vi:21; 2.G.Vi:38; 2.G.Vi:59; 2.G.Vi:93; 2.G.Vi:110; 2.G.Vi:130; +281 more in JSON | <blank> | none | pending |
| C71646A7A810 | bì | bì | 12 | 21.TH.Thái:113; 21.TH.Thái:117; 21.TH.Thái:122; 21.TH.Thái:124; 21.TH.Thái:150; 21.TH.Thái:166; +6 more in JSON | <blank> | none | pending |
| E61463738BDA | Bịch (10 cái) | Bịch (10 cái) | 4 | 3.T.Hóa:6; 3.T.Hóa:16; 3.T.Hóa:21; 3.T.Hóa:34 | <blank> | none | pending |
| B26BC75AA5FA | bình | bình | 1 | 21.TH.Thái:200 | <blank> | none | pending |
| 4B79BCCC0E49 | bó | bó | 36 | 1.Rau:3479; 1.Rau:3619; 1.Rau:3626; 1.Rau:3818; 1.Rau:4294; 1.Rau:6177; +30 more in JSON | <blank> | none | pending |
| DA0A519BA9D4 | bộ | bộ | 20 | 21.TH.Thái:145; 21.TH.Thái:216; 21.TH.Thái:218; 21.TH.Thái:366; 21.TH.Thái:406; 21.TH.Thái:436; +14 more in JSON | <blank> | none | pending |
| 0236A5F5688D | Can | Can | 92 | 2.G.Vi:13; 2.G.Vi:30; 2.G.Vi:61; 2.G.Vi:67; 2.G.Vi:89; 2.G.Vi:90; +86 more in JSON | <blank> | none | pending |
| 1BC4C8D13365 | Cặp | Cặp | 4 | 21.TH.Thái:19; 21.TH.Thái:111; 21.TH.Thái:337; 21.TH.Thái:627 | <blank> | none | pending |
| D462DF036C87 | Chiếc | Chiếc | 1 | 3.T.Hóa:86 | <blank> | none | pending |
| 1082D03DE761 | con | con | 2 | 23. Vịt:99; 23. Vịt:100 | <blank> | none | pending |
| 96E2DD24BCC9 | Cục | Cục | 7 | 1.Rau:1070; 1.Rau:2537; 1.Rau:2575; 1.Rau:3289; 1.Rau:9903; 21.TH.Thái:299; +1 more in JSON | <blank> | none | pending |
| EEB2ED2EA7BF | đôi | đôi | 10 | 21.TH.Thái:542; 3.T.Hóa:38; 3.T.Hóa:39; 3.T.Hóa:103; 3.T.Hóa:120; 3.T.Hóa:130; +4 more in JSON | <blank> | none | pending |
| C7B62486F3B9 | g | g | 3 | 1.Rau:7638; 1.Rau:8209; 1.Rau:8952 | <blank> | none | pending |
| 6A3611A4B09B | k | k | 2 | 2.G.Vi:714; 2.G.Vi:763 | <blank> | none | pending |
| A71D28D0C730 | lát nhỏ | lát nhỏ | 1 | 9.Chay:791 | <blank> | none | pending |
| 0334742F232F | Lẻ | Lẻ | 1 | 21.TH.Thái:22 | <blank> | none | pending |
| D0D2B2DDB8B1 | Lít | Lít | 1 | 2.G.Vi:14 | <blank> | none | pending |
| 76AE8BCFC353 | Lon | Lon | 8 | 21.TH.Thái:36; 21.TH.Thái:43; 21.TH.Thái:449; 21.TH.Thái:524; 21.TH.Thái:564; 21.TH.Thái:665; +2 more in JSON | <blank> | none | pending |
| EEABC774851A | Phần | Phần | 110 | 3.T.Hóa:4; 3.T.Hóa:7; 3.T.Hóa:10; 3.T.Hóa:12; 3.T.Hóa:13; 3.T.Hóa:18; +104 more in JSON | <blank> | none | pending |
| 12AFDE3975D6 | Trái | Trái | 110 | 1.Rau:2707; 1.Rau:2834; 1.Rau:3066; 1.Rau:3229; 1.Rau:3232; 1.Rau:3421; +104 more in JSON | <blank> | none | pending |
| B45E250A43F1 | vỉ | vỉ | 3 | 1.Rau:9826; 21.TH.Thái:379; 3.T.Hóa:404 | <blank> | none | pending |
| F6397B7657DF | viên | viên | 41 | 21.TH.Thái:112; 9.Chay:393; 9.Chay:424; 9.Chay:543; 9.Chay:556; 9.Chay:610; +35 more in JSON | <blank> | none | pending |
| 8C5FE22EA1C0 | vit | vit | 1 | 3.T.Hóa:150 | <blank> | none | pending |
| 499507E86121 | Xấp | Xấp | 11 | 21.TH.Thái:4; 21.TH.Thái:8; 21.TH.Thái:13; 21.TH.Thái:15; 21.TH.Thái:16; 21.TH.Thái:18; +5 more in JSON | <blank> | none | pending |

## Approval handoff

For each approved group, reviewers must provide the full `group_id`, an accepted canonical value or an explicit reject/leave-blocked decision, rationale, and approver identity. Production policy remains unchanged until that review is complete.
