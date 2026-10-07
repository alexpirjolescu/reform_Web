import Markdown from "react-markdown";
import type { Placement, StoredBlock, Width } from "@/lib/article";
import type { ActivityMedia } from "@/lib/news";
import type { Theme } from "@/lib/theme-shared";
import { MediaView } from "./activity-media";
import { paperFor } from "./paper";

export type ArticleBlock =
  | Exclude<StoredBlock, { type: "media" }>
  | { type: "media"; items: ActivityMedia[]; place: Placement; width: Width };

// Written out in full so Tailwind finds the classes. Beside the text, media float on wider screens and
// the following text flows around them; on phones everything stacks.
const floatClass: Record<"left" | "right", Record<Width, string>> = {
  left: { s: "sm:float-left sm:mr-6 sm:w-1/3", m: "sm:float-left sm:mr-6 sm:w-1/2", l: "sm:float-left sm:mr-6 sm:w-1/2" },
  right: { s: "sm:float-right sm:ml-6 sm:w-1/3", m: "sm:float-right sm:ml-6 sm:w-1/2", l: "sm:float-right sm:ml-6 sm:w-1/2" },
};
const rowColumns = ["", "", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-2 lg:grid-cols-4"];

/**
 * A news article laid out from its blocks (see src/lib/article.ts): text, headings, quotes, boxes,
 * buttons, dividers, and media across the page, beside the text or side by side.
 * Empty blocks (a template's unfilled places) are left out.
 */
export function ArticleBody({ blocks, theme, locale }: { blocks: ArticleBlock[]; theme: Theme; locale: string }) {
  const p = paperFor(theme);

  return (
    <div className="flow-root text-[17px]">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return block.text.trim() ? (
              <h2 key={index} className={`clear-both mt-10 mb-4 font-display text-2xl leading-tight font-bold sm:text-3xl ${p.heading}`}>{block.text}</h2>
            ) : null;
          case "text": {
            if (!block.body.trim()) return null;
            if (block.style === "quote") {
              return (
                <blockquote key={index} className={`my-8 border-l-4 py-1 pl-5 font-display text-2xl leading-snug font-semibold ${p.rule}`}>
                  <Markdown>{block.body}</Markdown>
                </blockquote>
              );
            }
            if (block.style === "note") {
              return (
                <div key={index} className={`prose-reform my-6 p-5 text-base ${p.panel}`}>
                  <Markdown>{block.body}</Markdown>
                </div>
              );
            }
            return (
              <div key={index} className={`prose-reform mb-5 ${block.style === "lead" ? "text-xl leading-relaxed font-light" : ""}`}>
                <Markdown>{block.body}</Markdown>
              </div>
            );
          }
          case "divider":
            return <hr key={index} className={`clear-both my-10 border-t-2 ${p.rule}`} />;
          case "button":
            return block.label.trim() && block.url ? (
              <p key={index} className="clear-both my-8">
                <a href={block.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-12 items-center px-6 font-display font-semibold ${p.login}`}>
                  {block.label} →
                </a>
              </p>
            ) : null;
          case "media": {
            if (!block.items.length) return null;
            const many = block.items.length > 1;
            if (block.place === "left" || block.place === "right") {
              return (
                <div key={index} className={`mb-5 flex flex-col gap-4 sm:mt-1 ${floatClass[block.place][block.width]}`}>
                  {block.items.map((item) => <MediaView key={item.id} item={item} theme={theme} locale={locale} />)}
                </div>
              );
            }
            if (block.place === "row" || many) {
              return (
                <div key={index} className={`clear-both my-8 grid gap-4 ${rowColumns[Math.min(block.items.length, 4)]}`}>
                  {block.items.map((item) => <MediaView key={item.id} item={item} theme={theme} locale={locale} fill={block.items.length > 1} />)}
                </div>
              );
            }
            return (
              <div key={index} className={`clear-both my-8 ${block.width === "l" ? "" : block.width === "m" ? "mx-auto sm:w-2/3" : "mx-auto sm:w-1/3"}`}>
                <MediaView item={block.items[0]} theme={theme} locale={locale} />
              </div>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
