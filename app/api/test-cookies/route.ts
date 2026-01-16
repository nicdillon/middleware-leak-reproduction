import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const searchParams = request.nextUrl.searchParams;
    const requestUserId = searchParams.get("userId") || "unknown";

    // Read cookies that should have been set by middleware
    const receivedUuid = cookieStore.get("user_uuid")?.value || "NOT_SET";
    const receivedAbTestId = cookieStore.get("ab_test_id")?.value || "NOT_SET";
    const timestamp = cookieStore.get("request_timestamp")?.value || "NOT_SET";

    return NextResponse.json({
        requestUserId,
        receivedUuid,
        receivedAbTestId,
        timestamp,
        allCookies: cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
    });
}
