import { cookies } from "next/headers";

/**
 * VULNERABLE PATTERN: This function calls cookies() internally
 * With Edge Runtime + AsyncLocalStorage issues, this can get the wrong context
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
 * CRITICAL VULNERABLE PATTERN: Edge Runtime AsyncLocalStorage Corruption
 *
 * This function replicates the exact Dynamic Yield pattern that causes issues:
 * 1. Call cookies() to read existing cookies (uses AsyncLocalStorage)
 * 2. Make external fetch() to API (async boundary where context can corrupt)
 * 3. Call cookies() again after fetch completes (may get wrong context)
 *
 * The external fetch is the critical trigger - during the network delay,
 * another request can arrive and its AsyncLocalStorage context can leak
 * into this request's context when the fetch completes.
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

    // STEP 2: Make REAL external fetch call
    // This simulates calling Dynamic Yield API: https://dy-api.com/v2/serve/user/choose
    // Using httpbin.org/delay which adds realistic network latency
    console.log(`[${requestId}] Making external fetch call...`);

    try {
        // Fetch with 100-200ms delay to simulate DY API response time
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
    // THIS IS WHERE CONTEXT CORRUPTION HAPPENS IN EDGE RUNTIME
    // If another request arrived during the fetch, we might get their context
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
