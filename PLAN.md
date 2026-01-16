# Middleware Cookie Leak Reproduction Plan

## Overview

This project reproduces a reported issue where Vercel's Fluid Compute causes memory leaks between customer requests, leading to cookie mixing and AB personalization test contamination.

## Problem Statement

A customer reported that when Fluid Compute is enabled on Vercel, cookies from one user's request were appearing in another user's request, specifically affecting Dynamic Yield AB testing cookies. The issue appears to be related to concurrency problems in Next.js middleware.

## Root Cause Hypothesis

Based on analysis of the production middleware (`apps/nectarsleep/middleware.ts`), we identified several potential concurrency issues:

1. **Multiple `cookies()` calls** - The middleware calls `cookies()` multiple times, creating separate cookie store instances
2. **Nested async operations** - Helper functions internally call `cookies()`, leading to interleaved async operations
3. **Race conditions with external APIs** - Dynamic Yield API calls combined with cookie reads/writes create timing vulnerabilities
4. **Silent error handling** - Errors don't guarantee a response, potentially causing undefined behavior

## Reproduction Strategy

### Project Structure

```
middleware-leak-reproduction/
├── PLAN.md                        # This file
├── README.md                      # Setup and running instructions
├── middleware.ts                  # Different per branch
├── app/
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Info page
│   ├── test/
│   │   └── page.tsx               # Load test UI (concurrent requests)
│   └── api/
│       └── test-cookies/
│           └── route.ts           # Returns cookies for verification
├── lib/
│   └── helpers.ts                 # Helper functions (vulnerable vs fixed)
├── package.json
├── tsconfig.json
├── next.config.js
└── vercel.json                    # Fluid Compute configuration
```

### Git Branch Strategy

#### `main` Branch
- Project documentation (README, PLAN)
- Setup instructions
- No middleware implementation

#### `vulnerable` Branch
- Implements problematic patterns from production code:
  - Multiple `cookies()` calls (main middleware + helper functions)
  - `getUUID()` helper that calls `cookies()` internally
  - `getMockABTestCookies()` that simulates Dynamic Yield API with delay
  - Cookie store read in helper, then async API call, then cookie write
  - Sets personalization cookies based on request user ID

#### `fixed` Branch
- Implements recommended fixes:
  - Single `cookies()` call at middleware entry point
  - Cookie store passed as parameter to all helper functions
  - No nested `cookies()` calls
  - Proper error handling with guaranteed NextResponse return
  - Same mock API delay for fair comparison

### Test Methodology

1. **Load Test Page** (`/test`)
   - Client-side React page
   - Fires 100 concurrent fetch requests to `/api/test-cookies`
   - Each request includes unique `userId` query parameter (user-1, user-2, etc.)
   - Displays results showing cookie values received per request
   - Highlights any mismatches where User A received User B's cookies

2. **Test API Endpoint** (`/api/test-cookies`)
   - Reads cookies from request
   - Returns JSON with:
     - Request user ID
     - Cookies received (especially `ab_test_id` and `user_uuid`)
     - Timestamp
     - Request ID

3. **Middleware Behavior**
   - Reads `userId` from query parameter
   - Calls helper to get/create UUID (calls `cookies()` in vulnerable version)
   - Calls helper to get AB test cookies with mock API delay
   - Sets cookies on response:
     - `user_uuid` - Should match request userId
     - `ab_test_id` - Should be deterministic per userId
     - `request_timestamp` - Request timestamp

### Expected Results

#### Vulnerable Branch
- **Expected**: Cookie mixing will occur under load
- User-1 will occasionally receive cookies intended for User-2
- Results page will show mismatches (red highlighting)
- More pronounced with Fluid Compute enabled on Vercel

#### Fixed Branch
- **Expected**: No cookie mixing
- Each user receives only their own cookies
- Results page shows 100% match rate (green)
- Proper isolation regardless of Fluid Compute setting

## Deployment Plan

### Phase 1: Setup
1. ✅ Create project directory structure
2. ✅ Initialize git repository
3. ✅ Create PLAN.md documentation
4. Create base Next.js project files
5. Commit to `main` branch
6. Create GitHub repository
7. Push to GitHub

### Phase 2: Vulnerable Implementation
1. Create `vulnerable` branch from `main`
2. Implement middleware with problematic patterns
3. Create helper functions that call `cookies()` internally
4. Create test page and API endpoint
5. Commit and push `vulnerable` branch
6. Deploy to Vercel (auto-deploys on push)

### Phase 3: Fixed Implementation
1. Create `fixed` branch from `main`
2. Implement middleware with single `cookies()` call
3. Modify helpers to accept cookie store as parameter
4. Same test page and API endpoint
5. Commit and push `fixed` branch
6. Deploy to Vercel (auto-deploys on push)

### Phase 4: Testing & Verification
1. Enable Fluid Compute in Vercel project settings
2. Run load tests on vulnerable deployment
3. Document cookie mixing occurrences
4. Run load tests on fixed deployment
5. Verify no cookie mixing occurs
6. Compare results and document findings

## Vercel Configuration

### vercel.json
```json
{
  "framework": "nextjs",
  "functions": {
    "middleware.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  }
}
```

### Project Settings
- **Framework**: Next.js 15.x
- **Node Version**: 20.x
- **Runtime**: Edge (experimental-edge)
- **Fluid Compute**: Enabled (requires Pro/Enterprise plan)

## Success Criteria

1. **Vulnerability Confirmed**: Vulnerable branch demonstrates cookie mixing under concurrent load
2. **Fix Validated**: Fixed branch shows zero cookie mixing under same load conditions
3. **Root Cause Verified**: Confirms that multiple `cookies()` calls cause the issue
4. **Solution Documented**: Clear recommendations for production fix

## Timeline

- **Setup**: 30 minutes
- **Vulnerable Implementation**: 1 hour
- **Fixed Implementation**: 1 hour
- **Testing & Verification**: 1-2 hours
- **Documentation**: 30 minutes

**Total Estimated Time**: 4-5 hours

## Team & Resources

- **GitHub Organization**: TBD
- **Vercel Team**: Dev Success Team
- **Primary Contact**: Customer reporting the issue

## Next Steps

After confirming the reproduction and fix:
1. Document findings in detailed report
2. Create production fix PR for `apps/nectarsleep/middleware.ts`
3. Apply same fixes to other brand apps (Cloverlane, DreamCloud, Awara)
4. Add monitoring/logging to detect future cookie leaks
5. Consider adding integration tests for middleware cookie isolation
