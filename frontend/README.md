<!-- generated-by: gsd-doc-writer -->
# Frontend

Part of the IPCManagement monorepo.

## Overview

React 19 frontend for the Industrial & Production Catering Management System. Provides the user interface for menu planning, workflow management, and reporting.

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
├── app/                    # Redux store, hooks
├── features/               # Feature modules
│   ├── auth/              # Authentication
│   ├── admin/             # Admin panel
│   ├── projects/          # Project management
│   │   └── weeklyMenu/    # Weekly menu planning
│   ├── coordination/       # Coordination operations
│   ├── chef/              # Kitchen operations
│   ├── workflow/          # Purchase workflow
│   └── reports/           # Reporting
├── lib/                    # Utilities
├── routes/                # Router configuration
├── styles/                # Global styles
├── types/                 # TypeScript types
└── main.tsx               # Entry point
```

## Key Exports

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
import { workflowApi } from './features/workflow/workflowApi';
import { coordinationApi } from './features/coordination/coordinationApi';
```

## Related Documentation

- [Root README](../README.md) - Project overview
- [ARCHITECTURE.md](../docs/ARCHITECTURE.md) - System architecture
- [GETTING-STARTED.md](../docs/GETTING-STARTED.md) - Getting started guide
- [DEVELOPMENT.md](../docs/DEVELOPMENT.md) - Local development and scripts
- [TESTING.md](../docs/TESTING.md) - Unit, browser and CI testing
