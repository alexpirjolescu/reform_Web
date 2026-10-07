// Article blocks (save and load round trip, older posts) and GIPHY results.
// Run: node --experimental-strip-types tests/article.test.ts
import assert from "node:assert/strict";
import { legacyBlocks, resolveLayout, toEditor, toStored, type EditorBlock } from "../src/lib/article.ts";
import { toGifs } from "../src/lib/giphy.ts";

const photo = (n: number) => ({ kind: "image" as const, path: `activities/${n}.png`, title: `${n}.png`, caption: "" });
const video = { kind: "embed" as const, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", provider: "youtube" as const, title: "", caption: "" };

// Saving: media are numbered in block order; the layout points at them.
const blocks: EditorBlock[] = [
  { key: "a", type: "text", body: "Intro", style: "lead" },
  { key: "b", type: "media", items: [photo(1)], place: "right", width: "s" },
  { key: "c", type: "heading", text: "Galerie" },
  { key: "d", type: "media", items: [photo(2), photo(3)], place: "row", width: "l" },
  { key: "e", type: "media", items: [], place: "full", width: "l", hint: "un video" },
  { key: "f", type: "media", items: [video], place: "full", width: "m" },
  { key: "g", type: "text", body: "Citat", style: "quote" },
  { key: "h", type: "button", label: "Înscrie-te", url: "https://reform.ro" },
];
const stored = toStored(blocks);
assert.equal(stored.media.length, 4);
assert.deepEqual(
  stored.layout.blocks.flatMap((b) => (b.type === "media" ? [b.items] : [])),
  [[1], [2, 3], [], [4]],
);
assert.equal(stored.body, "Intro\n\n## Galerie\n\n> Citat");
assert.ok(!JSON.stringify(stored.layout).includes('"key"'), "editor keys are not saved");

// Loading back gives the same blocks with the same media.
const back = toEditor(stored.layout, stored.body, stored.media);
assert.deepEqual(
  back.map((b) => (b.type === "media" ? `${b.place}:${b.items.map((i) => i.path ?? i.url).join(",")}` : b.type)),
  ["text", "right:activities/1.png", "heading", "row:activities/2.png,activities/3.png", "full:", "full:https://www.youtube.com/watch?v=dQw4w9WgXcQ", "text", "button"],
);

// Media no block points at (e.g. a layout older than the media) still show, at the end.
const resolved = resolveLayout({ v: 1, blocks: [{ type: "media", items: [2], place: "full", width: "l" }] }, "", [{ id: "x", kind: "image" as const }, { id: "y", kind: "image" as const }]);
assert.deepEqual(resolved.map((b) => (b.type === "media" ? b.items.map((i) => i.id).join() : b.type)), ["y", "x"]);

// A block can't show the same item twice, and unknown positions are ignored.
const dup = resolveLayout({ v: 1, blocks: [{ type: "media", items: [1, 1, 9], place: "row", width: "l" }] }, "", [{ id: "x", kind: "image" as const }]);
assert.deepEqual(dup.map((b) => (b.type === "media" ? b.items.length : 0)), [1]);

// Posts from before blocks: their text, photos side by side, other media on their own.
assert.deepEqual(
  legacyBlocks("Text", ["image", "image", "embed", "image"]).map((b) => (b.type === "media" ? `${b.place}:${b.items.join("+")}` : b.type)),
  ["text", "row:1+2", "full:3", "full:4"],
);

// GIPHY: only G-rated GIFs from GIPHY's media hosts are kept.
const gifs = toGifs({
  data: [
    { id: "ok", title: "Bravo", rating: "g", images: { fixed_width: { url: "https://media2.giphy.com/media/ok/200w.gif", webp: "https://media2.giphy.com/media/ok/200w.webp", width: "200", height: "150" }, fixed_width_small: { url: "https://media2.giphy.com/media/ok/100w.gif" } } },
    { id: "pg", rating: "pg", images: { fixed_width: { url: "https://media2.giphy.com/media/pg/200w.gif" } } },
    { id: "evil", rating: "g", images: { fixed_width: { url: "https://evil.example/x.gif" } } },
  ],
});
assert.deepEqual(gifs.map((g) => g.id), ["ok"]);
assert.equal(gifs[0].url, "https://media2.giphy.com/media/ok/200w.webp");
assert.equal(gifs[0].height, 150);

console.log("PASS article blocks and GIPHY results");
