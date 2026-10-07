// Link recognition for news post media. Run: node --experimental-strip-types tests/embeds.test.ts
import assert from "node:assert/strict";
import { embedPlayer, parseLink } from "../src/lib/embeds.ts";

const cases: [string, string | null, string | null][] = [
  // input, provider (null = plain link, "invalid" = rejected), expected canonical url
  ["https://www.instagram.com/p/DPabc123XYZ/?utm_source=ig_web_copy_link&igsh=MzRl", "instagram", "https://www.instagram.com/p/DPabc123XYZ/"],
  ["https://www.instagram.com/thechangehub/p/DPabc123XYZ/", "instagram", "https://www.instagram.com/p/DPabc123XYZ/"],
  ["https://instagram.com/reels/C9xyz/", "instagram", "https://www.instagram.com/reel/C9xyz/"],
  ["https://www.instagram.com/thechangehub?utm_source=ig_web_button_share_sheet", null, "https://www.instagram.com/thechangehub"],
  ["https://www.facebook.com/thechangehub/posts/pfbid02abc?__cft__[0]=x", "facebook", "https://www.facebook.com/thechangehub/posts/pfbid02abc"],
  ["https://www.facebook.com/watch/?v=1234567890", "facebook", "https://www.facebook.com/watch/?v=1234567890"],
  ["https://www.facebook.com/share/p/1AbCdEf/", "facebook", "https://www.facebook.com/share/p/1AbCdEf/"],
  ["https://www.facebook.com/thechangehub", null, "https://www.facebook.com/thechangehub"],
  ["https://youtu.be/dQw4w9WgXcQ?si=abc&t=42", "youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42"],
  ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube", "https://www.youtube.com/shorts/dQw4w9WgXcQ"],
  ["http://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
  ["https://vimeo.com/76979871", "vimeo", "https://vimeo.com/76979871"],
  ["https://vimeo.com/76979871/ab12cd34ef", "vimeo", "https://vimeo.com/76979871/ab12cd34ef"],
  ["https://www.tiktok.com/@reform/video/7300000000000000000?lang=ro", "tiktok", "https://www.tiktok.com/@reform/video/7300000000000000000"],
  ["https://open.spotify.com/intl-ro/episode/4rOoJ6Egrf8K2IrywzwOMk?si=x", "spotify", "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk"],
  ["https://drive.google.com/file/d/1AbC-dEf/view?usp=sharing", "drive", "https://drive.google.com/file/d/1AbC-dEf/view"],
  ["https://docs.google.com/presentation/d/1XyZ/edit#slide=id.p", "drive", "https://docs.google.com/presentation/d/1XyZ/edit"],
  ["https://reform.ro/despre", null, "https://reform.ro/despre"],
  ["javascript:alert(1)", "invalid", null],
  ["not a link", "invalid", null],
  ["ftp://example.org/file", "invalid", null],
];

for (const [input, provider, canonical] of cases) {
  const parsed = parseLink(input);
  if (provider === "invalid") {
    assert.equal(parsed, null, input);
    continue;
  }
  assert.ok(parsed, input);
  assert.equal(parsed.kind, provider ? "embed" : "link", input);
  if (provider) assert.equal(parsed.kind === "embed" && parsed.provider, provider, input);
  assert.equal(parsed.url, canonical, input);
  if (parsed.kind === "embed") {
    const player = embedPlayer(parsed.provider, parsed.url);
    assert.ok(player?.src.startsWith("https://"), `player for ${input}`);
  }
}

assert.equal(embedPlayer("instagram", "https://www.instagram.com/p/DPabc123XYZ/")?.src, "https://www.instagram.com/p/DPabc123XYZ/embed/captioned/");
assert.equal(embedPlayer("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s")?.src, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=90");
assert.equal(embedPlayer("drive", "https://drive.google.com/file/d/1AbC-dEf/view")?.src, "https://drive.google.com/file/d/1AbC-dEf/preview");
assert.equal(embedPlayer("drive", "https://docs.google.com/presentation/d/1XyZ/edit")?.src, "https://docs.google.com/presentation/d/1XyZ/embed");
assert.match(embedPlayer("facebook", "https://www.facebook.com/watch/?v=1234567890")?.src ?? "", /plugins\/video\.php/);
assert.match(embedPlayer("facebook", "https://www.facebook.com/thechangehub/posts/pfbid02abc")?.src ?? "", /plugins\/post\.php/);
assert.equal(embedPlayer("instagram", "https://evil.example/p/x/"), null, "a saved address that isn't Instagram any more gets no player");

console.log(`PASS ${cases.length + 7} link checks`);
