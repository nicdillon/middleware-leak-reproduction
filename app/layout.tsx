import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Middleware Cookie Leak Reproduction",
    description: "Reproducing Next.js middleware cookie leak with Vercel Fluid Compute",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
                {children}
            </body>
        </html>
    );
}
