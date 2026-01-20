/**
 * VULNERABLE: Store Initialization Guards
 *
 * This demonstrates initialization guard anti-patterns where the first user
 * initializes the store, and all subsequent users skip initialization.
 *
 * Issue: First user initializes, all subsequent users get stale data
 */

// ❌ ANTI-PATTERN #3: Module-scope initialization guards
let appStoreInitialized = false;
let featureFlagStoreInitialized = false;

export interface AppStore {
    userId: string;
    authToken: string;
    timestamp: number;
}

export interface FeatureFlagStore {
    userId: string;
    flags: Record<string, boolean>;
}

// Simulated stores (also at module scope - VULNERABLE!)
let appStoreData: AppStore | null = null;
let featureFlagStoreData: FeatureFlagStore | null = null;

/**
 * VULNERABLE: App store initialization with module-scope guard
 *
 * This reproduces the pattern where only the first user's data
 * gets initialized, and all subsequent users skip initialization.
 */
export const initializeAppStore = (userId: string, authToken: string): void => {
    console.log(`[${userId}] initializeAppStore called`);
    console.log(`[${userId}] appStoreInitialized is currently: ${appStoreInitialized}`);

    if (!appStoreInitialized) {
        console.log(`[${userId}] ✅ FIRST USER - Initializing app store`);

        appStoreData = {
            userId,
            authToken,
            timestamp: Date.now(),
        };

        appStoreInitialized = true; // VULNERABLE - stays true forever!

        console.log(`[${userId}] App store initialized:`, appStoreData);
    } else {
        console.log(`[${userId}] ⚠️  SKIPPING INITIALIZATION - already initialized by another user!`);
        console.log(`[${userId}] Current app store data (belongs to another user):`, appStoreData);
    }
};

/**
 * VULNERABLE: Feature flag store initialization with module-scope guard
 */
export const initializeFeatureFlagStore = (userId: string, flags: Record<string, boolean>): void => {
    console.log(`[${userId}] initializeFeatureFlagStore called`);
    console.log(`[${userId}] featureFlagStoreInitialized is currently: ${featureFlagStoreInitialized}`);

    if (!featureFlagStoreInitialized) {
        console.log(`[${userId}] ✅ FIRST USER - Initializing feature flag store`);

        featureFlagStoreData = {
            userId,
            flags,
        };

        featureFlagStoreInitialized = true; // VULNERABLE - stays true forever!

        console.log(`[${userId}] Feature flag store initialized:`, featureFlagStoreData);
    } else {
        console.log(`[${userId}] ⚠️  SKIPPING INITIALIZATION - already initialized by another user!`);
        console.log(`[${userId}] Current feature flag store (belongs to another user):`, featureFlagStoreData);
    }
};

/**
 * Get current app store data (will show wrong user after first initialization)
 */
export const getAppStore = (): AppStore | null => {
    return appStoreData;
};

/**
 * Get current feature flag store data (will show wrong user after first initialization)
 */
export const getFeatureFlagStore = (): FeatureFlagStore | null => {
    return featureFlagStoreData;
};

/**
 * Helper to reset state (for testing - this should happen per request but doesn't!)
 */
export const resetStoreState = () => {
    console.log("🔄 RESETTING store state (this should happen per-request, but doesn't!)");
    appStoreInitialized = false;
    featureFlagStoreInitialized = false;
    appStoreData = null;
    featureFlagStoreData = null;
};

/**
 * Helper to inspect module state
 */
export const inspectStoreState = (userId: string) => {
    console.log(`[${userId}] 🔍 STORE STATE INSPECTION:`);
    console.log(`  - appStoreInitialized:`, appStoreInitialized);
    console.log(`  - appStoreData:`, appStoreData);
    console.log(`  - featureFlagStoreInitialized:`, featureFlagStoreInitialized);
    console.log(`  - featureFlagStoreData:`, featureFlagStoreData);
};
