export default function Home() {
    return (
        <main>
            <h1>Middleware Cookie Leak Reproduction</h1>

            <section style={{ marginTop: "2rem" }}>
                <h2>Overview</h2>
                <p>
                    This project reproduces a Next.js middleware cookie leak that occurs with Vercel&apos;s Fluid Compute enabled.
                    When Fluid Compute reuses function instances across requests, cookies can leak between users.
                </p>
            </section>

            <section style={{ marginTop: "2rem" }}>
                <h2>Branches</h2>
                <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
                    <div style={{ border: "2px solid #ff4444", padding: "1rem", borderRadius: "8px" }}>
                        <h3 style={{ margin: "0 0 0.5rem 0", color: "#ff4444" }}>🔴 Vulnerable Branch</h3>
                        <p style={{ margin: "0 0 0.5rem 0" }}>
                            Demonstrates the problematic pattern with multiple <code>cookies()</code> calls
                            and nested async operations. Cookie mixing occurs under concurrent load.
                        </p>
                        <a href="/test" style={{ color: "#0070f3" }}>Run Load Test →</a>
                    </div>

                    <div style={{ border: "2px solid #44ff44", padding: "1rem", borderRadius: "8px" }}>
                        <h3 style={{ margin: "0 0 0.5rem 0", color: "#44aa44" }}>🟢 Fixed Branch</h3>
                        <p style={{ margin: "0 0 0.5rem 0" }}>
                            Implements the solution with a single <code>cookies()</code> call and proper
                            cookie store passing. No cookie mixing occurs.
                        </p>
                        <a href="/test" style={{ color: "#0070f3" }}>Run Load Test →</a>
                    </div>
                </div>
            </section>

            <section style={{ marginTop: "2rem" }}>
                <h2>Testing Instructions</h2>
                <ol>
                    <li>Deploy both <strong>vulnerable</strong> and <strong>fixed</strong> branches to Vercel</li>
                    <li>Enable <strong>Fluid Compute</strong> in Vercel project settings</li>
                    <li>Visit <code>/test</code> page on each deployment</li>
                    <li>Click &quot;Run Load Test&quot; to fire 100 concurrent requests</li>
                    <li>Compare results between branches</li>
                </ol>
            </section>

            <section style={{ marginTop: "2rem", backgroundColor: "#eeffee", padding: "1rem", borderRadius: "8px", border: "2px solid #44aa44" }}>
                <h2 style={{ marginTop: 0, color: "#44aa44" }}>🟢 Current Branch: FIXED</h2>
                <p>
                    This deployment uses the <strong>fixed</strong> branch with corrected middleware patterns.
                    No cookie mixing should occur, even under heavy concurrent load.
                </p>
                <p style={{ marginBottom: 0 }}>
                    <strong>Fixed patterns:</strong>
                </p>
                <ul style={{ marginTop: "0.5rem" }}>
                    <li>Single <code>cookies()</code> call in middleware</li>
                    <li>Cookie store passed as parameter to all helpers</li>
                    <li>Proper error handling with guaranteed response</li>
                    <li>Complete request isolation regardless of Fluid Compute</li>
                </ul>
            </section>

            <section style={{ marginTop: "2rem" }}>
                <h2>Documentation</h2>
                <ul>
                    <li><a href="https://github.com/[your-org]/middleware-leak-reproduction/blob/main/PLAN.md" style={{ color: "#0070f3" }}>PLAN.md</a> - Detailed reproduction strategy</li>
                    <li><a href="https://github.com/[your-org]/middleware-leak-reproduction/blob/main/README.md" style={{ color: "#0070f3" }}>README.md</a> - Setup instructions</li>
                </ul>
            </section>
        </main>
    );
}
