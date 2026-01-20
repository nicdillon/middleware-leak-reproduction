#!/usr/bin/env node

/**
 * Load Test for Module-Scope State Leaks
 *
 * This script simulates concurrent users hitting the server to detect
 * module-scope state leaking with Vercel Fluid Compute.
 *
 * Usage:
 *   node load-test-module-leak.js <base-url> [num-users]
 *
 * Example:
 *   node load-test-module-leak.js https://your-deployment.vercel.app 20
 */

const https = require("https");
const http = require("http");

// Parse command line arguments
const baseUrl = process.argv[2] || "http://localhost:3000";
const numUsers = parseInt(process.argv[3]) || 10;

if (!baseUrl) {
    console.error("Usage: node load-test-module-leak.js <base-url> [num-users]");
    process.exit(1);
}

console.log("=".repeat(80));
console.log("Module-Scope State Leak Test");
console.log("=".repeat(80));
console.log(`Base URL: ${baseUrl}`);
console.log(`Number of Users: ${numUsers}`);
console.log(`Starting test at: ${new Date().toISOString()}`);
console.log("=".repeat(80) + "\n");

// Generate user IDs
const userIds = Array.from({ length: numUsers }, (_, i) => `User${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) || ""}`);

// Results storage
const results = [];
let completed = 0;

// Helper function to fetch
function fetchTestLeak(userId) {
    return new Promise((resolve, reject) => {
        const url = `${baseUrl}/api/test-leak?userId=${userId}`;
        const client = url.startsWith("https") ? https : http;

        const startTime = Date.now();

        client
            .get(url, (res) => {
                let data = "";

                res.on("data", (chunk) => {
                    data += chunk;
                });

                res.on("end", () => {
                    const duration = Date.now() - startTime;

                    try {
                        const json = JSON.parse(data);
                        resolve({
                            userId,
                            duration,
                            data: json,
                            statusCode: res.statusCode,
                        });
                    } catch (e) {
                        reject(new Error(`Failed to parse JSON for ${userId}: ${e.message}`));
                    }
                });
            })
            .on("error", (err) => {
                reject(err);
            });
    });
}

// Run concurrent tests
console.log("Firing requests concurrently...\n");

const promises = userIds.map((userId, index) => {
    // Add slight stagger to simulate real users (0-50ms apart)
    const delay = index * 5;

    return new Promise((resolve) => {
        setTimeout(() => {
            fetchTestLeak(userId)
                .then((result) => {
                    completed++;
                    process.stdout.write(`\rProgress: ${completed}/${numUsers} requests completed`);
                    results.push(result);
                    resolve();
                })
                .catch((error) => {
                    completed++;
                    process.stdout.write(`\rProgress: ${completed}/${numUsers} requests completed`);
                    results.push({
                        userId,
                        error: error.message,
                    });
                    resolve();
                });
        }, delay);
    });
});

Promise.all(promises).then(() => {
    console.log("\n\n" + "=".repeat(80));
    console.log("Test Results");
    console.log("=".repeat(80) + "\n");

    // Analyze results
    const successful = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);
    const leaked = successful.filter((r) => r.data.leakDetection?.anyLeakDetected);

    console.log(`Total Requests: ${numUsers}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Leaks Detected: ${leaked.length} (${successful.length > 0 ? Math.round((leaked.length / successful.length) * 100) : 0}%)`);

    if (failed.length > 0) {
        console.log(`\n⚠️  Failed Requests:`);
        failed.forEach((r) => {
            console.log(`  - ${r.userId}: ${r.error}`);
        });
    }

    if (leaked.length > 0) {
        console.log(`\n⚠️  LEAKS DETECTED!\n`);

        // Find the "first user" (the one who initialized the module state)
        const nonLeaked = successful.filter((r) => !r.data.leakDetection?.anyLeakDetected);
        const firstUser = nonLeaked.length > 0 ? nonLeaked[0].userId : "unknown";

        console.log(`First User (initialized module state): ${firstUser}\n`);

        // Show leak details
        console.log("Leaked Requests:");
        leaked.forEach((r) => {
            const promoLeaked = r.data.leakDetection?.promoLeaked;
            const appStoreLeaked = r.data.leakDetection?.appStoreLeaked;
            const featureFlagStoreLeaked = r.data.leakDetection?.featureFlagStoreLeaked;

            const leakTypes = [];
            if (promoLeaked) leakTypes.push("Promo");
            if (appStoreLeaked) leakTypes.push("AppStore");
            if (featureFlagStoreLeaked) leakTypes.push("FeatureFlags");

            console.log(`  - ${r.userId}: ${leakTypes.join(", ")}`);
            if (promoLeaked) {
                console.log(`      Promo: Expected PROMO_${r.userId}, Got ${r.data.moduleState.promotionalFlag.name}`);
            }
            if (appStoreLeaked) {
                console.log(`      AppStore: Expected ${r.userId}, Got ${r.data.moduleState.appStore.userId}`);
            }
        });

        console.log("\n" + "=".repeat(80));
        console.log("CONCLUSION: Module-scope state is LEAKING between users!");
        console.log("=".repeat(80));
    } else if (successful.length > 1) {
        console.log(`\n✅ No leaks detected!`);
        console.log("\nPossible reasons:");
        console.log("  1. Requests hit different runtime instances");
        console.log("  2. Module state is properly isolated");
        console.log("  3. Safe patterns are being used");

        console.log("\n" + "=".repeat(80));
        console.log("Try running the test multiple times to increase chance of");
        console.log("hitting the same runtime instance.");
        console.log("=".repeat(80));
    } else {
        console.log(`\n✅ Only one successful request - cannot determine if leaking`);
        console.log("Run test with more users or try again.");
    }

    // Show response time stats
    if (successful.length > 0) {
        const durations = successful.map((r) => r.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);

        console.log(`\nResponse Time Stats:`);
        console.log(`  Average: ${avgDuration.toFixed(0)}ms`);
        console.log(`  Min: ${minDuration}ms`);
        console.log(`  Max: ${maxDuration}ms`);
    }

    console.log(`\nTest completed at: ${new Date().toISOString()}`);
    console.log("=".repeat(80) + "\n");
});
