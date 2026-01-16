import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getUUID, getMockABTestCookies } from "./lib/helpers";

/**
 * VULNERABLE MIDDLEWARE IMPLEMENTATION
 *
 * This middleware demonstrates the problematic patterns that cause cookie leaking:
 *
 * 1. Multiple cookies() calls:
 *    - Line 19: First cookies() call
 *    - getUUID() internally calls cookies() again
 *    - getMockABTestCookies() internally calls cookies() again
 *
 * 2. Nested async operations:
 *    - getUUID() is async and calls cookies()
 *    - getMockABTestCookies() is async, calls cookies(), and makes a mock API call
 *
 * 3. Race conditions:
 *    - With Fluid Compute, function instances can be reused across requests
 *    - If Request A and Request B are processed concurrently:
 *      - Both call cookies() at different times
 *      - Both make async operations that interleave
 *      - Cookies from User A can end up on User B's response
 *
 * Expected behavior with Fluid Compute:
 * - Under concurrent load, you will see cookie mixing
 * - User-1 will occasionally receive cookies intended for User-2
 * - The longer the async operations, the higher the chance of mixing
 */
export async function middleware(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "unknown";

    try {
        // PROBLEM 1: First cookies() call
        const cookieStore = await cookies();

        // PROBLEM 2: getUUID() makes another cookies() call internally
        const uuid = await getUUID();

        // PROBLEM 3: getMockABTestCookies() makes another cookies() call AND has async delay
        // This simulates the Dynamic Yield API pattern
        const abTestCookies = await getMockABTestCookies(userId);

        // Create response
        const response = NextResponse.next();

        // Set cookies on response
        // With concurrent requests, these values can get mixed up
        response.cookies.set("user_uuid", userId, { maxAge: 60 * 60 * 24 });
        response.cookies.set("request_timestamp", new Date().toISOString(), { maxAge: 60 * 60 });

        // Set AB test cookies from the async operation
        abTestCookies.forEach((cookie) => {
            response.cookies.set(cookie.name, cookie.value, { maxAge: cookie.maxAge });
        });

        return response;
    } catch (e: any) {
        // Silent error handling - no guaranteed response return
        console.error("Middleware error:", e);
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
