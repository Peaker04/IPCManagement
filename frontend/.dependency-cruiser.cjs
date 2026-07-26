/**
 * Luật phụ thuộc frontend — R1..R7 theo Phần I của
 * docs/ARCHITECTURE-REDESIGN-2026-07-26.md.
 *
 * Mô hình 4 tầng, phụ thuộc chỉ đi MỘT CHIỀU:
 *
 *     app/ ──► features/ ──► entities/ ──► shared/
 *
 * Bản thiết kế khuyến nghị rõ: KHÔNG đổi tên cây `components|lib|types|api` sang
 * `shared/` trong học kỳ này — dependency-cruiser diễn đạt được luật bằng path
 * HIỆN TẠI, tiết kiệm ~83 file move mà không mất gì. Nên ánh xạ như sau:
 *
 *     tầng app     = src/app, src/routes
 *     tầng feature = src/features/<ten>
 *     tầng shared  = src/components, src/lib, src/types, src/utils, src/api, src/services
 *
 * CÁCH DÙNG: vi phạm đang tồn tại được ghi vào
 * `.dependency-cruiser-known-violations.json` (baseline). CI chỉ đỏ khi có vi phạm
 * MỚI. Không có baseline thì rào chắn bị hoãn vô thời hạn — đây là yêu cầu tường
 * minh của Phần J.
 *
 * KHI SỬA ĐƯỢC MỘT VI PHẠM: chạy `npm run depcruise:baseline` để chốt lại baseline
 * nhỏ hơn. Baseline chỉ được phép co lại, không được phình ra.
 */

const SHARED = '^src/(components|lib|types|utils|api|services)/';
const APP = '^src/(app|routes)/';
const FEATURE = '^src/features/([^/]+)/';

module.exports = {
  forbidden: [
    {
      name: 'R1-shared-khong-goi-nguoc',
      severity: 'error',
      comment:
        'Tầng shared/entities không được biết gì về feature hay app. Vi phạm luật này là ' +
        'nguồn của "sửa trang này hỏng trang kia": một thay đổi trong feature lan ngược ' +
        'xuống tầng dùng chung rồi lan ra mọi feature khác.',
      from: { path: SHARED },
      to: { path: '^src/(features|app|routes)/' },
    },
    {
      name: 'R2-feature-khong-goi-feature',
      severity: 'error',
      comment:
        'features/X không được import features/Y. Cần dùng chung thì đẩy xuống tầng shared. ' +
        'Đây là luật bị vi phạm nhiều nhất (73-80 chỗ theo khảo sát 26/07) nên baseline sẽ lớn.',
      from: { path: FEATURE },
      to: {
        path: FEATURE,
        pathNot: '^src/features/$1/',
      },
    },
    {
      name: 'R3-feature-khong-goi-app',
      severity: 'error',
      comment: 'features/ không được import app/ hay routes/. Phụ thuộc phải đi xuôi.',
      from: { path: '^src/features/' },
      to: { path: APP },
    },
    {
      name: 'R4-khong-chu-trinh',
      severity: 'error',
      comment:
        'Chu trình phụ thuộc. Khảo sát 26/07 ghi nhận 2 chu trình: projects<->workflow và ' +
        'chef<->workflow. Chu trình làm thứ tự khởi tạo module không xác định và chặn mọi ' +
        'nỗ lực tách file về sau.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'R5-file-mo-coi',
      severity: 'warn',
      comment:
        'File không ai import. Để mức warn vì có dương tính giả thật: barrel index.ts được ' +
        'import theo đường thư mục, và test/setup.ts do vitest config gọi chứ không qua import.',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '(^|/)(main|App)\\.tsx$', '\\.test\\.', '(^|/)index\\.ts$', '^src/test/'] },
      to: {},
    },
    {
      name: 'R6-khong-import-sau-vao-ruot-feature',
      severity: 'error',
      comment:
        'Import xuyên qua barrel vào ruột feature khác. Vi phạm này khoá cứng cấu trúc nội bộ ' +
        'của feature kia, khiến không thể sắp xếp lại mà không vỡ nơi khác.',
      from: { path: FEATURE },
      to: {
        path: '^src/features/([^/]+)/.+/',
        pathNot: '^src/features/$1/',
      },
    },
    // R7 (không leo quá 1 cấp, ví dụ '../../') CỐ TÌNH KHÔNG nằm ở đây.
    // dependency-cruiser khớp trên đường dẫn ĐÃ RESOLVE, không khớp trên chuỗi import gốc,
    // nên không diễn đạt được "specifier bắt đầu bằng ../../". Luật này thuộc về ESLint
    // (`no-restricted-imports` với patterns ['../../*', '../../../*']) — dự án đã có sẵn
    // hạ tầng eslint rule tự viết. Khảo sát 26/07: 29 chỗ vi phạm, 24/29 là
    // weekly-menu -> coordination.
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|dist|coverage|tests)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
    // Baseline KHÔNG khai ở đây — nó là cờ CLI `--known-violations <file>`.
    // Xem script `depcruise` / `depcruise:baseline` trong package.json.
  },
};
