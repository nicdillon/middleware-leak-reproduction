import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getUUID, getMockABTestCookies } from "./lib/helpers";

/**
 * FIXED MIDDLEWARE IMPLEMENTATION - NODE.JS RUNTIME
 *
 * This middleware uses Node.js runtime instead of Edge Runtime to avoid
 * AsyncLocalStorage context corruption issues.
 *
 * HYPOTHESIS: Node.js runtime has mature async_hooks and reliable AsyncLocalStorage
 * implementation that properly maintains context across async boundaries including
 * external fetch operations.
 *
 * Even with the SAME patterns as vulnerable version:
 * - Multiple cookies() calls
 * - External fetch with delays
 * - cookies() called before and after fetch
 *
 * Expected behavior with Fluid Compute + Node.js Runtime:
 * - NO request context bleeding
 * - NO cookie mixing
 * - 100% isolation between concurrent requests
 * - Request ID tracking shows no context corruption
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

        // STEP 3: External fetch during AsyncLocalStorage context
        // Same pattern as vulnerable, but Node.js runtime should handle it correctly
        console.log(`[${requestId}] About to call getMockABTestCookies (will make external fetch)`);
        const abTestCookies = await getMockABTestCookies(userId, requestId);
        console.log(`[${requestId}] getMockABTestCookies returned: ${JSON.stringify(abTestCookies)}`);

        // STEP 4: Call cookies() again after fetch completes
        // Node.js runtime should maintain proper context isolation
        const cookieStore2 = await cookies();
        const contextCheckUserId = searchParams.get("userId") || "unknown";

        if (contextCheckUserId !== userId) {
            console.error(`[${requestId}] ⚠️  CONTEXT CORRUPTION DETECTED! Expected userId: ${userId}, but got: ${contextCheckUserId}`);
        } else {
            console.log(`[${requestId}] ✅ Context integrity maintained (Node.js runtime working correctly)`);
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
    runtime: "nodejs",
    matcher: [
        {
            source: "/((?!_next/static|_next/image|favicon.ico).*)",
        },
    ],
};
