# Testing Guide

This directory contains comprehensive tests for the nestjs-trpc package.

## Test Structure

```
tests/
├── setup.ts                    # Global test setup
├── utils/
│   ├── test-helpers.ts        # Common test utilities
│   └── error-handler.test.ts  # Error handler tests
├── decorators/
│   └── query.decorator.test.ts # Query decorator tests
├── module/
│   └── trpc-module.test.ts    # Module initialization tests
├── factory/
│   └── trpc-factory.test.ts   # Factory tests
├── drivers/
│   └── express-driver.test.ts # Express driver tests
└── integration/
    └── basic-workflow.test.ts # End-to-end workflow tests
```

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode (Development)

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

### CI Mode

```bash
npm run test:ci
```

## Test Categories

### Unit Tests

- **Decorators**: Test individual decorator functionality
- **Factory**: Test procedure and router creation
- **Drivers**: Test HTTP server integration
- **Utils**: Test utility functions

### Integration Tests

- **Basic Workflow**: Test complete decorator → router → server workflow
- **Module Initialization**: Test module setup and configuration

### Test Utilities

#### TestAppBuilder

Helper class for creating test NestJS applications:

```typescript
import { TestAppBuilder } from './utils/test-helpers'

const builder = new TestAppBuilder()
const app = await builder.createTestApp({
    generateSchemas: false,
})
await builder.closeTestApp()
```

#### Mock Helpers

Pre-built mocks for common testing scenarios:

```typescript
import { createMockContext, createMockProcedure } from './utils/test-helpers'

const context = createMockContext({ user: { id: '123' } })
const procedure = createMockProcedure()
```

## Writing New Tests

### 1. Unit Tests

Create focused tests for individual components:

```typescript
describe('ComponentName', () => {
    it('should do something specific', () => {
        // Test implementation
    })
})
```

### 2. Integration Tests

Test complete workflows:

```typescript
describe('Integration Test', () => {
    let module: TestingModule

    beforeEach(async () => {
        module = await Test.createTestingModule({
            imports: [TRPCModule.forRoot()],
            controllers: [TestController],
        }).compile()
    })

    afterEach(async () => {
        await module.close()
    })
})
```

### 3. Test Naming Convention

- Use descriptive test names that explain the expected behavior
- Group related tests using `describe` blocks
- Use `it` for individual test cases

### 4. Mocking

- Mock external dependencies
- Use Jest's built-in mocking capabilities
- Create reusable mock factories

## Coverage Goals

- **Unit Tests**: 90%+ coverage for core functionality
- **Integration Tests**: Cover main user workflows
- **Error Handling**: Test error scenarios and edge cases

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up resources in `afterEach`/`afterAll`
3. **Descriptive Names**: Test names should clearly describe what's being tested
4. **Mock External Dependencies**: Don't test third-party libraries
5. **Test Error Cases**: Include tests for error scenarios
6. **Use Test Helpers**: Leverage shared utilities for common patterns

## Debugging Tests

### Running Single Test File

```bash
npm test -- --testPathPattern=query.decorator.test.ts
```

### Running Tests with Console Output

```bash
npm test -- --verbose
```

### Debug Mode

```bash
npm test -- --runInBand --detectOpenHandles
```
