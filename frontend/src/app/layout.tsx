import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Universal Crawler - Operator Console",
  description: "Monitor and manage web crawling jobs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  );
}
