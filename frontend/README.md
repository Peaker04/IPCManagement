<!-- generated-by: gsd-doc-writer -->
# Frontend

Part of the IPCManagement monorepo.

## Overview

React 19 frontend for the Industrial & Production Catering Management System. Provides the user interface for menu planning, workflow management, and reporting.

Data-bearing UI changes follow the repository's [UI/UX and FE–BE–Database standardization contract](../docs/UI-UX-FE-BE-DATABASE-STANDARDIZATION.md), including the shared query-state, formatter, pagination, permission, grain, and mutation evidence rules.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.2.6 | UI framework |
| Vite | 8.0.12 | Build tool |
| TypeScript | 6.0.2 | Type safety |
| Redux Toolkit | 2.12.0 | State management |
| React Router | 7.17.0 | Routing |
| TailwindCSS | 4.3.0 | Styling |
| shadcn/ui | 4.11.0 | UI components |
| Vitest | 4.1.10 | Testing |
| Playwright | 1.60.0 | E2E testing |

## Installation

```bash
cd frontend
npm install
```

## Usage

### Development

```bash
npm run dev
# Runs at http://localhost:5173
```

### Mock Login (Development)

For UI testing without backend:

```bash
VITE_ENABLE_MOCK_LOGIN=true npm run dev
```

Mock accounts:
- `admin/admin`
- `staff/staff`

### Production Build

```bash
npm run build
# Output: frontend/dist/
```

### Configuration

Create a local frontend env file for local overrides:

```bash
VITE_API_BASE_URL=http://localhost:5262
```

## Testing

### Unit Tests

```bash
npm run test:unit
npm run test:unit:watch  # Watch mode
npm run test:coverage    # With coverage
```

### E2E Tests (Playwright)

```bash
npm run test:smoke       # Route smoke tests
npm run test:controls     # Control surface tests
npm run test:ui-audit    # UI audit tests
npm run test:visual      # Visual regression tests
npm run test:visual:update  # Update visual snapshots
```

## Code Structure

```
frontend/src/
├── app/                    # Redux store, app layout và composition pages đa-feature
├── api/                    # Một RTK Query slice, compatibility barrel, shared types/tags/documents
├── features/               # Feature modules
│   ├── auth/              # Authentication
│   ├── admin/             # Admin panel
│   ├── approvals/         # Approval workflow
│   ├── coordination/       # Coordination operations
│   ├── chef/              # Kitchen operations
│   ├── projects/          # Project and weekly-menu planning
│   ├── purchasing/        # Purchasing workflow
│   ├── reports/           # Reporting
│   └── warehouse/         # Warehouse workflow
├── lib/                    # Utilities, route/workflow configuration
├── routes/                # Router configuration
├── styles/                # Global styles
├── types/                 # TypeScript types
└── main.tsx               # Entry point
```

## Key Exports

### Typography

CSS tokens in `src/styles/index.css` own all raw font families and the semantic type scale.
React callers select one of the static roles from the shared helper; semantic HTML remains
owned by the caller and layout, color, truncation, and state classes stay outside the helper.
Inter Variable is self-hosted from the pinned `@fontsource-variable/inter` dependency with
Vietnamese, Latin Extended, and Latin WOFF2 subsets; `index.html` must not load Google Fonts.

```tsx
import { typography } from '@/lib/typography'
import { cn } from '@/lib/utils'

<h2 className={cn(typography.sectionTitle, 'text-slate-800')}>Nguyên liệu cần mua</h2>
<span className={typography.numeric}>1.250 kg</span>
```

Do not construct Tailwind typography classes dynamically and do not add raw `font-family`
stacks outside the primitive tokens. A new semantic role needs at least two callers with the
same meaning and geometry; otherwise keep the reviewed exception local and document it in
`tests/typographyContract.test.ts`.

Button, Input, Badge, Card, table and command primitives use component-level `--text-*`
tokens in the same CSS owner; do not add those component contracts to the seven-role public
helper. Raw JSX `font-mono` is prohibited: identifiers and audit values use
`typography.code`. `tests/fixtures/TypographyFixture.tsx` is the canonical fixture for
Vietnamese copy, long document IDs, tabular numbers and focus-boundary checks. Local-only
and `font-src 'self'` browser evidence is indexed in `docs/EVIDENCE-INDEX.md`.

### State Management

```typescript
import { useAppDispatch, useAppSelector } from './app/hooks';
import { apiSlice } from './api/apiSlice';
```

### Routing

```typescript
import { AppRouter } from './routes/AppRouter';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { RoleGuard } from './routes/RoleGuard';
```

### API

```typescript
import { workflowApi } from './api/workflowApi';
import { coordinationApi } from './features/coordination/coordinationApi';
```

`apiSlice.ts` là production `createApi` duy nhất. `workflowApi.ts` chỉ đăng ký rồi re-export
compatibility contract: 75 endpoint key và 75 public generated hook trên cùng slice/cache namespace.
Implementation endpoint thuộc bảy feature owner (`admin`, `approvals`, `chef`, `purchasing`,
`reports`, `warehouse`, dashboard) cùng neutral `workflowDocumentsApi`; cache dùng một registry
`workflowCacheTags` gồm 22 ID. Không tạo feature-local `createApi` hoặc đổi public hook/cache tag
khi chuyển ownership.

`MainLayout` thuộc `src/app/layout`. Projects chỉ dùng Coordination transport/read projection và
action contract ở boundary thấp hơn, không import feature internals. Dependency-cruiser khóa R1–R6;
baseline 54 violation hiện là `[]`, strict graph có 0 violation trên 342 module/1.169 dependency.

Hai page model lớn giữ facade công khai nhưng đã chia owner bên trong:

- `useAdminDataPageModel` composition bảy panel-model owner;
- `useReportsPageModel` composition năm report view-model owner.

Các owner hook vẫn được gọi vô điều kiện theo thứ tự cũ để giữ React hook order, RTK Query cache
timing, URL/permission/reset contract và UI behavior.

## Phase 17 verification snapshot

Gate ngày 29/07/2026 trên HEAD `1ca2bbb`:

- frontend: 80 file, 433/433 test; lint, dependency-cruiser và production build pass;
- one-api-slice/public/cache contract: 75 endpoint, 75 hook, 22 cache ID;
- `npm run check:api-contract`: OpenAPI và generated TypeScript deterministic, không drift;
- headed Chrome: 3 viewport, 30 app route, 3 Shipyard capture, 96 tab interaction,
  48 warm revisit với 0 request mới, 64 API response đều 2xx, không console/page/request error,
  overflow, CLS hoặc long task.

Evidence authoritative:
`.artifacts/shipyard-live/phase-17-frontend-ownership-20260729/phase17-headed-audit.json`.

## Related Documentation

- [Root README](../README.md) - Project overview
- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - System architecture
- [GETTING-STARTED.md](../docs/GETTING-STARTED.md) - Getting started guide
- [DEVELOPMENT.md](../docs/DEVELOPMENT.md) - Local development and scripts
- [TESTING.md](../docs/TESTING.md) - Unit, browser and CI testing
