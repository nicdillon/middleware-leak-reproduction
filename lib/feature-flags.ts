/**
 * VULNERABLE: Module-Scope State Leak
 *
 * This file demonstrates anti-patterns that cause data leaking
 * with Vercel Fluid Compute.
 *
 * Issues demonstrated:
 * 1. Module-scope mutable cache (promotionalFlagCache)
 * 2. Module-scope initialization guard (promoFallbackFailed)
 * 3. First-user-wins behavior
 */

// ❌ ANTI-PATTERN #1: Module-scope mutable cache
// This persists across requests when runtime is reused
let promotionalFlagCache: Record<string, any> = {};

// ❌ ANTI-PATTERN #2: Module-scope initialization guard
// Once set to true by first user, stays true for all users
let promoFallbackFailed = false;

export interface FeatureFlag {
    name: string;
    metadata?: {
        defaultCoupon?: string;
        from?: string;
        to?: string;
        flags?: string[];
    };
}

/**
 * VULNERABLE: getPromotionalFlag with module-scope caching
 *
 * This reproduces a common pattern where User B sees User A's cached data.
 */
export const getPromotionalFlag = (userId: string): FeatureFlag => {
    const timestamp = Date.now();

    console.log(`[${userId}] getPromotionalFlag called at ${timestamp}`);
    console.log(`[${userId}] promotionalFlagCache current state:`, promotionalFlagCache);

    // Check module-scope cache (VULNERABLE!)
    if (promotionalFlagCache && Object.keys(promotionalFlagCache).length > 0) {
        console.log(`[${userId}] ⚠️  RETURNING CACHED PROMO (may be from another user!):`, promotionalFlagCache);
        return promotionalFlagCache as FeatureFlag;
    }

    console.log(`[${userId}] Computing fresh promotional flag...`);

    // Simulate promotional flag logic based on user
    const userPromo: FeatureFlag = {
        name: `PROMO_${userId}`,
        metadata: {
            defaultCoupon: `COUPON_${userId}_${timestamp % 1000}`,
            from: new Date().toISOString(),
            to: new Date(Date.now() + 86400000).toISOString(),
        },
    };

    // Store in module-scope cache (VULNERABLE!)
    promotionalFlagCache = userPromo;

    console.log(`[${userId}] Cached new promo:`, promotionalFlagCache);

    return userPromo;
};

/**
 * VULNERABLE: Promo fallback with module-scope flag
 *
 * Once promoFallbackFailed is set to true by first user,
 * subsequent users never see the fallback warning.
 */
export const checkPromoFallback = (userId: string): boolean => {
    console.log(`[${userId}] checkPromoFallback - promoFallbackFailed is: ${promoFallbackFailed}`);

    // Simulate fallback check
    const shouldFallback = Math.random() > 0.5;

    if (shouldFallback && !promoFallbackFailed) {
        console.log(`[${userId}] ⚠️  FIRST TIME seeing fallback - setting promoFallbackFailed to true`);
        promoFallbackFailed = true; // VULNERABLE - persists across requests!
        return true;
    }

    if (shouldFallback && promoFallbackFailed) {
        console.log(`[${userId}] Fallback needed but promoFallbackFailed already true (set by another user)`);
    }

    return false;
};

/**
 * Helper to reset state (for testing purposes only)
 * In real app, this would never be called, so state persists forever
 */
export const resetPromotionalState = () => {
    console.log("🔄 RESETTING promotional state (this should happen per-request, but doesn't!)");
    promotionalFlagCache = {};
    promoFallbackFailed = false;
};

/**
 * Helper to inspect current module state
 */
export const inspectModuleState = (userId: string) => {
    console.log(`[${userId}] 🔍 MODULE STATE INSPECTION:`);
    console.log(`  - promotionalFlagCache:`, promotionalFlagCache);
    console.log(`  - promoFallbackFailed:`, promoFallbackFailed);
};
