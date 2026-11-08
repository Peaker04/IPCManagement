# IPCManagement

Industrial kitchen management: customer weekly menus, servings and BOM, material planning, purchasing, warehouse movements, kitchen handoff and reconciliation.

`DEFAULT` and `MATERIAL_RECONCILIATION` share master data/physical stock but have separate workflow records and permissions.

## Quick start

Prerequisites: Node 22.19+, npm, the .NET SDK selected by `global.json`, and authorized MySQL configuration. Follow [ENGINEERING](docs/ENGINEERING.md) to configure local secrets and verify actual listeners/readiness. Setup is not authorization for migration, seeding or business-data creation.

```sh
npm ci
npm run be
# Separate terminal:
npm run fe
```

## Read next

- [Documentation router](docs/README.md): choose a canonical owner by task.
- [DOMAIN](docs/DOMAIN.md): business language, roles and invariants.
- [ARCHITECTURE](docs/ARCHITECTURE.md): current source/module boundaries.
- [ENGINEERING](docs/ENGINEERING.md): setup, configuration and focused verification.
- [DESIGN](docs/DESIGN.md): presentation and accessibility.
- [OPERATIONS](docs/OPERATIONS.md): deployment, health and recovery safety.
- [ROADMAP](ROADMAP.md): desired outcomes.

AI coding agents start at [AGENTS](AGENTS.md).
