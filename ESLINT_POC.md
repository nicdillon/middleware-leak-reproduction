# Module-Scope State Leak POC with ESLint Detection

This branch demonstrates **module-scope state leaking** with Vercel Fluid Compute and provides a **custom ESLint rule** to automatically detect these anti-patterns.

---

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [Anti-Patterns Demonstrated](#anti-patterns-demonstrated)
- [ESLint Rule](#eslint-rule)
- [Running the POC](#running-the-poc)
- [Expected Results](#expected-results)
- [Safe Patterns](#safe-patterns)

---

## Overview

When Vercel Fluid Compute is enabled, Edge/Node.js runtime instances are reused across multiple requests. This means **module-level variables persist** between different users' requests, causing data leaks.

This POC demonstrates the exact anti-patterns that cause these leaks and provides tooling to prevent them.

---

## The Problem

### Without Fluid Compute (Traditional)

```typescript
Request 1 (User A)
├─ New runtime instance
├─ Load module: let cache = {}
├─ User A sets cache = { userId: "A" }
└─ Runtime DESTROYED

Request 2 (User B)
├─ New runtime instance
├─ Load module: let cache = {}  ← Empty again
├─ User B sets cache = { userId: "B" }
└─ Runtime DESTROYED
```

**Result:** ✅ No leak - each user gets fresh module state

### With Fluid Compute (What This POC Shows)

```typescript
Request 1 (User A)
├─ New runtime instance
├─ Load module: let cache = {}
├─ User A sets cache = { userId: "A" }
└─ Runtime KEPT ALIVE

Request 2 (User B) - 10 seconds later
├─ REUSE existing runtime
├─ cache STILL = { userId: "A" }  ← User A's data!
├─ User B sees cache = { userId: "A" }
└─ Runtime KEPT ALIVE
```

**Result:** ⚠️ LEAK - User B sees User A's cached data

---

## Anti-Patterns Demonstrated

This POC demonstrates 4 critical anti-patterns:

### 1. Module-Scope Mutable Cache
**File:** `lib/feature-flags.ts:15`

```typescript
// ❌ VULNERABLE
let promotionalFlagCache: Record<string, any> = {};

export const getPromotionalFlag = (userId: string) => {
    if (Object.keys(promotionalFlagCache).length > 0) {
        return promotionalFlagCache;  // Returns User A's data to User B!
    }
    // ...
    promotionalFlagCache = computedFlag;
};
```

**Impact:** User B gets User A's promotional flag and coupon code.

---

### 2. Module-Scope Initialization Guard
**File:** `lib/store-initializer.ts:15`

```typescript
// ❌ VULNERABLE
let appStoreInitialized = false;

export const initializeAppStore = (userId: string, authToken: string) => {
    if (!appStoreInitialized) {  // Only runs for first user!
        appStoreData = { userId, authToken };
        appStoreInitialized = true;  // Stays true forever
    }
};
```

**Impact:** First user initializes, all subsequent users skip initialization.

---

### 3. Module-Scope State Variables
**File:** `lib/store-initializer.ts:23-24`

```typescript
// ❌ VULNERABLE
let appStoreData: AppStore | null = null;
let featureFlagStoreData: FeatureFlagStore | null = null;
```

**Impact:** All users share the same store data.

---

### 4. Module-Scope Fallback Flag
**File:** `lib/feature-flags.ts:18`

```typescript
// ❌ VULNERABLE
let promoFallbackFailed = false;

export const checkPromoFallback = (userId: string) => {
    if (shouldFallback && !promoFallbackFailed) {
        promoFallbackFailed = true;  // Set by first user, persists for all users
        logger.warn("Fallback triggered");
    }
};
```

**Impact:** Only first user triggers fallback warning; subsequent users skip logging.

---

## ESLint Rule

### Custom Rule: `no-server-module-state`

**Location:** `eslint-rules/no-server-module-state.js`

This rule automatically detects module-scope state in server-side code.

### What It Catches

```typescript
// ❌ Caught by ESLint
let cache = {};
var state = null;
const users = [];
const config = { initialized: false };
const instance = new MyClass();

// ✅ Allowed by ESLint
const API_URL = "https://...";
const CONFIG = { key: "value" } as const;
const storage = new AsyncLocalStorage();
const container = new Map();
```

### Where It Runs

- ✅ `middleware.ts`
- ✅ `app/api/**/route.ts`
- ✅ `lib/**/*.ts`
- ❌ `app/**/*.tsx` (client components - skipped)

### Running ESLint

```bash
# Run lint check
npm run lint

# Expected output (shows errors in vulnerable files):
lib/feature-flags.ts
  15:1  error  Avoid 'let' at module scope  no-server-module-state
  18:1  error  Avoid 'let' at module scope  no-server-module-state

lib/store-initializer.ts
  15:1  error  Avoid 'let' at module scope  no-server-module-state
  16:1  error  Avoid 'let' at module scope  no-server-module-state
  23:1  error  Avoid 'let' at module scope  no-server-module-state
  24:1  error  Avoid 'let' at module scope  no-server-module-state

✖ 6 problems (6 errors, 0 warnings)
```

Safe patterns file should pass:

```bash
npm run lint lib/safe-patterns.ts
# ✅ No errors
```

---

## Running the POC

### 1. Install Dependencies

```bash
npm install
```

### 2. Run ESLint (See Detected Issues)

```bash
npm run lint
```

You should see errors for all the vulnerable patterns in `lib/feature-flags.ts` and `lib/store-initializer.ts`.

### 3. Run Development Server Locally

```bash
npm run dev
```

Visit `http://localhost:3000/test-leak` to test manually.

### 4. Deploy to Vercel

```bash
# Push to GitHub (Vercel auto-deploys)
git add .
git commit -m "Add module-scope leak POC with ESLint rule"
git push origin module-scope-leaks
```

### 5. Run Load Test Against Deployed Version

```bash
# Test against Vercel deployment
node load-test-module-leak.js https://[your-deployment-url].vercel.app 20

# Or test locally
node load-test-module-leak.js http://localhost:3000 20
```

---

## Expected Results

### ESLint Output

```
lib/feature-flags.ts
  15:1  error  Avoid 'let' at module scope in server code  no-server-module-state
  18:1  error  Avoid 'let' at module scope in server code  no-server-module-state

lib/store-initializer.ts
  15:1  error  Avoid 'let' at module scope in server code  no-server-module-state
  16:1  error  Avoid 'let' at module scope in server code  no-server-module-state
  23:1  error  Avoid 'let' at module scope in server code  no-server-module-state
  24:1  error  Avoid 'let' at module scope in server code  no-server-module-state

✖ 6 problems (6 errors, 0 warnings)
```

### Load Test Output (With Leaks)

```
================================================================================
Module-Scope State Leak Test
================================================================================
Base URL: https://[deployment].vercel.app
Number of Users: 20
Starting test at: 2026-01-20T18:30:00.000Z
================================================================================

Firing requests concurrently...

Progress: 20/20 requests completed

================================================================================
Test Results
================================================================================

Total Requests: 20
Successful: 20
Failed: 0
Leaks Detected: 19 (95%)

⚠️  LEAKS DETECTED!

First User (initialized module state): UserA

Leaked Requests:
  - UserB: Promo, AppStore
      Promo: Expected PROMO_UserB, Got PROMO_UserA
      AppStore: Expected UserB, Got UserA
  - UserC: Promo, AppStore
      Promo: Expected PROMO_UserC, Got PROMO_UserA
      AppStore: Expected UserC, Got UserA
  [... 16 more users ...]

================================================================================
CONCLUSION: Module-scope state is LEAKING between users!
================================================================================

Response Time Stats:
  Average: 45ms
  Min: 32ms
  Max: 78ms
```

### UI Test Output

Visit `/test-leak` and click "Run Concurrent Test":

```
Summary
Tests Run: 5
Leaks Detected: 4 (80%)
⚠️ Module-scope state is leaking! Users are seeing cached data from other users.

Results:
UserA ✅ No Leak
  Promotional Flag: PROMO_UserA
  App Store: UserA

UserB ⚠️ LEAK DETECTED
  Promotional Flag: PROMO_UserA (LEAKED from another user!)
  App Store: UserA (LEAKED!)

[... more results ...]
```

---

## Safe Patterns

See `lib/safe-patterns.ts` for examples of safe implementations.

### Pattern 1: Request-Scoped Context

```typescript
// ✅ SAFE: Pass context explicitly
interface RequestContext {
    userId: string;
    cache: Map<string, any>;
}

export const getPromotionalFlag = (context: RequestContext): FeatureFlag => {
    if (context.cache.has('promo')) {
        return context.cache.get('promo');  // Safe - each request has its own cache
    }
    // ...
    context.cache.set('promo', flag);
    return flag;
};

// Usage in middleware
export async function middleware(request: NextRequest) {
    const context: RequestContext = {
        userId: request.nextUrl.searchParams.get("userId") || "anonymous",
        cache: new Map(),  // Fresh Map per request
    };

    const flag = getPromotionalFlag(context);
    // ...
}
```

### Pattern 2: No Caching (Simplest)

```typescript
// ✅ SAFE: Just compute fresh every time
export const getPromotionalFlag = (userId: string): FeatureFlag => {
    // No cache - no leak
    const flag = computeFlag(userId);
    return flag;
};
```

### Pattern 3: AsyncLocalStorage

```typescript
// ✅ SAFE: AsyncLocalStorage provides request isolation
import { AsyncLocalStorage } from "async_hooks";

const requestStorage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(context: RequestContext, fn: () => T): T {
    return requestStorage.run(context, fn);
}

export function getRequestContext(): RequestContext {
    return requestStorage.getStore()!;
}

// Usage
export async function middleware(request: NextRequest) {
    const context = createRequestContext(userId);

    return withRequestContext(context, () => {
        // All functions can access isolated context
        const flag = getPromotionalFlag();
        return NextResponse.next();
    });
}
```

---

## Files Overview

| File | Purpose | Vulnerable? |
|------|---------|-------------|
| `lib/feature-flags.ts` | Promotional flag cache | ❌ Yes |
| `lib/store-initializer.ts` | Store initialization guards | ❌ Yes |
| `lib/safe-patterns.ts` | Safe alternatives | ✅ No |
| `middleware.ts` | Uses vulnerable patterns | ❌ Yes |
| `app/api/test-leak/route.ts` | API to inspect state | ✅ Safe |
| `app/test-leak/page.tsx` | UI to test leaks | ✅ Safe (client) |
| `eslint-rules/no-server-module-state.js` | Custom ESLint rule | N/A |
| `load-test-module-leak.js` | Automated leak detector | N/A |

---

## Comparing with Other Branches

| Branch | Focus | Issue Type |
|--------|-------|------------|
| `vulnerable` | Multiple `cookies()` calls | AsyncLocalStorage context |
| `fixed` | Single `cookies()` call | AsyncLocalStorage context |
| **`module-scope-leaks`** | **Module-level state** | **JavaScript module caching** |

All three branches demonstrate issues with Fluid Compute, but different root causes:
- `vulnerable`/`fixed`: Runtime context management
- `module-scope-leaks`: Module system behavior

---

## Troubleshooting

### ESLint Not Showing Errors?

Make sure you're using `.eslintrc.js` (not `.eslintrc.json`):

```bash
ls -la .eslintrc.*
```

Should see `.eslintrc.js` that loads the custom rule.

### Load Test Shows No Leaks?

Possible reasons:
1. Requests hit different runtime instances (not enough load)
2. Try increasing the number of users: `node load-test-module-leak.js <url> 50`
3. Run the test multiple times

### Local Testing Not Showing Leaks?

Local Next.js dev server may not reuse instances the same way Vercel does. Deploy to Vercel for more reliable reproduction.

---

## Next Steps

1. **Review the ESLint errors** in vulnerable files
2. **Run the load test** against deployed version
3. **Compare with safe patterns** in `lib/safe-patterns.ts`
4. **Apply ESLint rule** to your production codebase
5. **Fix vulnerable patterns** using request-scoped context

---

## Learn More

- [Vercel Fluid Compute Documentation](https://vercel.com/docs/functions/runtimes)
- [Node.js Module System](https://nodejs.org/api/modules.html)
- [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [JavaScript Module Caching](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)

---

**For questions or issues, create a GitHub issue on this repository.**
