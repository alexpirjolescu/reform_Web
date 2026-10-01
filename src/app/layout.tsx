import type { Metadata } from "next";
import { Lexend, Outfit, Sour_Gummy } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

// latin-ext covers Romanian diacritics (ă, â, î, ș, ț).
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin", "latin-ext"] });
const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin", "latin-ext"] });
const sourGummy = Sour_Gummy({ variable: "--font-sour-gummy", subsets: ["latin", "latin-ext"] });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: { default: t("title"), template: `%s · ${t("title")}` }, description: t("description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${outfit.variable} ${lexend.variable} ${sourGummy.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
