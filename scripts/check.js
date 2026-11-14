#!/usr/bin/env bun
// Validate every book in public/books: syntax, links between scenes/chapters, declared items and stats, pictures.
//   bun scripts/check.js        exit code 1 on errors; warnings don't fail
import { fileURLToPath } from "node:url";
import { condNames, parseBook, parseChapter, parseLibrary, resolveTarget } from "../public/story.js";

const root = new URL("../public/books/library.md", import.meta.url).href;
let errors = 0, warnings = 0;
const rel = u => fileURLToPath(u).replace(fileURLToPath(new URL("../", import.meta.url)), "");
const error = (u, line, msg) => { errors++; console.log(`error  ${rel(u)}${line ? ":" + line : ""}  ${msg}`); };
const warn = (u, line, msg) => { warnings++; console.log(`warn   ${rel(u)}${line ? ":" + line : ""}  ${msg}`); };
const exists = u => Bun.file(fileURLToPath(u)).exists();
const text = u => Bun.file(fileURLToPath(u)).text();

const library = parseLibrary(await text(root), root);
if (!library.length) error(root, undefined, "no books listed (lines like `- [Title](folder/book.md)`)");

for (const entry of library) {
  if (!(await exists(entry.url))) { error(root, undefined, `book file missing: ${entry.path}`); continue; }
  const book = parseBook(await text(entry.url), entry.url);
  for (const e of book.errors) error(book.url, e.line, e.msg);
  if (!book.title) error(book.url, undefined, "book has no title (front matter `title:`)");
  if (!book.chapters.length) error(book.url, undefined, "book has no `## Chapters`");
  for (const icon of [book.cover, ...Object.values(book.stats).map(s => s.icon), ...Object.values(book.items).map(i => i.icon)])
    if (icon && !(await exists(icon))) error(book.url, undefined, `picture missing: ${rel(icon)}`);

  const chapters = new Map();
  for (const c of book.chapters) {
    if (!(await exists(c.url))) { error(book.url, undefined, `chapter file missing: ${c.path}`); continue; }
    chapters.set(c.url, parseChapter(await text(c.url), c.url));
  }

  // Flags are whatever `set` names; conditions may read stats, items and flags.
  const flags = new Set();
  for (const ch of chapters.values()) for (const s of Object.values(ch.scenes)) for (const tk of s.tokens)
    for (const op of tk.ops ?? []) if (op.op === "set" || op.op === "unset") flags.add(op.name);
  const known = n => n in book.stats || n in book.items || flags.has(n);

  for (const ch of chapters.values()) {
    for (const e of ch.errors) error(ch.url, e.line, e.msg);
    if (!ch.order.length) { error(ch.url, undefined, "no scenes (a scene starts with `# scene-id`)"); continue; }
    const reach = new Set(), links = new Map();
    let ends = false;
    const checkTarget = (target, line) => {
      const t = resolveTarget(target, ch.url);
      if (t.end) { ends = true; return; }
      const other = t.file ? chapters.get(t.file) : ch;
      if (!other) return error(ch.url, line, `"${target}": that file is not a chapter of this book`);
      const scene = t.scene || other.start;
      if (!other.scenes[scene]) return error(ch.url, line, `"${target}": no scene "${scene}"`);
      if (other === ch) return scene;
    };
    for (const s of Object.values(ch.scenes)) {
      const next = [];
      let depth = 0, choices = 0, go = false;
      for (const tk of s.tokens) {
        if (tk.t === "img" && !(await exists(tk.src))) error(ch.url, tk.line, `picture missing: ${tk.path}`);
        if (tk.t === "choice") {
          choices++;
          const n = checkTarget(tk.target, tk.line); if (n) next.push(n);
          for (const name of condNames(tk.cond)) if (!known(name)) error(ch.url, tk.line, `condition uses "${name}": not a stat, item or flag`);
        }
        for (const op of tk.ops ?? []) {
          if (op.op === "if") { depth++; for (const name of condNames(op.cond)) if (!known(name)) error(ch.url, tk.line, `condition uses "${name}": not a stat, item or flag`); }
          if (op.op === "end" && --depth < 0) error(ch.url, tk.line, "{end} without {if}");
          if (op.op === "else" && depth < 1) error(ch.url, tk.line, "{else} without {if}");
          if ((op.op === "get" || op.op === "lose") && !(op.name in book.items)) error(ch.url, tk.line, `item "${op.name}" is not in the book's ## Items`);
          if (op.op === "stat" && !(op.name in book.stats)) error(ch.url, tk.line, `stat "${op.name}" is not in the book's ## Stats`);
          if (op.op === "go") { go = true; const n = checkTarget(op.target, tk.line); if (n) next.push(n); }
          if (tk.t === "tap" && ["if", "else", "end", "go"].includes(op.op)) error(ch.url, tk.line, `{${op.op}} can't be used in a tapped word`);
        }
      }
      if (depth > 0) error(ch.url, s.line, `scene "${s.id}": {if} without {end}`);
      if (!choices && !go) error(ch.url, s.line, `scene "${s.id}" has no choices: the reader gets stuck`);
      links.set(s.id, next);
    }
    const queue = [ch.start];
    while (queue.length) { const id = queue.pop(); if (reach.has(id)) continue; reach.add(id); queue.push(...(links.get(id) ?? [])); }
    for (const id of ch.order) if (!reach.has(id)) warn(ch.url, ch.scenes[id].line, `scene "${id}" can't be reached from "${ch.start}"`);
    if (!ends) warn(ch.url, undefined, "no `-> @end` choice: the chapter never finishes");
  }
  console.log(`${book.title}: ${chapters.size} chapters, ${[...chapters.values()].reduce((n, c) => n + c.order.length, 0)} scenes`);
}
console.log(errors ? `${errors} error(s), ${warnings} warning(s)` : `ok, ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
