# IPCManagement

Industrial kitchen management: customer weekly menus, serving plans, BOM/material requirements, purchasing, warehouse movements, kitchen handoff and reconciliation.

`DEFAULT` and `MATERIAL_RECONCILIATION` are separate workflows sharing master data and physical stock, not interchangeable business records. Backend permissions/mode/version checks are authoritative.

## Start

Prerequisites: Node 22.19+ (Pi requires this; frontend/CI use Node 22), npm, .NET SDK selected by `global.json`, and authorized MySQL configuration. See [development setup](docs/DEVELOPMENT.md) and [configuration](docs/CONFIGURATION.md).

```sh
npm ci
npm run be
# Separate terminal:
npm run fe
```

Set backend configuration from `.example` files using local secrets. Do not run migrations/seed or create business data merely to start a test.

```sh
npm run build:be
npm run build:fe
npm run test:be:ci
npm run test:fe:unit -- --maxWorkers=1
```

- [Documentation index](docs/README.md): product, architecture, setup, tests and operations.
- [Agent/project entry](AGENTS.md): safety and INTAKE → PLAN → EXECUTE → VERIFY → CLOSE.
- [Outcome roadmap](ROADMAP.md).
- [Active work](.planning/WORK.md): the only task plan/checklist/state owner.

CI verifies quality/security; it does not deploy the backend. Commit/push/deploy and database operations require separate authorization.
