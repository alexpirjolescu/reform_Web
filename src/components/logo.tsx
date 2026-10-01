import Image from "next/image";

const logos = {
  ed: { src: "/brand/logo-ed.png", alt: "re_form ed", width: 1801, height: 466 },
  "ed-white": { src: "/brand/logo-ed-white.png", alt: "re_form ed", width: 1801, height: 466 },
  platform: { src: "/brand/logo-platform.png", alt: "re_form platform", width: 794, height: 222 },
  "platform-white": { src: "/brand/logo-platform-white.png", alt: "re_form platform", width: 794, height: 222 },
} as const;

/**
 * Brandbook rules: never stretch, recolour, outline, shadow or box the logo; minimum height 1 cm (~38px).
 * These PNGs are crops from the brandbook PDF; swap in the official SVGs before launch.
 */
export function Logo({ variant = "ed", height = 40, priority }: { variant?: keyof typeof logos; height?: number; priority?: boolean }) {
  const logo = logos[variant];
  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={logo.width}
      height={logo.height}
      priority={priority}
      style={{ height, width: "auto" }}
    />
  );
}
