# Testing and Coverage

This project uses layered testing:

- Backend unit and integration tests run through `dotnet test backend/IPCManagement.slnx`.
- Backend coverage uses coverlet and ReportGenerator through `npm run coverage:be`.
- Frontend unit tests use Vitest, React Testing Library, and jsdom through `npm run test:fe:unit`.
- Frontend coverage uses `npm run coverage:fe`.
- Route smoke and visual checks remain Playwright-based through `npm run test:smoke --workspace frontend` and `npm run test:visual --workspace frontend`.

Recommended local gates:

```powershell
npm run verify
npm run verify:coverage
npm run test:smoke --workspace frontend
```

Coverage policy starts as a reporting gate. Raise thresholds only after the baseline report is stable, with priority on BOM tier resolution, material demand, purchase planning, stock reconciliation, kitchen production plans, and the weekly menu/admin/report UI flows.
