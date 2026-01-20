# Next.js Middleware Cookie Leak Investigation

## Executive Summary

**Customer Report**: A Next.js application on Vercel experiences cookie mixing between users when Fluid Compute is enabled. AB personalization test cookies intended for User A are appearing in User B's requests. The issue is **100% correlated with Fluid Compute** - it starts when Fluid Compute is enabled and stops when disabled.

**Status**: ❌ **Root cause not identified**. Despite comprehensive testing and code analysis, we cannot reproduce the issue or definitively identify the mechanism causing cookie leaking.

---

## Customer Environment

### Confirmed Details
- **Next.js Version**: 15.4.9
- **React Version**: 19.2.2
- **Runtime**: Edge Runtime (`experimental-edge`)
- **Fluid Compute**: Enabled (Pro/Enterprise plan)
- **Architecture**: Monorepo with multiple brand apps (Nectar Sleep, DreamCloud, Awara, Cloverlane)
- **Middleware Location**: `/Users/nicdillon/Downloads/brands/apps/nectarsleep/middleware.ts`

### Middleware Pattern
The customer's middleware:
1. Calls `cookies()` at the start
2. Calls `getUUID()` which internally calls `cookies()` again
3. Calls `getDynamicYieldCookies()` which:
   - Internally calls both `cookies()` and `headers()`
   - Makes external `fetch()` to Dynamic Yield API (`https://dy-api.com/v2/serve/user/choose`)
   - Has 50-500ms latency waiting for DY API response
   - Returns personalized AB test cookies to set

**Critical Pattern**: Multiple `cookies()` calls + external async `fetch()` + more `cookies()` calls after fetch completes

### Key Customer Code References
- Middleware: `/Users/nicdillon/Downloads/brands/apps/nectarsleep/middleware.ts`
- DY Integration: `/Users/nicdillon/Downloads/brands/libs/apis/src/lib/dynamic-yield/middleware.ts`
- DY Main API: `/Users/nicdillon/Downloads/brands/libs/apis/src/lib/dynamic-yield/index.ts`

---

## Initial Hypothesis

**Theory**: AsyncLocalStorage context corruption in Edge Runtime during external fetch operations.

**Reasoning**:
- Next.js 15's `cookies()` and `headers()` rely on AsyncLocalStorage for request context
- Edge Runtime (based on V8/web standards) might have immature AsyncLocalStorage implementation
- External `fetch()` operations create async boundaries where context could leak
- With Fluid Compute, function instances are reused across requests
- If AsyncLocalStorage context corrupts during fetch, User A's request could see User B's cookies

**Supporting Evidence Found**:
- GitHub Issue #52774: "AsyncLocalStorage not passed within thenables when deployed to Vercel Edge runtime"
  - Status: Marked as fixed (Cloudflare Workers specific, not Vercel Edge Runtime)
  - Note: This issue was about deploying to Cloudflare Workers, NOT Vercel Edge Runtime
- Vercel docs confirm Fluid Compute shares "global state/process" between concurrent invocations

**Hypothesis Status**: ❌ **Could not be validated** - tests showed no context corruption

---

## Reproduction Attempts

### What We Built

Created reproduction project at: `/Users/nicdillon/Documents/Projects/middleware-leak-reproduction`

**Repository**: https://github.com/nicdillon/middleware-leak-reproduction
**Vercel Project**: dev-success-vtest314/middleware-leak-reproduction

### Two Branch Strategy

#### `vulnerable` Branch (Edge Runtime)
- **Runtime**: `experimental-edge`
- **Pattern**: Exact replica of customer's problematic pattern
  - Multiple `cookies()` calls
  - External `fetch()` to `httpbin.org/delay` (100-200ms)
  - `cookies()` called before and after fetch
  - Request ID tracking through async boundaries
  - Comprehensive logging
- **Deployment**: https://middleware-leak-reproduction-git-vu-be91f6-dev-success-vtest314.vercel.app

#### `fixed` Branch (Node.js Runtime)
- **Runtime**: `nodejs`
- **Pattern**: SAME problematic patterns as vulnerable
  - Multiple `cookies()` calls
  - Same external fetch patterns
  - Same delays
- **Purpose**: Test if Node.js runtime's mature AsyncLocalStorage prevents the issue
- **Deployment**: https://middleware-leak-reproduction-git-fixed-dev-success-vtest314.vercel.app

### Test Infrastructure

