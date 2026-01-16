# Middleware Implementation

This is the **main** branch which contains documentation and base project structure only.

## Branch-Specific Implementations

### `vulnerable` Branch
Contains `middleware.ts` that demonstrates the problematic pattern:
- Multiple `cookies()` calls
- Helper functions that call `cookies()` internally
- Race conditions with async operations
- Cookie mixing occurs under load

### `fixed` Branch
Contains `middleware.ts` that implements the solution:
- Single `cookies()` call at middleware entry
- Cookie store passed to helpers as parameter
- Proper error handling
- No cookie mixing

## To Test

1. Switch to `vulnerable` or `fixed` branch
2. Deploy to Vercel with Fluid Compute enabled
3. Visit `/test` page
4. Run load test to observe results

See [PLAN.md](./PLAN.md) for detailed implementation strategy.
