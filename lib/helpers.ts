import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

/**
 * FIXED PATTERN: This function accepts the cookie store as a parameter
 * No internal cookies() call - uses the store passed from middleware
 */
export const getUUID = async (cookieStore: ReadonlyRequestCookies): Promise<string> => {
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
 * FIXED PATTERN: This function accepts the cookie store as a parameter
 * No internal cookies() call - uses the store passed from middleware
 *
 * This still simulates the Dynamic Yield pattern with:
 * 1. Reading existing cookies from the passed store
 * 2. Making an external API call (with network delay)
 * 3. Returning new cookies to set
 *
 * The key difference: NO nested cookies() call, so no race condition
 * All cookie operations use the same store instance from the middleware
 */
export const getMockABTestCookies = async (
    userId: string,
    cookieStore: ReadonlyRequestCookies
): Promise<Array<{ name: string; value: string; maxAge: number }>> => {
    // Read existing cookies from the passed store (no new cookies() call)
    const existingAbTest = cookieStore.get("ab_test_id");
    const existingUuid = cookieStore.get("user_uuid");

    // Simulate external API call with delay (like Dynamic Yield)
    // Same delay as vulnerable version for fair comparison
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50)); // 50-100ms delay

    // Generate AB test cookies based on user ID
    const abTestId = `ab_${userId}_${Date.now() % 1000}`;

    return [
        {
            name: "ab_test_id",
            value: abTestId,
            maxAge: 60 * 60 * 24, // 24 hours
        },
        {
            name: "ab_variant",
            value: Math.random() > 0.5 ? "A" : "B",
            maxAge: 60 * 60 * 24,
        },
    ];
};
