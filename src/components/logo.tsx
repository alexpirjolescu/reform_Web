import Image from "next/image";

const logos = {
  ed: { file: "logo-ed", alt: "re_form ed", width: 1801, height: 466 },
  platform: { file: "logo-platform", alt: "re_form platform", width: 794, height: 222 },
  core: { file: "logo-core", alt: "re_form core", width: 794, height: 210 },
  hub: { file: "logo-hub", alt: "re_form hub", width: 794, height: 210 },
  academy: { file: "logo-academy", alt: "re_form academy", width: 796, height: 224 },
  community: { file: "logo-community", alt: "re_form community", width: 796, height: 225 },
} as const;

export type LogoName = keyof typeof logos;

/**
 * Brandbook rules: never stretch, recolour, outline, shadow or box the logo; minimum height 1 cm (~38px)
 * for the main logo. These PNGs are crops from the brandbook PDF; swap in the official SVGs before launch.
 */
export function Logo({
  name = "ed",
  white = false,
  height = 40,
  priority,
}: {
  name?: LogoName;
  white?: boolean;
  height?: number;
  priority?: boolean;
}) {
  const logo = logos[name];
  return (
    <Image
      src={`/brand/${logo.file}${white ? "-white" : ""}.png`}
      alt={logo.alt}
      width={logo.width}
      height={logo.height}
      priority={priority}
      style={{ height, width: "auto", alignSelf: "flex-start", flexShrink: 0 }}
    />
  );
}
