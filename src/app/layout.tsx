import type { Metadata } from "next";
import { ThemeProvider } from "@/lib/theme/ThemeContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluxa - AI Design Generator",
  description: "Create beautiful designs with AI through natural conversation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
