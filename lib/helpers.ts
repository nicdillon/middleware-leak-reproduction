import { cookies } from "next/headers";

/**
 * Node.js runtime version - same pattern as vulnerable, but proper AsyncLocalStorage
 */
export const getUUID = async (): Promise<string> => {
    const cookieStore = await cookies();
    const uuid = cookieStore.get("user_uuid");
    if (uuid) return uuid.value;

    // Generate a new UUID if not found
    if (typeof crypto === "undefined" || !("randomUUID" in crypto)) {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
            (parseInt(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (parseInt(c) / 4)))).toString(16)
        );
    } else {
        return crypto.randomUUID();
    }
};

/**
 * Node.js Runtime - SAME PATTERN as vulnerable version
 *
 * This uses the EXACT SAME pattern as the vulnerable edge runtime version:
 * 1. Call cookies() before external fetch
 * 2. Make external fetch() with realistic delay
 * 3. Call cookies() again after fetch completes
 *
 * The ONLY difference is the runtime. Node.js should maintain proper
 * AsyncLocalStorage context across the fetch boundary.
 */
export const getMockABTestCookies = async (
    userId: string,
    requestId: string
): Promise<Array<{ name: string; value: string; maxAge: number }>> => {
    console.log(`[${requestId}] getMockABTestCookies START for userId: ${userId}`);

    // STEP 1: Call cookies() before external fetch
    const cookieStore = await cookies();
    const existingAbTest = cookieStore.get("ab_test_id");
    const existingUuid = cookieStore.get("user_uuid");

    console.log(`[${requestId}] Read existing cookies - uuid: ${existingUuid?.value}, abTest: ${existingAbTest?.value}`);

    // STEP 2: Make REAL external fetch call (same as vulnerable version)
    console.log(`[${requestId}] Making external fetch call...`);

    try {
        // Same delay pattern as vulnerable version: 100-200ms
        const delayMs = 100 + Math.floor(Math.random() * 100);
        const response = await fetch(`https://httpbin.org/delay/${delayMs / 1000}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                userId: userId,
                requestId: requestId,
                timestamp: Date.now(),
            }),
        });

        console.log(`[${requestId}] External fetch completed with status: ${response.status}`);
    } catch (e) {
        console.error(`[${requestId}] External fetch failed:`, e);
    }

    // STEP 3: Call cookies() AGAIN after external fetch completes
    // With Node.js runtime, this should maintain proper context
    const cookieStore2 = await cookies();
    const postFetchUuid = cookieStore2.get("user_uuid");

    console.log(`[${requestId}] After external fetch - reading cookies again. UUID: ${postFetchUuid?.value}`);

    // Generate AB test cookies based on user ID
    const abTestId = `ab_${userId}_${Date.now() % 1000}`;

    console.log(`[${requestId}] getMockABTestCookies END - returning abTestId: ${abTestId}`);

    return [
        {
            name: "ab_test_id",
            value: abTestId,
            maxAge: 60 * 60 * 24,
        },
        {
            name: "ab_variant",
            value: Math.random() > 0.5 ? "A" : "B",
            maxAge: 60 * 60 * 24,
        },
    ];
};
