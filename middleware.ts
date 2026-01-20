import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getPromotionalFlag, inspectModuleState } from "./lib/feature-flags";
import { initializeAppStore, initializeFeatureFlagStore, getAppStore, inspectStoreState } from "./lib/store-initializer";

/**
 * VULNERABLE MIDDLEWARE - MODULE-SCOPE STATE LEAKS
 *
 * This middleware demonstrates module-scope state leaking with Fluid Compute.
 * Unlike the other branches that focus on cookies() behavior, this branch
 * demonstrates the anti-patterns of:
 * 1. Module-scope mutable caching
 * 2. Module-scope initialization guards
 * 3. First-user-wins behavior
 *
 * Expected behavior with Fluid Compute:
 * - First user (e.g., userId=A) initializes module state
 * - Subsequent users (userId=B, C, D) get the cached state from user A
 * - User B sees "PROMO_A" instead of "PROMO_B"
 * - User B's stores are never initialized (skipped due to guard)
 */
export async function middleware(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || `user_${Date.now()}`;
    const requestId = `${userId}-${Math.random().toString(36).substr(2, 9)}`;

    console.log("\n" + "=".repeat(80));
    console.log(`[${requestId}] 🚀 MIDDLEWARE START for userId: ${userId}`);
    console.log("=".repeat(80));

    try {
        // Read cookies
        const cookieStore = await cookies();

        // VULNERABLE PATTERN #1: Module-scope promotional flag cache
        console.log(`\n[${requestId}] --- Testing Promotional Flag Cache ---`);
        inspectModuleState(userId);
        const promoFlag = getPromotionalFlag(userId);
        console.log(`[${requestId}] Result: Got promo=${promoFlag.name}, coupon=${promoFlag.metadata?.defaultCoupon}`);

        // VULNERABLE PATTERN #2: Module-scope initialization guards
        console.log(`\n[${requestId}] --- Testing Store Initialization Guards ---`);
        inspectStoreState(userId);

        // Try to initialize app store
        const authToken = `token_${userId}_${Date.now()}`;
        initializeAppStore(userId, authToken);

        // Try to initialize feature flag store
        const flags = {
            enableNewFeature: Math.random() > 0.5,
            enableBetaUI: Math.random() > 0.5,
        };
        initializeFeatureFlagStore(userId, flags);

        // Get the current stores (will show wrong user if guards blocked init)
        const currentAppStore = getAppStore();
        const currentUserId = currentAppStore?.userId || "none";

        console.log(`\n[${requestId}] --- Final State Check ---`);
        if (currentUserId !== userId) {
            console.log(`[${requestId}] ⚠️  LEAK DETECTED!`);
            console.log(`[${requestId}]     Expected userId: ${userId}`);
            console.log(`[${requestId}]     Actual userId in store: ${currentUserId}`);
        } else {
            console.log(`[${requestId}] ✅ No leak (this is the first user on this runtime instance)`);
        }

        // Create response
        const response = NextResponse.next();

        // Set response headers with leak detection info
        response.headers.set("x-request-id", requestId);
        response.headers.set("x-request-user-id", userId);
        response.headers.set("x-promo-name", promoFlag.name);
        response.headers.set("x-promo-coupon", promoFlag.metadata?.defaultCoupon || "");
        response.headers.set("x-store-user-id", currentUserId);
        response.headers.set("x-leak-detected", currentUserId !== userId ? "true" : "false");

        console.log(`[${requestId}] 🏁 MIDDLEWARE END`);
        console.log("=".repeat(80) + "\n");

        return response;
    } catch (e: any) {
        console.error(`[${requestId}] ❌ Middleware error:`, e);
        return NextResponse.next();
    }
}

export const config = {
    runtime: "nodejs", // Using Node.js runtime to leverage Fluid Compute
    matcher: [
        {
            source: "/((?!_next/static|_next/image|favicon.ico).*)",
        },
    ],
};
