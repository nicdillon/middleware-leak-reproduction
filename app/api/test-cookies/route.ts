import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const requestUserId = searchParams.get("userId") || "unknown";

    // Read custom headers set by middleware indicating what it INTENDED to set
    // These headers tell us what the middleware tried to set in cookies
    const middlewareSetUserId = request.headers.get("x-middleware-user-id") || "NOT_SET";
    const middlewareSetAbTestId = request.headers.get("x-middleware-ab-test-id") || "NOT_SET";

    return NextResponse.json({
        requestUserId,
        middlewareSetUserId,
        middlewareSetAbTestId,
        timestamp: new Date().toISOString(),
    });
}
