// Finds translation keys used in src/ and reports the ones missing from messages/ro.json and messages/en.json.
// Heuristic (static): each t("key") call is resolved against the nearest useTranslations/getTranslations
// binding of the same name above it in the file. Run with: node scripts/check-messages.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx?|mjs)$/.test(name)) files.push(path);
  }
})(join(root, "src"));

const used = new Map(); // key -> files
const patterns = []; // [regex source, file]
const add = (key, file) => used.set(key, [...(used.get(key) ?? []), file.replace(root, "")]);

function splitTop(text) {
  const out = [];
  let depth = 0, cur = "", quote = null;
  for (const ch of text) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; cur += ch; continue; }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const bindings = []; // {name, ns, index}
  for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([^"]*)")?\s*\)/g)) {
    bindings.push({ name: m[1], ns: m[2] ?? "", index: m.index });
  }
  for (const m of src.matchAll(/const\s*\[([^\]]*)\]\s*=\s*await\s+Promise\.all\(\[([\s\S]*?)\]\);/g)) {
    const names = splitTop(m[1]).map((s) => s.trim());
    const items = splitTop(m[2]);
    items.forEach((item, i) => {
      const g = /getTranslations\(\s*(?:"([^"]*)")?\s*\)/.exec(item);
      if (g && names[i] && /^\w+$/.test(names[i])) bindings.push({ name: names[i], ns: g[1] ?? "", index: m.index });
    });
  }
  // Keys passed around as strings, e.g. { error: "library.errors.saveFailed" }
  for (const m of src.matchAll(/(?:error|message):\s*"([a-zA-Z]+\.[a-zA-Z.]+)"/g)) add(m[1], file);
  for (const m of src.matchAll(/(?:error|message):\s*`([a-zA-Z]+\.[a-zA-Z.]+)\$\{/g)) patterns.push([`${m[1]}\${x}`, file.replace(root, "")]);
  if (!bindings.length) continue;
  const names = [...new Set(bindings.map((b) => b.name))];
  const nsFor = (name, index) => {
    const candidates = bindings.filter((b) => b.name === name);
    const before = candidates.filter((b) => b.index <= index).at(-1);
    return (before ?? candidates[0]).ns;
  };
  const re = new RegExp(`\\b(${names.join("|")})\\(\\s*("([^"]+)"|\`([^\`]+)\`)`, "g");
  for (const m of src.matchAll(re)) {
    const ns = nsFor(m[1], m.index);
    const prefix = ns ? `${ns}.` : "";
    if (m[3]) add(prefix + m[3], file);
    else if (m[4]) patterns.push([prefix + m[4], file.replace(root, "")]);
  }
}

function flatten(obj, prefix = "", out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

let missingTotal = 0;
for (const locale of ["ro", "en"]) {
  const keys = flatten(JSON.parse(readFileSync(join(root, "messages", `${locale}.json`), "utf8")));
  const missing = [...used.keys()].filter((k) => !keys.has(k) && !/\$\{/.test(k)).sort();
  const patternMisses = patterns.filter(([p]) => {
    const rx = new RegExp(`^${p.replace(/[.*+?^()|[\]\\]/g, "\\$&").replace(/\$\{[^}]+\}/g, "[^.]+")}$`);
    return ![...keys].some((k) => rx.test(k));
  });
  missingTotal += missing.length + patternMisses.length;
  if (missing.length || patternMisses.length) {
    console.log(`\n${locale}: ${missing.length} missing keys`);
    for (const k of missing) console.log(`  ${k}   (${used.get(k)[0]})`);
    for (const [p, f] of patternMisses) console.log(`  pattern ${p}   (${f})`);
  }
  if (process.argv.includes("--unused")) {
    const usedSet = new Set(used.keys());
    const unused = [...keys].filter((k) => !usedSet.has(k) && !patterns.some(([p]) => k.startsWith(p.split("${")[0])));
    console.log(`\n${locale}: ${unused.length} possibly unused keys`);
    for (const k of unused) console.log(`  ${k}`);
  }
}
if (process.argv.includes("--list")) for (const k of [...used.keys()].sort()) console.log(k);
if (process.argv.includes("--patterns")) for (const [p, f] of patterns) console.log(`${p}   (${f})`);
console.log(missingTotal ? `\n${missingTotal} problems` : "All translation keys found.");
process.exit(missingTotal ? 1 : 0);
