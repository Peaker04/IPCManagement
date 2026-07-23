<!-- generated-by: gsd-doc-writer -->
# Development

## Local Setup

### 1. Fork and Clone

```bash
git clone https://github.com/Peaker04/IPCManagement.git
cd IPCManagement
```

### 2. Install Dependencies

```bash
# Backend dependencies
dotnet restore backend/src/IPCManagement.Api/IPCManagement.Api.csproj

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Configure Environment

```bash
cd backend/src/IPCManagement.Api
cp appsettings.json.example appsettings.json
# Edit appsettings.json with your MySQL credentials
```

### 4. Start Development Servers

```bash
# Start backend (from project root)
npm run be

# Start frontend (separate terminal)
npm run fe
```

## Build Commands

### Root-level npm scripts

| Command | Description |
|---------|-------------|
| `npm run fe` | Start frontend dev server |
| `npm run be` | Start backend dev server |
| `npm run build:be` | Build backend |
| `npm run build:fe` | Build frontend for production |
| `npm run verify` | Run full verification (build + tests + lint) |
| `npm run verify:coverage` | Run full verification with coverage |
| `npm run lint:fe` | Run frontend linter |
| `npm run test:fe:unit` | Run frontend unit tests |

### Backend commands

```bash
# Build
dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj

# Run tests
dotnet test backend/IPCManagement.slnx

# Run with coverage
npm run coverage:be

# Benchmark workflow
npm run benchmark:workflow
```

## Code Style

### Frontend (ESLint + Prettier)

ESLint and Prettier are configured for the frontend project:

| Tool | Config | Run Command |
|------|--------|-------------|
| ESLint | `.eslintrc*` | `npm run lint:fe` |
| Prettier | `prettier.config.*` | Auto-format on save |

### Backend (C#)

Uses .NET default formatting. Configure your IDE to use Visual Studio or JetBrains default C# formatting conventions.

### Git Hooks (Husky)

Commit linting is enforced via Husky:

| Hook | Purpose |
|------|---------|
| `commit-msg` | Validate commit message format |

Run `npm run commitlint -- --edit` to lint the last commit message.

## Branch Conventions

### Branch Naming

| Pattern | Use Case |
|---------|----------|
| `feat/*` | New features |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation changes |
| `refactor/*` | Code refactoring |
| `test/*` | Adding or updating tests |

### Main Branches

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `development` | Integration branch for features |

## Pull Request Process

### PR Checklist

1. **Branch**: Create from `development` branch
2. **Tests**: Ensure all tests pass (`npm run verify`)
3. **Linting**: Frontend lint must pass (`npm run lint:fe`)
4. **Build**: Both frontend and backend must build successfully
5. **Commit**: Use conventional commits format

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(purchase): add bulk approval functionality

- Add bulk select checkboxes
- Add approve all button
- Update approval workflow service

Closes #123
```

## Additional Resources

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contributing guidelines
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [TESTING.md](TESTING.md) - Testing guidelines
