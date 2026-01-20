"use client";

import { useState } from "react";

interface LeakTestResult {
    requestedUserId: string;
    moduleState: {
        promotionalFlag: {
            name: string;
            coupon: string;
            belongsTo: string;
            leaked: boolean;
        };
        appStore: {
            userId: string;
            authToken: string;
            leaked: boolean;
        } | null;
        featureFlagStore: {
            userId: string;
            flags: Record<string, boolean>;
            leaked: boolean;
        } | null;
    };
    leakDetection: {
        anyLeakDetected: boolean;
        promoLeaked: boolean;
        appStoreLeaked: boolean;
        featureFlagStoreLeaked: boolean;
    };
    timestamp: number;
}

export default function TestLeakPage() {
    const [results, setResults] = useState<Record<string, LeakTestResult>>({});
    const [loading, setLoading] = useState<string | null>(null);
    const [concurrentTestRunning, setConcurrentTestRunning] = useState(false);

    const testUser = async (userId: string) => {
        setLoading(userId);
        try {
            const response = await fetch(`/api/test-leak?userId=${userId}`);
            const data = await response.json();

            setResults((prev) => ({
                ...prev,
                [userId]: data,
            }));
        } catch (error) {
            console.error(`Error testing user ${userId}:`, error);
        } finally {
            setLoading(null);
        }
    };

    const runConcurrentTest = async () => {
        setConcurrentTestRunning(true);
        setResults({});

        const userIds = ["UserA", "UserB", "UserC", "UserD", "UserE"];

        try {
            // Fire all requests simultaneously
            const promises = userIds.map((userId) => fetch(`/api/test-leak?userId=${userId}`).then((res) => res.json()));

            const allResults = await Promise.all(promises);

            const resultsMap: Record<string, LeakTestResult> = {};
            allResults.forEach((result) => {
                resultsMap[result.requestedUserId] = result;
            });

            setResults(resultsMap);
        } catch (error) {
            console.error("Error in concurrent test:", error);
        } finally {
            setConcurrentTestRunning(false);
        }
    };

    const clearResults = () => {
        setResults({});
    };

    const resultsList = Object.entries(results).sort(([a], [b]) => a.localeCompare(b));
    const totalLeaks = resultsList.filter(([_, r]) => r.leakDetection.anyLeakDetected).length;
    const totalTests = resultsList.length;

    return (
        <div style={{ fontFamily: "monospace", padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
            <h1>Module-Scope State Leak Test</h1>

            <div style={{ marginBottom: "20px", padding: "15px", background: "#f5f5f5", borderRadius: "5px" }}>
                <h2>About This Test</h2>
                <p>
                    This page tests for <strong>module-scope state leaking</strong> with Vercel Fluid Compute. When
                    runtime instances are reused, module-level variables persist across requests.
                </p>
                <p>
                    <strong>Expected behavior:</strong> The first user to hit the server initializes the module state.
                    All subsequent users see that first user's cached data.
                </p>
            </div>

            <div style={{ marginBottom: "30px" }}>
                <h2>Individual Tests</h2>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {["UserA", "UserB", "UserC", "UserD", "UserE"].map((userId) => (
                        <button
                            key={userId}
                            onClick={() => testUser(userId)}
                            disabled={loading !== null}
                            style={{
                                padding: "10px 20px",
                                fontSize: "16px",
                                cursor: loading ? "not-allowed" : "pointer",
                                background: loading === userId ? "#ccc" : "#007bff",
                                color: "white",
                                border: "none",
                                borderRadius: "5px",
                            }}
                        >
                            {loading === userId ? "Testing..." : `Test ${userId}`}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: "30px" }}>
                <h2>Concurrent Test</h2>
                <p>Fire 5 requests simultaneously to see if they share module state:</p>
                <button
                    onClick={runConcurrentTest}
                    disabled={concurrentTestRunning}
                    style={{
                        padding: "10px 20px",
                        fontSize: "16px",
                        cursor: concurrentTestRunning ? "not-allowed" : "pointer",
                        background: concurrentTestRunning ? "#ccc" : "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        marginRight: "10px",
                    }}
                >
                    {concurrentTestRunning ? "Running..." : "Run Concurrent Test"}
                </button>
                <button
                    onClick={clearResults}
                    style={{
                        padding: "10px 20px",
                        fontSize: "16px",
                        cursor: "pointer",
                        background: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                    }}
                >
                    Clear Results
                </button>
            </div>

            {totalTests > 0 && (
                <div style={{ marginBottom: "20px", padding: "15px", background: totalLeaks > 0 ? "#fff3cd" : "#d4edda", borderRadius: "5px" }}>
                    <h2>Summary</h2>
                    <p>
                        <strong>Tests Run:</strong> {totalTests}
                    </p>
                    <p>
                        <strong>Leaks Detected:</strong> {totalLeaks} ({totalTests > 0 ? Math.round((totalLeaks / totalTests) * 100) : 0}%)
                    </p>
                    {totalLeaks > 0 ? (
                        <p style={{ color: "#856404" }}>
                            ⚠️ <strong>Module-scope state is leaking!</strong> Users are seeing cached data from other
                            users.
                        </p>
                    ) : totalTests > 1 ? (
                        <p style={{ color: "#155724" }}>✅ No leaks detected (or all tests hit different runtime instances).</p>
                    ) : (
                        <p style={{ color: "#155724" }}>First test always passes. Run more tests to check for leaks.</p>
                    )}
                </div>
            )}

            <div>
                <h2>Results</h2>
                {resultsList.length === 0 ? (
                    <p>No tests run yet. Click a button above to start testing.</p>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                        {resultsList.map(([userId, result]) => (
                            <div
                                key={userId}
                                style={{
                                    padding: "15px",
                                    border: result.leakDetection.anyLeakDetected ? "2px solid #ffc107" : "2px solid #28a745",
                                    borderRadius: "5px",
                                    background: result.leakDetection.anyLeakDetected ? "#fff3cd" : "#d4edda",
                                }}
                            >
                                <h3>
                                    {userId}{" "}
                                    {result.leakDetection.anyLeakDetected ? (
                                        <span style={{ color: "#856404" }}>⚠️ LEAK DETECTED</span>
                                    ) : (
                                        <span style={{ color: "#155724" }}>✅ No Leak</span>
                                    )}
                                </h3>

                                <div style={{ marginTop: "10px" }}>
                                    <strong>Promotional Flag:</strong>
                                    <ul style={{ marginTop: "5px" }}>
                                        <li>Name: {result.moduleState.promotionalFlag.name}</li>
                                        <li>Coupon: {result.moduleState.promotionalFlag.coupon}</li>
                                        <li>
                                            Belongs To: {result.moduleState.promotionalFlag.belongsTo}{" "}
                                            {result.moduleState.promotionalFlag.leaked && (
                                                <span style={{ color: "#856404" }}>(LEAKED from another user!)</span>
                                            )}
                                        </li>
                                    </ul>
                                </div>

                                {result.moduleState.appStore && (
                                    <div style={{ marginTop: "10px" }}>
                                        <strong>App Store:</strong>
                                        <ul style={{ marginTop: "5px" }}>
                                            <li>
                                                User ID: {result.moduleState.appStore.userId}{" "}
                                                {result.moduleState.appStore.leaked && (
                                                    <span style={{ color: "#856404" }}>(LEAKED!)</span>
                                                )}
                                            </li>
                                            <li>Auth Token: {result.moduleState.appStore.authToken}</li>
                                        </ul>
                                    </div>
                                )}

                                {result.moduleState.featureFlagStore && (
                                    <div style={{ marginTop: "10px" }}>
                                        <strong>Feature Flag Store:</strong>
                                        <ul style={{ marginTop: "5px" }}>
                                            <li>
                                                User ID: {result.moduleState.featureFlagStore.userId}{" "}
                                                {result.moduleState.featureFlagStore.leaked && (
                                                    <span style={{ color: "#856404" }}>(LEAKED!)</span>
                                                )}
                                            </li>
                                            <li>Flags: {JSON.stringify(result.moduleState.featureFlagStore.flags)}</li>
                                        </ul>
                                    </div>
                                )}

                                <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
                                    Timestamp: {new Date(result.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
