// How the file viewer decides how to show a file, and its CSV reader.
// Run: node --experimental-strip-types tests/viewer.test.ts
import assert from "node:assert/strict";
import { parseCsv, viewKind } from "../src/lib/viewer.ts";

const cases: [string, string | null, string][] = [
  ["Plan.pdf", "application/pdf", "pdf"],
  ["poza.JPG", "image/jpeg", "image"],
  ["desen.svg", "image/svg+xml", "other"],
  ["clip.mov", "video/quicktime", "video"],
  ["podcast.mp3", "audio/mpeg", "audio"],
  ["Raport.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["Buget.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ["Prezentare.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
  ["vechi.doc", "application/msword", "other"],
  ["vechi.xls", "application/vnd.ms-excel", "other"],
  ["Lista.csv", "text/csv", "csv"],
  ["Lista.csv", "text/plain", "csv"],
  ["Note.txt", "text/plain", "text"],
  ["fara-tip.pdf", null, "pdf"],
  ["fara-tip.docx", "application/octet-stream", "docx"],
  ["arhiva.zip", "application/zip", "other"],
];
for (const [name, mime, expected] of cases) assert.equal(viewKind(name, mime), expected, `${name} (${mime})`);

assert.deepEqual(parseCsv("nume;clasa\nAna;11A\n\"Toma; Matei\";10B\n"), [["nume", "clasa"], ["Ana", "11A"], ["Toma; Matei", "10B"]]);
assert.deepEqual(parseCsv('a,b\r\n"say ""hi""",2'), [["a", "b"], ['say "hi"', "2"]]);
assert.equal(parseCsv("x\n".repeat(50), 10).length, 10);

console.log("PASS viewer kinds and CSV");
