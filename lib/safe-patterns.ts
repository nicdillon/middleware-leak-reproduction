/**
 * SAFE PATTERNS: Request-Scoped State
 *
 * This file demonstrates the CORRECT patterns to use with Vercel Fluid Compute.
 * All state is scoped to the individual request, preventing data leaks.
 */

export interface FeatureFlag {
    name: string;
    metadata?: {
        defaultCoupon?: string;
        from?: string;
        to?: string;
        flags?: string[];
    };
}

export interface RequestContext {
    userId: string;
    cache: Map<string, any>;
    timestamp: number;
}

export interface AppStore {
    userId: string;
    authToken: string;
    timestamp: number;
}

export interface FeatureFlagStore {
    userId: string;
    flags: Record<string, boolean>;
}

/**
 * ✅ SAFE: Request-scoped caching with explicit context
 *
 * Each request gets its own context with its own cache.
 * No module-scope state means no leaking.
 */
export const getPromotionalFlag = (context: RequestContext): FeatureFlag => {
    const cacheKey = "promotionalFlag";
    const { userId, cache } = context;

    console.log(`[${userId}] getPromotionalFlag called (SAFE version)`);

    // Check request-scoped cache
    if (cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        console.log(`[${userId}] ✅ Returning cached promo (from THIS request only):`, cached);
        return cached;
    }

    console.log(`[${userId}] Computing fresh promotional flag...`);

    // Compute promotional flag for this user
    const userPromo: FeatureFlag = {
        name: `PROMO_${userId}`,
        metadata: {
            defaultCoupon: `COUPON_${userId}_${context.timestamp % 1000}`,
            from: new Date().toISOString(),
            to: new Date(Date.now() + 86400000).toISOString(),
        },
    };

    // Store in request-scoped cache
    cache.set(cacheKey, userPromo);

    console.log(`[${userId}] ✅ Cached promo in request context:`, userPromo);

    return userPromo;
};

/**
 * ✅ SAFE: No caching at all - compute fresh every time
 *
 * Simplest safe pattern: just compute what you need per request.
 * No state = no leaks.
 */
export const getPromotionalFlagNoCache = (userId: string): FeatureFlag => {
    console.log(`[${userId}] getPromotionalFlagNoCache called (SAFE - no caching)`);

    const timestamp = Date.now();

    return {
        name: `PROMO_${userId}`,
        metadata: {
            defaultCoupon: `COUPON_${userId}_${timestamp % 1000}`,
            from: new Date().toISOString(),
            to: new Date(Date.now() + 86400000).toISOString(),
        },
    };
};

/**
 * ✅ SAFE: App store initialization without module-scope guard
 *
 * No initialization guard needed - just create fresh data per request.
 */
export const initializeAppStore = (context: RequestContext, authToken: string): AppStore => {
    const { userId } = context;

    console.log(`[${userId}] initializeAppStore called (SAFE version)`);

    const store: AppStore = {
        userId,
        authToken,
        timestamp: context.timestamp,
    };

    console.log(`[${userId}] ✅ Created fresh app store:`, store);

    // Store in request context if needed for later use
    context.cache.set("appStore", store);

    return store;
};

/**
 * ✅ SAFE: Feature flag store initialization
 */
export const initializeFeatureFlagStore = (context: RequestContext, flags: Record<string, boolean>): FeatureFlagStore => {
    const { userId } = context;

    console.log(`[${userId}] initializeFeatureFlagStore called (SAFE version)`);

    const store: FeatureFlagStore = {
        userId,
        flags,
    };

    console.log(`[${userId}] ✅ Created fresh feature flag store:`, store);

    // Store in request context if needed
    context.cache.set("featureFlagStore", store);

    return store;
};

/**
 * ✅ SAFE: Get app store from request context
 */
export const getAppStore = (context: RequestContext): AppStore | null => {
    return context.cache.get("appStore") || null;
};

/**
 * ✅ SAFE: Get feature flag store from request context
 */
export const getFeatureFlagStore = (context: RequestContext): FeatureFlagStore | null => {
    return context.cache.get("featureFlagStore") || null;
};

/**
 * ✅ SAFE: Helper to create request context
 *
 * Call this at the start of middleware/API route to create isolated context.
 */
export const createRequestContext = (userId: string): RequestContext => {
    return {
        userId,
        cache: new Map(), // Fresh Map for each request
        timestamp: Date.now(),
    };
};

// ✅ SAFE: Immutable constants are always safe at module scope
export const FEATURE_FLAGS_CONFIG = {
    maxCacheSize: 100,
    cacheTTL: 3600,
    enableLogging: true,
} as const;

// ✅ SAFE: Pure functions are always safe
export function calculateDiscount(basePrice: number, discountPercent: number): number {
    return basePrice * (1 - discountPercent / 100);
}
