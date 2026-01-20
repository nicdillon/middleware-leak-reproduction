# Middleware Cookie Leak Reproduction

This project reproduces Next.js middleware issues that occur with Vercel's Fluid Compute enabled.

## Problem

When Fluid Compute is enabled on Vercel, runtime instances are reused across requests, which can cause:
1. **Cookie mixing** between users (AsyncLocalStorage context issues)
2. **Module-scope state leaking** between users (JavaScript module caching)

## Project Branches

### `main` Branch
- Documentation and project setup
- No middleware implementation

### `vulnerable` Branch
- Demonstrates cookie mixing with multiple `cookies()` calls
- Focus: AsyncLocalStorage context corruption
- Issue: Nested async operations corrupt request context

### `fixed` Branch
- Implements solution for cookie mixing
- Single `cookies()` call pattern
- Passes cookie store to helpers

### `module-scope-leaks` Branch ⭐ NEW
- **Demonstrates module-scope state leaking**
- **Includes custom ESLint rule to detect anti-patterns**
- Focus: JavaScript module caching with Fluid Compute
- Issue: Module-level variables persist across user requests

## What's New: Module-Scope Leaks POC

The `module-scope-leaks` branch is a comprehensive POC that:

✅ **Demonstrates 4 Critical Anti-Patterns:**
1. Module-scope mutable cache (`let promotionalFlagCache = {}`)
2. Module-scope initialization guards (`let appStoreInitialized = false`)
3. Module-scope state variables (`let appStoreData = null`)
4. Module-scope fallback flags (`let promoFallbackFailed = false`)

✅ **Provides Custom ESLint Rule:**
- Automatically detects module-scope state in server code
- Catches `let`, `var`, mutable `const` declarations
- Only runs on server-side files (middleware, API routes, lib)

✅ **Includes Testing Tools:**
- UI test page at `/test-leak`
- API endpoint at `/api/test-leak`
- Load test script: `load-test-module-leak.js`

✅ **Shows Safe Alternatives:**
- Request-scoped context pattern
- AsyncLocalStorage usage
- No-caching approach

## Quick Start

### Test Module-Scope Leaks

```bash
# Clone and checkout
git clone https://github.com/nicdillon/middleware-leak-reproduction.git
cd middleware-leak-reproduction
git checkout module-scope-leaks

# Install dependencies
npm install

# Run ESLint (see detected issues)
npm run lint

# Run development server
npm run dev

# Visit test page
open http://localhost:3000/test-leak

# Run load test
node load-test-module-leak.js http://localhost:3000 20
```

### Deploy to Vercel

```bash
# Push to GitHub (Vercel auto-deploys)
git push origin module-scope-leaks

# Vercel will deploy to:
# https://middleware-leak-reproduction-git-module-scope-leaks-[team].vercel.app

# Run load test against deployment
node load-test-module-leak.js https://[your-url].vercel.app 50
```

## Documentation

- **Module-Scope Leaks:** See [ESLINT_POC.md](./ESLINT_POC.md)
- **Original Investigation:** See [PLAN.md](./PLAN.md)
- **Middleware Info:** See [MIDDLEWARE_INFO.md](./MIDDLEWARE_INFO.md)

## Expected Results

### ESLint Output
```
lib/feature-flags.ts
  15:1  error  Avoid 'let' at module scope  no-server-module-state
  18:1  error  Avoid 'let' at module scope  no-server-module-state

lib/store-initializer.ts
  15:1  error  Avoid 'let' at module scope  no-server-module-state
  [... more errors ...]

✖ 6 problems (6 errors, 0 warnings)
```

### Load Test Output (With Leaks)
```
Module-Scope State Leak Test
Total Requests: 20
Leaks Detected: 19 (95%)

⚠️  LEAKS DETECTED!
First User: UserA
Leaked Requests:
  - UserB: Expected PROMO_UserB, Got PROMO_UserA
  - UserC: Expected PROMO_UserC, Got PROMO_UserA
  [... 16 more ...]

CONCLUSION: Module-scope state is LEAKING between users!
```

### UI Test
Visit `/test-leak` and click "Run Concurrent Test" to see real-time leak detection.

## Branches Comparison

| Branch | Issue Type | Focus | Has ESLint Rule? |
|--------|-----------|-------|------------------|
| `vulnerable` | Cookie mixing | AsyncLocalStorage context | ❌ No |
| `fixed` | Cookie mixing | AsyncLocalStorage context | ❌ No |
| **`module-scope-leaks`** | **State leaking** | **Module caching** | **✅ Yes** |

## Files Overview (module-scope-leaks branch)

### Vulnerable Code (Demonstrates Issues)
- `lib/feature-flags.ts` - Module-scope cache and guards
- `lib/store-initializer.ts` - Initialization guard patterns
- `middleware.ts` - Uses vulnerable patterns

### Safe Code (Shows Solutions)
- `lib/safe-patterns.ts` - Request-scoped alternatives

### Testing
- `app/test-leak/page.tsx` - UI test page
- `app/api/test-leak/route.ts` - API endpoint
- `load-test-module-leak.js` - Automated load test

### Tooling
- `eslint-rules/no-server-module-state.js` - Custom ESLint rule
- `.eslintrc.js` - ESLint configuration

### Documentation
- `ESLINT_POC.md` - Complete POC documentation

## Stack

- Next.js 15.4.6
- React 19.1.0
- TypeScript 5.3.3
- Vercel Edge Runtime / Node.js Runtime
- ESLint 9.39.2
- Custom ESLint Plugin

## Contributing

This is a reproduction repository for demonstrating Vercel Fluid Compute issues. For questions or improvements, please open an issue or pull request.

## License

MIT
