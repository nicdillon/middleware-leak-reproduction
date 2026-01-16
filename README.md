# Middleware Cookie Leak Reproduction

This project reproduces a Next.js middleware cookie leak issue that occurs with Vercel's Fluid Compute enabled.

## Problem

When Fluid Compute is enabled on Vercel, cookies from one user's request can leak into another user's request, causing AB test personalization to mix between users.

## Setup

```bash
npm install
npm run dev
```

## Project Branches

### `main` Branch
- Documentation and project setup
- No middleware implementation

### `vulnerable` Branch
- Demonstrates the problematic pattern
- Multiple `cookies()` calls
- Nested async operations
- Cookie mixing occurs under concurrent load

### `fixed` Branch
- Implements the solution
- Single `cookies()` call
- Cookie store passed to helpers
- No cookie mixing

## Testing

1. Deploy both `vulnerable` and `fixed` branches to Vercel
2. Enable Fluid Compute in Vercel project settings
3. Visit `/test` page on each deployment
4. Click "Run Load Test" to fire 100 concurrent requests
5. Observe results:
   - **Vulnerable**: Will show cookie mismatches (User A gets User B's cookies)
   - **Fixed**: All cookies match their intended user

## Deployment URLs

- **Vulnerable**: `https://middleware-leak-reproduction-git-vulnerable-[team].vercel.app`
- **Fixed**: `https://middleware-leak-reproduction-git-fixed-[team].vercel.app`

## Documentation

See [PLAN.md](./PLAN.md) for detailed reproduction strategy and technical analysis.

## Stack

- Next.js 15.4.6
- React 19.1.0
- TypeScript 5.3.3
- Vercel Edge Runtime
