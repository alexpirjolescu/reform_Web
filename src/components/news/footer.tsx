import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";

export async function NewsFooter({ variant }: { variant: "dark" | "white" | "color" }) {
  const t = await getTranslations("news.footer");
  const year = new Date().getFullYear();
  const border = variant === "dark" ? "border-t border-night-line" : "";

  return (
    <footer className={`bg-night text-white ${border}`}>
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-12 px-4 pt-12 pb-14 sm:px-10">
        <div className="flex flex-col gap-4">
          <Logo white height={40} />
          {variant === "color" && (
            <div aria-hidden="true" className="flex gap-2">
              {["#77bfb2", "#e1b345", "#79569a", "#dd6937", "#abca54", "#e28ba3"].map((color) => (
                <span key={color} className="size-[18px] rounded-full" style={{ background: color }} />
              ))}
            </div>
          )}
          <span className="text-[13px] text-night-muted">re_form {year} ©</span>
        </div>
        <nav aria-label={t("label")} className="flex flex-wrap gap-14 text-sm">
          <div className="flex flex-col gap-2.5">
            <span className="text-night-muted">{t("academy")}</span>
            <Link href="/about" className="hover:text-teal">{t("about")}</Link>
            <Link href="/about#schools" className="hover:text-teal">{t("schools")}</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-night-muted">{t("contact")}</span>
            <Link href="/about#contact" className="hover:text-teal">{t("write")}</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            <span className="text-night-muted">{t("legal")}</span>
            <Link href="/privacy" className="hover:text-teal">{t("privacy")}</Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}
