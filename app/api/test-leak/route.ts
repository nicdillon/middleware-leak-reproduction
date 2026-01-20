import { NextRequest, NextResponse } from "next/server";
import { getPromotionalFlag } from "../../../lib/feature-flags";
import { getAppStore, getFeatureFlagStore } from "../../../lib/store-initializer";

/**
 * API Route to test module-scope state leaks
 *
 * This endpoint returns the current state of module-scope variables,
 * allowing us to detect when User B sees User A's data.
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "anonymous";

    console.log(`\n[API] test-leak called by userId: ${userId}`);

    // Get current module state
    const promoFlag = getPromotionalFlag(userId);
    const appStore = getAppStore();
    const featureFlagStore = getFeatureFlagStore();

    // Detect leaks
    const promoUserId = promoFlag.name.replace("PROMO_", "");
    const promoLeaked = promoUserId !== userId;

    const appStoreUserId = appStore?.userId || null;
    const appStoreLeaked = appStoreUserId !== null && appStoreUserId !== userId;

    const featureFlagStoreUserId = featureFlagStore?.userId || null;
    const featureFlagStoreLeaked = featureFlagStoreUserId !== null && featureFlagStoreUserId !== userId;

    const anyLeakDetected = promoLeaked || appStoreLeaked || featureFlagStoreLeaked;

    const result = {
        requestedUserId: userId,
        moduleState: {
            promotionalFlag: {
                name: promoFlag.name,
                coupon: promoFlag.metadata?.defaultCoupon,
                belongsTo: promoUserId,
                leaked: promoLeaked,
            },
            appStore: appStore
                ? {
                      userId: appStore.userId,
                      authToken: appStore.authToken.substring(0, 20) + "...",
                      leaked: appStoreLeaked,
                  }
                : null,
            featureFlagStore: featureFlagStore
                ? {
                      userId: featureFlagStore.userId,
                      flags: featureFlagStore.flags,
                      leaked: featureFlagStoreLeaked,
                  }
                : null,
        },
        leakDetection: {
            anyLeakDetected,
            promoLeaked,
            appStoreLeaked,
            featureFlagStoreLeaked,
        },
        timestamp: Date.now(),
    };

    console.log(`[API] Result for ${userId}:`, JSON.stringify(result, null, 2));

    return NextResponse.json(result);
}
