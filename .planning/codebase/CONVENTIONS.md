# Codebase Conventions

**Analysis date:** 2026-07-19

## Backend

- Controllers are transport-only: bind DTOs, authorize, call an interface, and return `ApiResponse<T>`.
- Business rules belong in services under `Services/`; service interfaces are registered in `DependencyInjection.cs`.
- EF queries use `AsNoTracking()` for read paths and explicit transactions/unit-of-work boundaries for multi-entity writes.
- External IDs are converted through `GuidHelper`; do not expose binary GUID handling in controllers or React pages.
- Incoming contracts use DTOs and validators under `Models/DTOs` and `Models/Validators`.
- Paginated endpoints must return page metadata (`totalCount`, `pageNumber`, `pageSize`, `totalPages`, `hasPrev`, `hasNext`).

## Frontend

- Routes are centralized in `frontend/src/routes/routeConfig.ts` and composed in `AppRouter.tsx`.
- Feature pages own workflow-specific state; server state is RTK Query, not Redux duplication.
- Shared UI is preferred for table viewport, pagination, alerts, status badges, dialogs and operational layout.
- User-facing status/technical values are translated at render time through shared copy/config helpers; API enums remain unchanged.
- Destructive actions require a confirmation dialog; transient success/error feedback uses the toast provider or `InlineAlert`.
- Tables must use a bounded server page or an explicit local pagination contract. A pager that only slices an unbounded payload is not server pagination.

## Change safety

- Read dirty worktree ownership before editing mixed files.
- Run GitNexus impact before changing indexed symbols and `detect_changes --scope staged` before commit.
- Preserve unrelated feature hunks; stage only the intended hunk when a file is already dirty.
