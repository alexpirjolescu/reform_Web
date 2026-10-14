import type { Metadata, Viewport } from "next";
import { Lexend, Outfit, Sour_Gummy } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { AuthLinkHandler } from "@/components/auth-link-handler";
import { FileViewerProvider } from "@/components/viewer/file-viewer";
import { getSession } from "@/lib/auth";
import { getTheme } from "@/lib/theme";
import "./globals.css";

// latin-ext covers Romanian diacritics (ă, â, î, ș, ț).
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin", "latin-ext"] });
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin", "latin-ext"] });
const sourGummy = Sour_Gummy({ variable: "--font-sour-gummy", subsets: ["latin", "latin-ext"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: { default: t("title"), template: `%s · ${t("title")}` }, description: t("description") };
}

// Android: the on-screen keyboard shrinks the page instead of covering it, so an open chat keeps its header
// and its composer above the keyboard.
export const viewport: Viewport = { width: "device-width", initialScale: 1, interactiveWidget: "resizes-content" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, session] = await Promise.all([getLocale(), getSession()]);
  const theme = await getTheme("profile" in session ? session.profile.theme : null);

  return (
    <html
      lang={locale}
      data-theme={theme}
      className={`${outfit.variable} ${lexend.variable} ${sourGummy.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>
          <FileViewerProvider>{children}</FileViewerProvider>
        </NextIntlClientProvider>
        <AuthLinkHandler />
      </body>
    </html>
  );
}
