#!/usr/bin/env node

/**
 * External Load Testing Script
 *
 * This script fires truly concurrent requests from outside the browser to test
 * for AsyncLocalStorage context corruption in Edge Runtime with Fluid Compute.
 *
 * Usage:
 *   node load-test.js <deployment-url> [num-requests] [bypass-token]
 *
 * Examples:
 *   node load-test.js https://middleware-leak-reproduction-git-vulnerable.vercel.app 100
 *   node load-test.js https://preview.vercel.app 50 vercel_live_secret_xxxxx
 */

const DEPLOYMENT_URL = process.argv[2];
const NUM_REQUESTS = parseInt(process.argv[3]) || 50;
const BYPASS_TOKEN = process.argv[4] || process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

if (!DEPLOYMENT_URL) {
    console.error("❌ Error: Deployment URL required");
    console.error("\nUsage: node load-test.js <deployment-url> [num-requests] [bypass-token]");
    console.error("\nExamples:");
    console.error("  node load-test.js https://your-deployment.vercel.app 100");
    console.error("  node load-test.js https://preview.vercel.app 50 vercel_live_secret_xxxxx");
    console.error("\nOr set VERCEL_AUTOMATION_BYPASS_SECRET environment variable");
    process.exit(1);
}

console.log("\n🧪 Edge Runtime AsyncLocalStorage Corruption Test");
console.log("================================================\n");
console.log(`Target: ${DEPLOYMENT_URL}`);
console.log(`Requests: ${NUM_REQUESTS} concurrent requests`);
console.log(`Bypass Token: ${BYPASS_TOKEN ? "✓ Provided" : "✗ Not provided"}`);
console.log(`Strategy: Fire all requests simultaneously to trigger instance reuse\n`);

async function runLoadTest() {
    const results = [];
    const startTime = Date.now();

    try {
        // Fire all requests concurrently
        console.log("🚀 Firing concurrent requests...\n");

        const promises = Array.from({ length: NUM_REQUESTS }, async (_, i) => {
            const userId = `user-${i + 1}`;
            const requestStart = Date.now();

            try {
                const headers = {
                    "User-Agent": "LoadTest/1.0",
                };

                // Add Vercel protection bypass if token provided
                if (BYPASS_TOKEN) {
                    headers["x-vercel-protection-bypass"] = BYPASS_TOKEN;
                }

                const response = await fetch(`${DEPLOYMENT_URL}/api/test-cookies?userId=${userId}`, {
                    headers,
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                const requestTime = Date.now() - requestStart;

                const match = data.middlewareSetUserId === data.requestUserId;

                if (!match) {
                    console.log(`❌ MISMATCH: Request ${userId} got middleware userId: ${data.middlewareSetUserId} (${requestTime}ms)`);
                }

                return {
                    requestUserId: data.requestUserId,
                    middlewareSetUserId: data.middlewareSetUserId,
                    middlewareSetAbTestId: data.middlewareSetAbTestId,
                    match,
                    requestTime,
                };
            } catch (error) {
                console.error(`❌ ERROR for ${userId}:`, error.message);
                return {
                    requestUserId: userId,
                    middlewareSetUserId: "ERROR",
                    middlewareSetAbTestId: "ERROR",
                    match: false,
                    error: error.message,
                };
            }
        });

        // Wait for all requests to complete
        const responses = await Promise.all(promises);
        const totalTime = Date.now() - startTime;

        // Analyze results
        const matches = responses.filter((r) => r.match).length;
        const mismatches = responses.filter((r) => !r.match).length;
        const errors = responses.filter((r) => r.error).length;

        console.log("\n📊 Test Results");
        console.log("================\n");
        console.log(`Total Requests:  ${responses.length}`);
        console.log(`Total Time:      ${totalTime}ms`);
        console.log(`Avg Time/Req:    ${(totalTime / responses.length).toFixed(0)}ms`);
        console.log();
        console.log(`✅ Matches:      ${matches} (${((matches / responses.length) * 100).toFixed(1)}%)`);
        console.log(`❌ Mismatches:   ${mismatches} (${((mismatches / responses.length) * 100).toFixed(1)}%)`);
        console.log(`⚠️  Errors:       ${errors}`);
        console.log();

        if (mismatches > 0) {
            console.log("🔴 VULNERABILITY CONFIRMED!");
            console.log("===========================");
            console.log("AsyncLocalStorage context corruption detected in Edge Runtime.");
            console.log("Cookie mixing occurred between concurrent requests.");
            console.log();
            console.log("Recommendations:");
            console.log("1. Switch middleware to Node.js runtime");
            console.log("2. Or refactor to avoid cookies() calls during external fetch operations");
            console.log();

            // Show some examples of mismatches
            const mismatchExamples = responses.filter((r) => !r.match).slice(0, 5);
            if (mismatchExamples.length > 0) {
                console.log("Example Mismatches:");
                mismatchExamples.forEach((r) => {
                    console.log(`  - Requested: ${r.requestUserId}, Got: ${r.middlewareSetUserId}`);
                });
                console.log();
            }
        } else {
            console.log("✅ NO VULNERABILITY DETECTED");
            console.log("============================");
            console.log("All requests received correct cookies.");
            console.log("Either:");
            console.log("- The issue doesn't exist with current load");
            console.log("- Using Node.js runtime (no AsyncLocalStorage issues)");
            console.log("- Need higher concurrency to trigger the bug");
            console.log();
        }

        return {
            totalRequests: responses.length,
            matches,
            mismatches,
            errors,
            successRate: ((matches / responses.length) * 100).toFixed(1),
        };
    } catch (error) {
        console.error("\n❌ Load test failed:", error);
        process.exit(1);
    }
}

// Run the test
runLoadTest()
    .then((summary) => {
        process.exit(summary.mismatches > 0 ? 1 : 0);
    })
    .catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
