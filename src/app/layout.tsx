import type { Metadata } from "next";
import { ThemeProvider } from "@/lib/theme/ThemeContext";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getLocale } from "@/lib/i18n/actions";
import { getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluxa - AI Design Generator",
  description: "Create beautiful designs with AI through natural conversation",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <I18nProvider
            locale={locale}
            messages={messages}
            timeZone="Asia/Shanghai"
          >
            {children}
            <Toaster 
              position="top-center" 
              richColors 
              closeButton
              toastOptions={{
                className: 'text-sm',
              }}
            />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
