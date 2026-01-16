import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getUUID, getMockABTestCookies } from "./lib/helpers";

/**
 * FIXED MIDDLEWARE IMPLEMENTATION
 *
 * This middleware demonstrates the correct pattern that prevents cookie leaking:
 *
 * 1. Single cookies() call:
 *    - Only one cookies() call at line 21
 *    - Cookie store is passed to all helper functions
 *
 * 2. No nested cookies() calls:
 *    - getUUID() receives cookie store as parameter
 *    - getMockABTestCookies() receives cookie store as parameter
 *    - All functions operate on the same cookie store instance
 *
 * 3. No race conditions:
 *    - Even with Fluid Compute and concurrent requests
 *    - Each request has its own isolated cookie store
 *    - No interleaving of cookie operations between requests
 *
 * Expected behavior with Fluid Compute:
 * - No cookie mixing under any load level
 * - Each user receives only their own cookies
 * - 100% success rate in load testing
 */
export async function middleware(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "unknown";

    try {
        // SOLUTION: Single cookies() call - this is the ONLY place we call cookies()
        const cookieStore = await cookies();

        // Pass cookie store to helper functions instead of having them call cookies()
        const uuid = await getUUID(cookieStore);

        // Pass cookie store to async function - same store instance, no race condition
        const abTestCookies = await getMockABTestCookies(userId, cookieStore);

        // Create response
        const response = NextResponse.next();

        // Set cookies on response
        // With single cookie store, these values are properly isolated per request
        response.cookies.set("user_uuid", userId, { maxAge: 60 * 60 * 24 });
        response.cookies.set("request_timestamp", new Date().toISOString(), { maxAge: 60 * 60 });

        // Set AB test cookies from the async operation
        abTestCookies.forEach((cookie) => {
            response.cookies.set(cookie.name, cookie.value, { maxAge: cookie.maxAge });
        });

        // Set custom headers so API endpoint can verify what middleware intended to set
        // This allows us to test for cookie leaking
        response.headers.set("x-middleware-user-id", userId);
        response.headers.set("x-middleware-ab-test-id", abTestCookies[0]?.value || "");

        return response;
    } catch (e: any) {
        // SOLUTION: Always return a response, even on error
        console.error("Middleware error:", e);
        return NextResponse.next();
    }
}

export const config = {
    runtime: "experimental-edge",
    matcher: [
        {
            source: "/((?!_next/static|_next/image|favicon.ico).*)",
        },
    ],
};
