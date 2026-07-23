<!-- generated-by: gsd-doc-writer -->
# Configuration

## Environment Variables

The backend uses `appsettings.json` files for configuration. Environment variables can override settings using the `__` separator pattern (e.g., `ConnectionStrings__DefaultConnection`).

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ASPNETCORE_ENVIRONMENT` | Yes | Development | Runtime environment: Development, Demo, Lan, Production |
| `ConnectionStrings__DefaultConnection` | Yes | - | MySQL connection string |
| `JwtSettings__SecretKey` | Yes | - | JWT signing key (min 32 characters) |
| `JwtSettings__Issuer` | Yes | - | JWT token issuer |
| `JwtSettings__Audience` | Yes | - | JWT token audience |
| `JwtSettings__ExpiryMinutes` | Yes | 30 | Access token expiry in minutes |
| `JwtSettings__RefreshExpiryDays` | Yes | 30 | Refresh token expiry in days |
| `Cors__AllowedOrigins` | Yes | localhost | Allowed CORS origins (array) |
| `AllowedHosts` | Yes | * (dev only) | Allowed host headers |

## Configuration Files

### appsettings.json (Base Configuration)

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "server=localhost;port=3306;database=ipcmanagement;user=root;password=YOUR_PASSWORD;"
  },
  "JwtSettings": {
    "SecretKey": "YOUR_SECRET_KEY_AT_LEAST_32_CHARS",
    "Issuer": "IPCManagementAPI",
    "Audience": "IPCManagementClient",
    "ExpiryMinutes": 30,
    "RefreshExpiryDays": 30
  },
  "Cors": {
    "AllowedOrigins": [
      "http://localhost:5173"
    ]
  },
  "Pagination": {
    "MaxPageSize": 100
  }
}
```

### Environment-Specific Files

| File | Purpose |
|------|---------|
| `appsettings.json` | Base configuration (not for production) |
| `appsettings.Development.json` | Local development overrides |
| `appsettings.Demo.example.json` | Demo environment template |
| `appsettings.Lan.example.json` | LAN deployment template |
| `appsettings.Production.example.json` | Production deployment template |

## Required vs Optional Settings

### Required (Startup Validation)

| Setting | Validation | Error Message |
|---------|------------|---------------|
| `JwtSettings__SecretKey` | Minimum 32 characters | "JwtSettings:SecretKey must be at least 32 characters long" |
| `JwtSettings__ExpiryMinutes` | Must be > 0 | "JwtSettings:ExpiryMinutes must be greater than 0" |
| `JwtSettings__RefreshExpiryDays` | Must be > 0 | "JwtSettings:RefreshExpiryDays must be greater than 0" |

### Optional (With Defaults)

| Setting | Default | Description |
|---------|---------|-------------|
| `Pagination__MaxPageSize` | 100 | Maximum records per page |
| `AllowedHosts` | * (dev) | Host header validation in production |

## Defaults

| Setting | Default Value | Location |
|---------|--------------|----------|
| API Port | 5262 (HTTP), 7004 (HTTPS) | `Properties/launchSettings.json` |
| JWT Expiry | 30 minutes | `appsettings.json` |
| Refresh Token Expiry | 30 days | `appsettings.json` |
| Max Page Size | 100 | `appsettings.json` |
| Log Level | Information | `appsettings.Development.json` |

## Per-Environment Overrides

### Development Profile
- Swagger UI enabled at `/swagger`
- CORS allows any origin
- EF Core SQL logging enabled
- Hot reload supported

### Production Profile
- Requires non-localhost CORS origins
- Rejects sample/placeholder secrets
- Enforces `AllowedHosts` whitelist
- HTTPS redirection enabled

## Frontend Configuration

Frontend uses Vite environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | http://localhost:5262 | Backend API URL |
| `VITE_ENABLE_MOCK_LOGIN` | false | Enable mock login for dev |

Create `frontend/.env.local` for local overrides:

```bash
VITE_API_BASE_URL=http://localhost:5262
```
