<!-- generated-by: gsd-doc-writer -->
# Deployment

## Deployment Targets

### Frontend (Vercel)

| Config File | Purpose |
|-------------|---------|
| `vercel.json` | Vercel deployment configuration |

Vercel deployment settings:
- Build command: `npm run build:fe`
- Output directory: `frontend/dist`
- Framework: Vite
- Auto-deploy on push to `main` and `dev` branches

<!-- VERIFY: Actual Vercel project URL and team settings -->

### Backend (Self-hosted)

The backend is a .NET 9 application that can be deployed to any hosting platform:

| Platform | Notes |
|----------|-------|
| IIS | Windows Server with IIS |
| Docker | Containerized deployment |
| Azure App Service | Cloud hosting |
| Linux (systemd) | Self-managed Linux server |
| <!-- VERIFY: Actual deployment platform URL --> |

## Build Pipeline

### CI/CD Workflows

Located in `.github/workflows/`:

1. **Build + Test**: Runs on push and PR
   - Build backend: `npm run build:be`
   - Run tests: `npm run test:be`
   - Lint frontend: `npm run lint:fe`

2. **E2E Tests**: Manual trigger or scheduled
   - Runs happy path E2E: `npm run e2e:happy`
   - Runs exception path E2E: `npm run e2e:exceptions`

### Release Verification

```powershell
# Audit release readiness
npm run verify:release:audit

# Full release verification
npm run verify:release -- -BackendBaseUrl http://localhost:5262 -RunSeedReset -E2ELogPath .artifacts/e2e/<dated-e2e-log>.log
```

## Environment Setup

### Backend Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ASPNETCORE_ENVIRONMENT` | Yes | Production |
| `ConnectionStrings__DefaultConnection` | Yes | MySQL connection string with strong password |
| `JwtSettings__SecretKey` | Yes | Strong secret key (min 32 chars) |
| `JwtSettings__Issuer` | Yes | Production issuer name |
| `JwtSettings__Audience` | Yes | Production audience name |
| `Cors__AllowedOrigins__0` | Yes | Production frontend URL |
| `AllowedHosts` | Yes | Production API domain |

### Production appsettings

```bash
# Copy production template
cp appsettings.Production.example.json appsettings.Production.json

# Update with production values
# Or set environment variables:
```

```powershell
$env:ASPNETCORE_ENVIRONMENT="Production"
$env:ConnectionStrings__DefaultConnection="server=YOUR_DB_HOST;port=3306;database=ipcmanagement;user=ipc_app;password=YOUR_STRONG_PASSWORD;"
$env:JwtSettings__SecretKey="YOUR_UNIQUE_SECRET_KEY_AT_LEAST_32_CHARACTERS"
$env:JwtSettings__Issuer="IPCManagementAPI"
$env:JwtSettings__Audience="IPCManagementClient"
$env:Cors__AllowedOrigins__0="https://your-frontend-domain.com"
$env:AllowedHosts="your-api-domain.com"
```

## Rollback Procedure

### Backend Rollback

1. **Redeploy previous version**:
   - Stop current service
   - Checkout previous git commit or tag
   - Rebuild and restart

2. **Database rollback** (if schema changed):
   - Restore from backup
   - Run EF migrations downgrade if needed

### Frontend Rollback (Vercel)

1. Go to Vercel Dashboard
2. Find the deployment
3. Click "..." menu → "Promote to Production"

## Monitoring

### Logging

The application uses Serilog for structured logging:

| Output | Location |
|--------|----------|
| Console | stdout |
| File | `logs/ipc-{date}.log` |

Log rotation: Daily, retained for 30 days

### Health Checks

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Root health check |
| <!-- VERIFY: Production health endpoint if configured --> |

### Metrics

No external APM configured. Monitor via:
- Application logs
- Database query performance
- Server resource usage

<!-- VERIFY: Any additional monitoring dashboards or alerting configured -->
