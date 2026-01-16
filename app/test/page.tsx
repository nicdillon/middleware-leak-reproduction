"use client";

import { useState } from "react";

interface TestResult {
    requestUserId: string;
    middlewareSetUserId: string;
    middlewareSetAbTestId: string;
    timestamp: string;
    match: boolean;
}

export default function TestPage() {
    const [results, setResults] = useState<TestResult[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [summary, setSummary] = useState<{ total: number; matches: number; mismatches: number } | null>(null);

    const runLoadTest = async () => {
        setIsRunning(true);
        setResults([]);
        setSummary(null);

        const numRequests = 100;
        const testResults: TestResult[] = [];

        try {
            // Fire 100 concurrent requests
            const promises = Array.from({ length: numRequests }, (_, i) => {
                const userId = `user-${i + 1}`;
                return fetch(`/api/test-cookies?userId=${userId}`)
                    .then(res => res.json())
                    .catch(err => ({
                        requestUserId: userId,
                        middlewareSetUserId: "ERROR",
                        middlewareSetAbTestId: "ERROR",
                        timestamp: new Date().toISOString(),
                        error: err.message,
                    }));
            });

            const responses = await Promise.all(promises);

            // Analyze results
            responses.forEach((data: any) => {
                const match = data.middlewareSetUserId === data.requestUserId;
                testResults.push({
                    requestUserId: data.requestUserId,
                    middlewareSetUserId: data.middlewareSetUserId,
                    middlewareSetAbTestId: data.middlewareSetAbTestId,
                    timestamp: data.timestamp,
                    match,
                });
            });

            // Calculate summary
            const matches = testResults.filter(r => r.match).length;
            const mismatches = testResults.filter(r => !r.match).length;

            setResults(testResults);
            setSummary({
                total: testResults.length,
                matches,
                mismatches,
            });
        } catch (err) {
            console.error("Load test error:", err);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <main>
            <h1>Middleware Cookie Leak Test</h1>

            <section style={{ marginTop: "2rem" }}>
                <h2>Load Test</h2>
                <p>
                    This test fires 100 concurrent requests, each with a unique user ID.
                    The middleware should set cookies matching the user ID.
                    Any mismatches indicate cookie leaking between requests.
                </p>

                <button
                    onClick={runLoadTest}
                    disabled={isRunning}
                    style={{
                        padding: "0.75rem 1.5rem",
                        fontSize: "1rem",
                        backgroundColor: isRunning ? "#ccc" : "#0070f3",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: isRunning ? "not-allowed" : "pointer",
                        marginTop: "1rem",
                    }}
                >
                    {isRunning ? "Running..." : "Run Load Test"}
                </button>
            </section>

            {summary && (
                <section style={{ marginTop: "2rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
                    <h2 style={{ marginTop: 0 }}>Summary</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                        <div>
                            <strong>Total Requests:</strong> {summary.total}
                        </div>
                        <div style={{ color: "#44aa44" }}>
                            <strong>Matches:</strong> {summary.matches}
                        </div>
                        <div style={{ color: "#ff4444" }}>
                            <strong>Mismatches:</strong> {summary.mismatches}
                        </div>
                    </div>
                    <div style={{ marginTop: "1rem" }}>
                        <strong>Success Rate:</strong> {((summary.matches / summary.total) * 100).toFixed(1)}%
                    </div>
                </section>
            )}

            {results.length > 0 && (
                <section style={{ marginTop: "2rem" }}>
                    <h2>Results</h2>
                    <div style={{ maxHeight: "500px", overflow: "auto", border: "1px solid #ddd", borderRadius: "8px" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead style={{ position: "sticky", top: 0, backgroundColor: "#f5f5f5" }}>
                                <tr>
                                    <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "2px solid #ddd" }}>Request User ID</th>
                                    <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "2px solid #ddd" }}>Middleware Set User ID</th>
                                    <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "2px solid #ddd" }}>Middleware Set AB Test</th>
                                    <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "2px solid #ddd" }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((result, idx) => (
                                    <tr
                                        key={idx}
                                        style={{
                                            backgroundColor: result.match ? "transparent" : "#ffeeee",
                                        }}
                                    >
                                        <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{result.requestUserId}</td>
                                        <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{result.middlewareSetUserId}</td>
                                        <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>{result.middlewareSetAbTestId}</td>
                                        <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
                                            {result.match ? (
                                                <span style={{ color: "#44aa44" }}>✓ Match</span>
                                            ) : (
                                                <span style={{ color: "#ff4444" }}>✗ Mismatch</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </main>
    );
}
