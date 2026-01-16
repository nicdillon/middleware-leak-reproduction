import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getUUID, getMockABTestCookies } from "./lib/helpers";

/**
 * VULNERABLE MIDDLEWARE IMPLEMENTATION - EDGE RUNTIME
 *
 * This middleware demonstrates AsyncLocalStorage context corruption in Edge Runtime:
 *
 * HYPOTHESIS: Edge Runtime has documented issues with AsyncLocalStorage context
 * propagation during external fetch operations. When:
 * 1. Middleware calls cookies() (which uses AsyncLocalStorage internally)
 * 2. Then makes external fetch() call that takes time
 * 3. Another request arrives and also calls cookies()
 * 4. The async context can corrupt, causing User A to get User B's cookies
 *
 * KEY PATTERNS THAT TRIGGER THE BUG:
 * - Edge Runtime (Cloudflare Workers) - known AsyncLocalStorage issues
 * - cookies() called before external fetch
 * - cookies() called again after fetch completes (in helper)
 * - External fetch with realistic delay (50-200ms like DY API)
 * - Fluid Compute enabled (function instance reuse)
 *
 * Expected behavior with Fluid Compute + Edge Runtime:
 * - Request context bleeding during fetch operations
 * - User-1 receives cookies/headers intended for User-2
 * - Request ID tracking will show context corruption
 */
export async function middleware(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "unknown";

    // Generate unique request ID to track context through async boundaries
    const requestId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[${requestId}] MIDDLEWARE START for userId: ${userId}`);

    try {
        // STEP 1: Call cookies() - establishes AsyncLocalStorage context
        const cookieStore = await cookies();
        console.log(`[${requestId}] Called cookies() - context established`);

        // STEP 2: getUUID() internally calls cookies() again
        const uuid = await getUUID();
        console.log(`[${requestId}] getUUID returned: ${uuid}`);

        // STEP 3: CRITICAL - External fetch during AsyncLocalStorage context
        // This simulates the Dynamic Yield API call pattern
        // If another request comes in during this fetch, context can corrupt
        console.log(`[${requestId}] About to call getMockABTestCookies (will make external fetch)`);
        const abTestCookies = await getMockABTestCookies(userId, requestId);
        console.log(`[${requestId}] getMockABTestCookies returned: ${JSON.stringify(abTestCookies)}`);

        // STEP 4: Call cookies() again after fetch completes
        // If context corrupted, this might return a different request's cookies
        const cookieStore2 = await cookies();
        const contextCheckUserId = searchParams.get("userId") || "unknown";

        if (contextCheckUserId !== userId) {
            console.error(`[${requestId}] ⚠️  CONTEXT CORRUPTION DETECTED! Expected userId: ${userId}, but got: ${contextCheckUserId}`);
        }

        // Create response
        const response = NextResponse.next();

        // Set cookies on response
        response.cookies.set("user_uuid", userId, { maxAge: 60 * 60 * 24 });
        response.cookies.set("request_timestamp", new Date().toISOString(), { maxAge: 60 * 60 });

        // Set AB test cookies from the async operation
        abTestCookies.forEach((cookie) => {
            response.cookies.set(cookie.name, cookie.value, { maxAge: cookie.maxAge });
        });

        // Set custom headers so API endpoint can verify what middleware intended to set
        response.headers.set("x-middleware-user-id", userId);
        response.headers.set("x-middleware-ab-test-id", abTestCookies[0]?.value || "");
        response.headers.set("x-request-id", requestId);

        console.log(`[${requestId}] MIDDLEWARE END - Setting userId: ${userId}, abTestId: ${abTestCookies[0]?.value}`);

        return response;
    } catch (e: any) {
        console.error(`[${requestId}] Middleware error:`, e);
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
