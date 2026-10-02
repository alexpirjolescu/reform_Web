import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getTheme } from "@/lib/theme";

export default async function AuthLayout({ children }: LayoutProps<"/auth">) {
  const theme = await getTheme();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-6">
        <Link href="/" aria-label="re_form ed">
          <Logo name="ed" white={theme === "dark"} height={38} />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeSwitcher current={theme} tone={theme === "dark" ? "dark" : "light"} />
          <LanguageSwitcher className="text-th-muted" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-8 pb-16">
        <div className={theme === "color" ? "rounded-[28px] border-2 border-ink p-6" : theme === "dark" ? "bg-night-2 p-6" : ""}>{children}</div>
      </main>
    </div>
  );
}
