import { cookies } from "next/headers";

/**
 * VULNERABLE PATTERN: This function calls cookies() internally
 * This creates a separate cookie store instance from the one in middleware
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
 * VULNERABLE PATTERN: This function calls cookies() internally and makes an async API call
 * This simulates the Dynamic Yield pattern where we:
 * 1. Read existing cookies
 * 2. Make an external API call (with network delay)
 * 3. Return new cookies to set
 *
 * The delay increases the window for race conditions when requests are processed concurrently
 */
export const getMockABTestCookies = async (userId: string): Promise<Array<{ name: string; value: string; maxAge: number }>> => {
    const cookieStore = await cookies();

    // Read existing cookies (simulating DY pattern)
    const existingAbTest = cookieStore.get("ab_test_id");
    const existingUuid = cookieStore.get("user_uuid");

    // Simulate external API call with delay (like Dynamic Yield)
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