**Load Testing Script**: `load-test.js`
- Fires concurrent requests from external Node.js process (not browser)
- Each request passes unique `userId` query parameter
- Middleware sets cookies based on `userId`
- Verifies middleware set correct userId via custom headers
- Supports Vercel protection bypass token

**Test Execution**:
```bash
node load-test.js <deployment-url> <num-requests> <bypass-token>
```

---

## Test Results

### Edge Runtime Tests (Vulnerable Branch)
```
✅ 50 concurrent requests:  100% success rate (0 mismatches)
✅ 200 concurrent requests: 100% success rate (0 mismatches)
```

### Node.js Runtime Tests (Fixed Branch)
```
✅ 50 concurrent requests:  100% success rate (0 mismatches)
```

### Analysis
- ❌ **No cookie mixing detected** in any test
- ✅ External fetch with 100-200ms delays works correctly
- ✅ Multiple `cookies()` calls don't cause context corruption
- ✅ Both edge and nodejs runtimes show identical behavior

**Conclusion**: Our reproduction does not trigger the issue the customer is experiencing.

---

## Code Analysis

### Customer Codebase Inspection

**Searched For**:
- Module-level mutable variables (`let`/`var`)
- Shared caches or singletons
- Global state that could leak between requests
- Closures capturing request-specific data

**Findings**:
- ✅ No module-level mutable state in nectarsleep app
- ✅ No shared mutable state in Dynamic Yield integration
- ✅ All module-level constants are read-only (`apiKey`, `siteURLs`, etc.)
- ✅ Zustand stores are client-side only (not relevant to middleware)
- ✅ No obvious caching mechanisms that could leak

**Files Inspected**:
- `/Users/nicdillon/Downloads/brands/apps/nectarsleep/middleware.ts`
- `/Users/nicdillon/Downloads/brands/libs/apis/src/lib/dynamic-yield/middleware.ts`
- `/Users/nicdillon/Downloads/brands/libs/apis/src/lib/dynamic-yield/index.ts`
- `/Users/nicdillon/Downloads/brands/libs/apis/src/lib/dynamic-yield/utils.ts`
- `/Users/nicdillon/Downloads/brands/libs/common/src/lib/cache.ts`
- `/Users/nicdillon/Downloads/brands/libs/stores/src/lib/product-cache/store.ts`

---

## Web Research Findings

### Search Queries Performed
1. "Next.js 15" "cookies()" "headers()" middleware edge runtime race condition concurrent 2025
2. Next.js middleware async fetch AsyncLocalStorage context bleed concurrent requests vercel edge
3. "Vercel Fluid Compute" cookie mixing concurrency 2024 2025
4. Next.js middleware concurrent requests cookies wrong user 2024 2025
5. "Next.js" middleware "state pollution" "shared state" Vercel 2024 2025
6. Next.js 15 middleware Fluid Compute bug instance reuse site:github.com 2024 2025

### Key Findings

