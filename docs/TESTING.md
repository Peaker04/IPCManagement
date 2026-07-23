<!-- generated-by: gsd-doc-writer -->
# Testing

## Test Framework and Setup

### Backend Testing

| Framework | Version | Purpose |
|-----------|---------|---------|
| xUnit | Latest | Unit testing framework |
| NSubstitute | Latest | Mocking library |
| FluentAssertions | Latest | Assertion library |

### Frontend Testing

| Framework | Version | Purpose |
|-----------|---------|---------|
| Vitest | Latest | Unit testing framework |
| React Testing Library | Latest | Component testing |
| jsdom | Latest | DOM simulation |

## Running Tests

### Backend Tests

```bash
# Run all backend tests
npm run test:be

# Run tests with coverage
npm run coverage:be

# Run performance benchmarks
npm run benchmark:workflow

# Run specific test filter
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "Category=Performance"
```

### Frontend Tests

```bash
# Run frontend unit tests
npm run test:fe:unit

# Run with coverage
npm run coverage:fe
```

### Full Verification

```bash
# Build + all tests + lint + build
npm run verify

# With coverage reports
npm run verify:coverage
```

## Writing New Tests

### Backend Test Conventions

Test files follow the naming pattern: `*Tests.cs`

```csharp
public class MyServiceTests
{
    [Fact]
    public async Task MethodName_Should_ReturnExpected_When_Condition()
    {
        // Arrange
        var mockRepo = Substitute.For<IRepository>();
        
        // Act
        var result = await service.MethodNameAsync(mockRepo);
        
        // Assert
        result.Should().Be(expectedValue);
    }
}
```

### Frontend Test Conventions

Test files follow the naming pattern: `*.test.ts` or `*.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected')).toBeInTheDocument();
  });
});
```

## Coverage Requirements

### Backend Coverage

Coverage configuration: `backend/coverage.runsettings`

Coverage reports are generated to: `backend/TestResults/CoverageReport/index.html`

### Frontend Coverage

Coverage configuration: `vite.config.ts` (Vitest coverage)

Coverage reports are generated to: `frontend/coverage/index.html`

### Coverage Commands

```bash
# Clean previous coverage
npm run clean:coverage:be

# Generate backend coverage
npm run test:be:coverage

# Generate coverage report
npm run coverage:be:report
```

## CI Integration

### GitHub Actions Workflows

Located in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| Build + Test | Push/PR | Verify build and run tests |
| E2E Tests | Manual/Schedule | End-to-end testing |

### Running E2E Tests

```bash
# Happy path E2E
npm run e2e:happy

# Exception path E2E
npm run e2e:exceptions
```

### Release Verification

```bash
# Audit only (no changes)
npm run verify:release:audit

# Full release verification
npm run verify:release -- -BackendBaseUrl http://localhost:5262 -RunSeedReset
```