**Vercel Fluid Compute Official Docs** (https://vercel.com/docs/fluid-compute):
> "Unlike traditional serverless that isolates each invocation in a microVM, Fluid Compute allows **multiple invocations to share a single function instance** concurrently... multiple invocations share the same **global state/process**."

**Critical Point**: Vercel officially documents that Fluid Compute shares instances and global state. This applies to **both** edge and nodejs runtimes.

**No Public Bug Reports Found**:
- ❌ No GitHub issues about cookie mixing between users with Fluid Compute
- ❌ No Stack Overflow questions about this specific problem
- ❌ No Hacker News discussions reporting actual incidents
- ❌ No Vercel changelog entries addressing this
- ❌ No public mentions of "cookie mixing" in Vercel Edge Runtime context

**Related Issues Found** (but different problems):
- CVE-2025-29927: Next.js middleware bypass (authentication bypass, not concurrency)
- Next.js #82952: Cookie inconsistency between `response.cookies.set()` and `cookies()`
- Next.js #72317: Cookies not immediately visible in pages after middleware sets them
- Various Next.js 15 cookie timing issues

**Hacker News Discussion** (https://news.ycombinator.com/item?id=43067938):
- Discussions about "noisy neighbor" concerns with Fluid Compute
- No reports of actual cookie mixing or cross-request contamination
- Theoretical concerns about shared state, but no documented incidents

### Important Clarification

**Previous Error**: Initially stated that Vercel Edge Runtime runs on Cloudflare Workers based on GitHub issue #52774. This was **incorrect**. That issue was about deploying Next.js to actual Cloudflare Workers, not about Vercel's Edge Runtime infrastructure.

**Correct Understanding**: Vercel Edge Runtime is Vercel's own runtime environment based on V8 and Web Standards APIs, running on Vercel's infrastructure.

---

## What We Know vs. What We Don't Know

### ✅ Confirmed Facts
1. **Issue is 100% Fluid Compute correlated**
   - Starts when Fluid Compute is enabled
   - Stops when Fluid Compute is disabled
   - Customer has verified this multiple times

2. **Fluid Compute Architecture**
   - Officially shares function instances between requests
   - Shares "global state/process" between concurrent invocations
   - Applies to both edge and nodejs runtimes

3. **Customer's Environment**
   - Next.js 15.4.9
   - Edge Runtime
   - Multiple `cookies()` calls pattern
   - External fetch to Dynamic Yield API

4. **Our Tests**
   - Cannot reproduce the issue
   - Both edge and nodejs runtimes show 100% success
   - 200+ concurrent requests don't trigger it

### ❌ Unknown / Unproven

1. **Root Cause**
   - What specific mechanism causes the cookie leaking?
   - Is it AsyncLocalStorage? Something else?
   - Why can't we reproduce it?

2. **Frequency & Severity**
   - What % of requests are affected?
   - How often does it happen?
   - Is it rare (< 1%) or common (> 10%)?

3. **Specific Conditions**
   - Does it require specific traffic patterns?
   - Specific load levels?
   - Specific timing windows?
   - Specific geographic regions?

4. **Which Cookies Affected**
   - Only Dynamic Yield cookies (`_dyid`, `_dyid_server`, `_dyjsession`)?
   - Or all cookies including `authToken`, `ser_uuid`, `nextLocation`?
   - Are ALL of User A's cookies appearing in User B's request?
   - Or just specific ones?

5. **Node.js Runtime as Solution**
   - Will switching to `runtime: "nodejs"` actually fix it?
   - Or will the issue persist since Fluid Compute still reuses instances?

---

## Critical Questions for Customer

To narrow down the root cause, we need answers to:

### 1. Frequency & Severity
- How often does the cookie mixing occur? (% of requests, times per day?)
- Is it intermittent or consistent under certain conditions?
- Has it gotten worse or better over time?
- When did it first start happening?

### 2. Specific Cookies Affected
- **Which exact cookies are mixing?**
  - Only Dynamic Yield cookies (`_dyid`, `_dyid_server`, `_dyjsession`)?
  - Or other cookies too (`authToken`, `ser_uuid`, `nextLocation`, etc.)?
- Are ALL cookies from User A appearing in User B's request?
- Or just some cookies?
- Which cookie values are getting crossed between users?

### 3. Traffic & Load Conditions
- What traffic level does this occur at? (requests/second, concurrent users?)
- Does it happen more during traffic spikes?
- Does it occur on specific pages or all pages?
- Is it more common on mobile vs desktop?
- Any patterns by time of day, day of week?

### 4. Observable Evidence
- Do you have specific examples or logs showing User A receiving User B's cookies?
- Can you provide:
  - Request IDs or timestamps when it occurred
  - User identifiers showing the mix-up
  - Vercel function logs from when it occurred
  - DataDog traces showing the issue
  - Actual cookie values that got crossed

### 5. User Impact & Detection
- What's the actual user experience?
  - Seeing wrong AB test variant?
  - Wrong personalization?
  - Wrong user data?
- How are you detecting this?
  - User reports?
  - Monitoring/alerting?
  - Logs?
  - Analytics showing anomalies?
- Can you reproduce it manually or is it only in production?

### 6. Environment Confirmation
- Can you confirm Fluid Compute is **definitely enabled** in Vercel project settings?
- Screenshot or confirmation from Vercel dashboard?
- Are you on Vercel Pro or Enterprise plan? (required for Fluid Compute)
- Any recent deployments or config changes before the issue started?
- Any custom middleware beyond `apps/nectarsleep/middleware.ts`?

---

## Possible Alternative Hypotheses

Since our AsyncLocalStorage hypothesis couldn't be validated:

### 1. Not AsyncLocalStorage - Different Mechanism
The issue might not be related to `cookies()` or AsyncLocalStorage at all. Possibilities:
- Bug in Next.js 15.4.9's edge runtime middleware implementation
- Bug in Vercel's Fluid Compute routing/request handling
- Issue with how Dynamic Yield API responses are handled
- Response object reuse or mutation

### 2. Dynamic Yield API Server-Side Issue
The Dynamic Yield API itself might be returning wrong user data:
- Their server might have the bug, not our code
- Could be related to how they handle concurrent requests
- Might be sending User B's data in response to User A's request

### 3. Timing-Specific Race Condition
Our tests might not be hitting the exact timing window:
- Might require very specific request interleaving
- Could be related to specific edge node regions
- Might only trigger under real production load patterns

### 4. CDN or Caching Issue
Despite being marked `cache: "no-store"`:
- Vercel edge cache might be involved
- CDN layer might be caching responses incorrectly
- Not actually Fluid Compute, but being blamed due to timing correlation

### 5. Browser/Client-Side Issue
Cookies might be getting mixed on client side:
- Browser cookie storage corruption
- Service worker interference
- Not a server-side issue at all

### 6. Vercel Platform Bug
A genuine bug in Vercel's Fluid Compute implementation:
- Only triggered under specific conditions we haven't found
- Only happens in specific regions
- Only happens with specific request patterns
- Rare enough that it hasn't been publicly reported

---

## Recommendations

### Option 1: Immediate Mitigation (No Root Cause Understanding)

**Switch to Node.js Runtime**:
```typescript
// In middleware.ts
export const config = {
    runtime: "nodejs",  // Change from "experimental-edge"
    matcher: [ /* same */ ],
};
```

**Prerequisites**:
- Upgrade to Next.js 15.5+ (customer is on 15.4.9)
- Node.js middleware is stable in 15.5+

**Pros**:
- ✅ Low risk
- ✅ Node.js AsyncLocalStorage is more mature (in use since Node v12/2019)
- ✅ Might fix the issue (but not proven)

**Cons**:
- ❌ We don't know if it will actually fix the issue
- ❌ Fluid Compute still reuses instances in nodejs runtime
- ❌ If the issue isn't AsyncLocalStorage-related, this won't help

**Test Plan**:
1. Create staging environment with nodejs runtime
2. Enable Fluid Compute in staging
3. Test for 24-48 hours under production traffic
4. Monitor for cookie mixing
5. Deploy to production if successful

### Option 2: Add Comprehensive Logging First

**Add Request ID Tracking to Production Middleware**:

```typescript
// At the start of middleware
const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const userIdentifier = cookieStore.get("_dyid")?.value || searchParams.get("userId") || "anonymous";

console.log(`[${requestId}] START - User: ${userIdentifier}, URL: ${request.url}`);

// Before getDynamicYieldCookies call
const beforeDYUser = cookieStore.get("_dyid")?.value;
console.log(`[${requestId}] BEFORE DY - _dyid: ${beforeDYUser}`);

// After getDynamicYieldCookies call
const afterDYUser = cookieStore.get("_dyid")?.value;
console.log(`[${requestId}] AFTER DY - _dyid: ${afterDYUser}`);

// Context corruption check
if (beforeDYUser !== afterDYUser && beforeDYUser && afterDYUser) {
  console.error(`[${requestId}] 🚨 COOKIE LEAK DETECTED! User was ${beforeDYUser}, now ${afterDYUser}`);
}

// Also log what we're about to set
console.log(`[${requestId}] END - Setting cookies for user: ${userIdentifier}`);
```

**Monitor Vercel Logs**:
- Search for `🚨 COOKIE LEAK DETECTED!`
- Capture request IDs, timestamps, user identifiers
- Provide this evidence to Vercel support

**Pros**:
- ✅ Captures actual evidence when issue occurs
- ✅ Can be shared with Vercel for investigation
- ✅ Helps understand exact conditions

**Cons**:
- ❌ Issue continues while monitoring
- ❌ May take days/weeks to capture enough evidence

### Option 3: Hybrid Approach (Recommended)

1. **Add logging to production immediately** (monitor for 24-48 hours)
2. **Simultaneously set up staging with nodejs runtime** + Fluid Compute
3. **If logging captures evidence**, send to Vercel support with reproduction
4. **If staging shows nodejs fixes it**, deploy to production
5. **If neither works**, disable Fluid Compute while investigating

---

## Reproduction Project Details

### Repository Structure
```
middleware-leak-reproduction/
├── INVESTIGATION.md           # This file
├── PLAN.md                    # Original reproduction strategy
├── README.md                  # Setup instructions
├── load-test.js               # External load testing script
├── middleware.ts              # Different per branch
├── lib/
│   └── helpers.ts            # Cookie helper functions
├── app/
│   ├── page.tsx              # Info page
│   ├── layout.tsx            # Root layout
│   ├── test/
│   │   └── page.tsx          # Browser-based load test UI
│   └── api/
│       └── test-cookies/
│           └── route.ts      # Test endpoint
├── package.json
├── tsconfig.json
├── next.config.js
└── vercel.json
```

### Deployment URLs
- **Main Branch**: https://middleware-leak-reproduction.vercel.app
- **Vulnerable (Edge)**: https://middleware-leak-reproduction-git-vu-be91f6-dev-success-vtest314.vercel.app
- **Fixed (Node.js)**: https://middleware-leak-reproduction-git-fixed-dev-success-vtest314.vercel.app

### Running Load Tests

**With Vercel bypass token**:
```bash
cd ~/Documents/Projects/middleware-leak-reproduction
node load-test.js https://middleware-leak-reproduction-git-vu-be91f6-dev-success-vtest314.vercel.app 50 n3DVeBD18wj4TNlBtuc8VQJNAWWVXmDq
```

**With environment variable**:
```bash
export VERCEL_AUTOMATION_BYPASS_SECRET=n3DVeBD18wj4TNlBtuc8VQJNAWWVXmDq
node load-test.js <url> 200
```

---

## Next Investigation Steps

### If Continuing This Investigation

1. **Get Customer Answers** to all questions in "Critical Questions for Customer" section

2. **Review Actual Production Evidence**:
   - Vercel function logs from when issue occurred
   - DataDog traces showing cookie values
   - Specific examples of User A / User B mix-up

3. **Test Different Load Patterns**:
   - Geographic distribution (multiple regions simultaneously)
   - Sustained load over time (not just burst)
   - Real Dynamic Yield API instead of httpbin
   - Different request patterns

4. **Deploy Logging to Production**:
   - Add comprehensive request ID tracking
   - Monitor for 48 hours
   - Capture evidence when issue happens

5. **Consider Reaching Out to Vercel Support**:
   - With customer's permission
   - Share this investigation
   - Ask if they've seen similar reports
   - Request deeper investigation of Fluid Compute

6. **Test Node.js Runtime in Customer's Staging**:
   - Switch to nodejs runtime
   - Keep Fluid Compute ON
   - Monitor for same duration
   - Compare results

---

## References

### Key Files in Customer Repo
- `/Users/nicdillon/Downloads/brands/apps/nectarsleep/middleware.ts` - Main middleware
- `/Users/nicdillon/Downloads/brands/libs/apis/src/lib/dynamic-yield/middleware.ts` - DY integration
- `/Users/nicdillon/Downloads/brands/package.json` - Next.js 15.4.9

### External Resources
- [Vercel Fluid Compute Docs](https://vercel.com/docs/fluid-compute)
- [How Fluid Compute Works](https://vercel.com/blog/how-fluid-compute-works-on-vercel)
- [Next.js Edge Runtime](https://nextjs.org/docs/app/api-reference/edge)
- [GitHub Issue #52774](https://github.com/vercel/next.js/issues/52774) - AsyncLocalStorage in Cloudflare Workers (not relevant)
- [Next.js Middleware Docs](https://nextjs.org/docs/app/building-your-application/routing/middleware)

### Search Queries That Found Nothing
- "Vercel Fluid Compute" cookie mixing concurrency
- Next.js middleware cookies "different user" OR "wrong user"
- Next.js middleware "state pollution" "shared state" Vercel

---

## Conclusion

We have built comprehensive testing infrastructure and performed extensive analysis, but **cannot reproduce or definitively explain the customer's issue**.

**What we know for certain**:
- Issue is 100% correlated with Fluid Compute being enabled
- Customer's code has no obvious shared mutable state
- Fluid Compute intentionally shares instances and global state
- No public reports of similar issues exist

**Critical unknowns**:
- Exact mechanism causing the leak
- Why we can't reproduce it
- Whether Node.js runtime will fix it
- Specific conditions that trigger it

**Recommended path forward**: Get detailed production evidence from customer, test Node.js runtime in staging with Fluid Compute enabled, and potentially escalate to Vercel support with findings.

---

*Investigation Date: January 16, 2026*
*Next.js Version Tested: 15.5.9*
*Customer Next.js Version: 15.4.9*
*Vercel Project: dev-success-vtest314/middleware-leak-reproduction*
