// Story engine: parses the markdown book format (documented in WRITING.md) and runs scenes.
// No DOM access, so scripts/check.ts uses the same parser to validate books.

/** Strip `<!-- comments -->` (keeping line numbers) and a leading `---` front-matter block of `key: value` lines. */
export function splitFrontMatter(src) {
  src = src.replace(/\r\n?/g, "\n").replace(/<!--[\s\S]*?-->/g, c => c.replace(/[^\n]/g, ""));
  const meta = {};
  let offset = 0;
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
  if (m) {
    for (const l of m[1].split("\n")) {
      const kv = /^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(l);
      if (kv) meta[kv[1]] = kv[2];
    }
    offset = m[0].split("\n").length - 1;
    src = src.slice(m[0].length);
  }
  return { meta, body: src, offset };
}

const abs = (path, base) => new URL(path, base).href;
const IMG = /!\[([^\]]*)\]\(([^)\s]+)\)/;

/** `- [Title](book/book.md)` lines. */
export function parseLibrary(src, url) {
  const books = [];
  for (const l of splitFrontMatter(src).body.split("\n")) {
    const m = /^\s*[-*]\s*\[([^\]]+)\]\(([^)\s]+)\)/.exec(l);
    if (m) books.push({ title: m[1].trim(), path: m[2], url: abs(m[2], url) });
  }
  return books;
}

// German and English section names / front-matter keys are both accepted.
const SECTIONS = { stats: "stats", werte: "stats", items: "items", dinge: "items", chapters: "chapters", kapitel: "chapters" };

/** Book file: front matter (titel, bild), blurb, then `## Werte`, `## Dinge`, `## Kapitel` sections. */
export function parseBook(src, url) {
  const { meta, body, offset } = splitFrontMatter(src);
  const cover = meta.bild || meta.cover;
  const book = { url, title: meta.titel || meta.title || "", cover: cover ? abs(cover, url) : "", blurb: [], stats: {}, items: {}, chapters: [], errors: [] };
  let section = "", heading = "";
  body.split("\n").forEach((l, i) => {
    const line = i + 1 + offset;
    const h = /^##\s+(.+?)\s*$/.exec(l);
    if (h) { heading = h[1]; section = SECTIONS[h[1].toLowerCase()] || "?"; return; }
    if (/^#\s/.test(l)) { if (!book.title) book.title = l.slice(2).trim(); return; }
    if (!section) { if (l.trim()) book.blurb.push(l.trim()); return; }
    if (!l.trim()) return;
    if (section === "chapters") {
      const m = /^\s*(?:\d+\.|[-*])\s*\[([^\]]+)\]\(([^)\s]+)\)/.exec(l);
      if (m) book.chapters.push({ title: m[1].trim(), path: m[2], url: abs(m[2], url) });
      else book.errors.push({ line, msg: `Kapitel-Zeilen sehen so aus: "1. [Titel](datei.md)": ${l.trim()}` });
      return;
    }
    const m = /^\s*[-*]\s*(\w+)\s*:\s*(.*)$/.exec(l);
    if (!m || (section !== "stats" && section !== "items")) { book.errors.push({ line, msg: `unerwartete Zeile unter "## ${heading}" (erlaubt: ## Werte, ## Dinge, ## Kapitel): ${l.trim()}` }); return; }
    let rest = m[2];
    const img = IMG.exec(rest);
    const icon = img ? abs(img[2], url) : "";
    rest = rest.replace(IMG, "");
    if (section === "stats") {
      const start = /=\s*(\d+)/.exec(rest);
      book.stats[m[1]] = { label: rest.replace(/=\s*\d+/, "").trim() || m[1], icon, start: start ? Number(start[1]) : 0 };
    } else {
      book.items[m[1]] = { label: rest.trim() || m[1], icon };
    }
  });
  return book;
}

// ---- conditions: `brave >= 2 and not sock`, `(bell or sock) and brave > 1` ----
const COND_TOKEN = /\s*(>=|<=|!=|==|=|>|<|\(|\)|\d+|[A-Za-z_]\w*)/y;

export function compileCond(src) {
  const toks = [];
  COND_TOKEN.lastIndex = 0;
  let m;
  while (COND_TOKEN.lastIndex < src.length && (m = COND_TOKEN.exec(src))) toks.push(m[1]);
  if (src.slice(COND_TOKEN.lastIndex).trim()) throw new Error(`Bedingung "${src}" ist nicht lesbar`);
  let p = 0;
  const peek = () => toks[p], take = () => toks[p++];
  const expect = t => { if (take() !== t) throw new Error(`"${t}" fehlt in der Bedingung "${src}"`); };
  function or() { let a = and(); while (peek() === "or") { take(); a = { op: "or", a, b: and() }; } return a; }
  function and() { let a = not(); while (peek() === "and") { take(); a = { op: "and", a, b: not() }; } return a; }
  function not() { if (peek() === "not") { take(); return { op: "not", a: not() }; } return cmp(); }
  function cmp() {
    const a = atom();
    if ([">=", "<=", "!=", "==", "=", ">", "<"].includes(peek())) return { op: take(), a, b: atom() };
    return a;
  }
  function atom() {
    const t = take();
    if (t === undefined) throw new Error(`Bedingung "${src}" hört zu früh auf`);
    if (t === "(") { const e = or(); expect(")"); return e; }
    if (/^\d+$/.test(t)) return { op: "num", v: Number(t) };
    if (/^[A-Za-z_]\w*$/.test(t) && !["and", "or", "not"].includes(t)) return { op: "name", v: t };
    throw new Error(`unerwartetes "${t}" in der Bedingung "${src}"`);
  }
  const ast = or();
  if (p !== toks.length) throw new Error(`unerwartetes "${toks[p]}" in der Bedingung "${src}"`);
  return ast;
}

/** Every name a condition reads (for validation). */
export function condNames(ast, out = new Set()) {
  if (!ast) return out;
  if (ast.op === "name") out.add(ast.v);
  condNames(ast.a, out); condNames(ast.b, out);
  return out;
}

/** Value of a name: stat value, item count, or 1/0 for a flag. */
export const valueOf = (state, name) => state.stats[name] ?? state.items[name] ?? (state.flags[name] ? 1 : 0);

export function evalCond(ast, state) {
  const v = n => evalCond(n, state);
  switch (ast.op) {
    case "num": return ast.v;
    case "name": return valueOf(state, ast.v);
    case "not": return v(ast.a) ? 0 : 1;
    case "and": return v(ast.a) && v(ast.b) ? 1 : 0;
    case "or": return v(ast.a) || v(ast.b) ? 1 : 0;
    case ">=": return v(ast.a) >= v(ast.b) ? 1 : 0;
    case "<=": return v(ast.a) <= v(ast.b) ? 1 : 0;
    case ">": return v(ast.a) > v(ast.b) ? 1 : 0;
    case "<": return v(ast.a) < v(ast.b) ? 1 : 0;
    case "=": case "==": return v(ast.a) === v(ast.b) ? 1 : 0;
    case "!=": return v(ast.a) !== v(ast.b) ? 1 : 0;
  }
  return 0;
}

/** What a locked choice needs, for the lock badge: [{ name, n }] for `x >= n`, `x > n`, and plain `x` (n = 1). */
export function needs(ast) {
  const out = [];
  (function walk(n, negated) {
    if (!n) return;
    if (n.op === "not") return walk(n.a, !negated);
    if (negated) return;
    if (n.op === "name") out.push({ name: n.v, n: 1 });
    else if ((n.op === ">=" || n.op === ">") && n.a.op === "name" && n.b.op === "num") out.push({ name: n.a.v, n: n.b.v + (n.op === ">" ? 1 : 0) });
    else if (n.op === "and" || n.op === "or") { walk(n.a, false); walk(n.b, false); }
  })(ast, false);
  return out;
}

// ---- commands inside { }: get/lose item, set/unset flag, stat +N/-N/=N, say "...", go target, if/else/end ----
function parseOps(src) {
  return src.split(";").map(s => s.trim()).filter(Boolean).map(s => {
    let m;
    if ((m = /^if\s+(.+)$/.exec(s))) return { op: "if", src: m[1], cond: compileCond(m[1]) };
    if (s === "else") return { op: "else" };
    if (s === "end") return { op: "end" };
    if ((m = /^(get|lose)\s+(\w+)(?:\s+(\d+))?$/.exec(s))) return { op: m[1], name: m[2], n: m[3] ? Number(m[3]) : 1 };
    if ((m = /^(set|unset)\s+(\w+)$/.exec(s))) return { op: m[1], name: m[2] };
    if ((m = /^say\s+"(.*)"$/.exec(s)) || (m = /^say\s+(.+)$/.exec(s))) return { op: "say", text: m[1] };
    if ((m = /^go\s+(\S+)$/.exec(s))) return { op: "go", target: m[1] };
    if ((m = /^(\w+)\s*([+\-=])\s*(\d+)$/.exec(s))) return { op: "stat", name: m[1], how: m[2], n: Number(m[3]) };
    throw new Error(`unbekannter Befehl "{${s}}"`);
  });
}

const INLINE = /\[\[([^\]]*)\]\]|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\{([^}]*)\}|\{([^}]*)\}/g;

function tokenizeLine(l, url, line, errors, tokens) {
  let last = 0;
  const err = e => errors.push({ line, msg: e.message || String(e) });
  for (const m of l.matchAll(INLINE)) {
    if (m.index > last) tokens.push({ t: "text", s: l.slice(last, m.index) });
    last = m.index + m[0].length;
    try {
      if (m[1] !== undefined) {
        const c = /^(.*?)\s*->\s*([^|]+?)\s*(?:\|\s*(if|only)\s+(.+?))?\s*$/.exec(m[1]);
        if (!c) throw new Error(`eine Auswahl braucht "Text -> Ziel": [[${m[1]}]]`);
        tokens.push({ t: "choice", label: c[1].trim(), target: c[2], mode: c[3] || "", src: c[4] || "", cond: c[4] ? compileCond(c[4]) : null, line });
      } else if (m[2] !== undefined) tokens.push({ t: "img", alt: m[2], src: abs(m[3], url), path: m[3], line });
      else if (m[4] !== undefined) tokens.push({ t: "tap", s: m[4], ops: parseOps(m[5]), line });
      else tokens.push({ t: "cmd", ops: parseOps(m[6]), line });
    } catch (e) { err(e); }
  }
  if (last < l.length) tokens.push({ t: "text", s: l.slice(last) });
  tokens.push({ t: l.trim() ? "nl" : "gap" });
}

/** Chapter file: optional front matter (title), then scenes, each starting with a `# scene-id` line. */
export function parseChapter(src, url) {
  const { meta, body, offset } = splitFrontMatter(src);
  const ch = { url, title: meta.titel || meta.title || "", scenes: {}, order: [], errors: [] };
  let scene = null;
  body.split("\n").forEach((l, i) => {
    const line = i + 1 + offset;
    const h = /^#\s+([\w-]+)\s*$/.exec(l);
    if (h) {
      if (ch.scenes[h[1]]) ch.errors.push({ line, msg: `Szene "${h[1]}" gibt es zweimal` });
      else ch.order.push(h[1]);
      scene = ch.scenes[h[1]] = { id: h[1], line, tokens: [] };
      return;
    }
    if (/^#/.test(l)) { ch.errors.push({ line, msg: `Szenen-Überschriften sehen so aus: "# name" (Buchstaben a-z, Ziffern, -, _): ${l}` }); return; }
    if (!scene) { if (l.trim()) ch.errors.push({ line, msg: "Text vor der ersten \"# szene\"-Überschrift wird ignoriert" }); return; }
    tokenizeLine(l, url, line, ch.errors, scene.tokens);
  });
  ch.start = meta.start || ch.order[0];
  return ch;
}

// ---- running ----
export function newState(book) {
  const s = { items: {}, stats: {}, flags: {} };
  for (const [k, v] of Object.entries(book.stats)) s.stats[k] = v.start;
  return s;
}
export const clone = s => JSON.parse(JSON.stringify(s));

/** Apply one command to state; returns a visible effect ({ kind, ... }) or null. */
export function apply(op, state) {
  switch (op.op) {
    case "get": state.items[op.name] = (state.items[op.name] || 0) + op.n; return { kind: "item", name: op.name, delta: op.n };
    case "lose": {
      const had = state.items[op.name] || 0, now = Math.max(0, had - op.n);
      if (now) state.items[op.name] = now; else delete state.items[op.name];
      return had === now ? null : { kind: "item", name: op.name, delta: now - had };
    }
    case "set": state.flags[op.name] = 1; return null;
    case "unset": delete state.flags[op.name]; return null;
    case "stat": {
      const had = state.stats[op.name] || 0;
      const now = Math.max(0, op.how === "+" ? had + op.n : op.how === "-" ? had - op.n : op.n);
      state.stats[op.name] = now;
      return had === now ? null : { kind: "stat", name: op.name, delta: now - had };
    }
    case "say": return { kind: "say", text: op.text };
    case "go": return { kind: "go", target: op.target };
  }
  return null;
}

/**
 * Enter a scene: walks its tokens in order, runs the commands of active blocks (mutating `state`)
 * and returns what to show: lines of text/tap parts, pictures, gaps, the choices and the visible effects.
 */
export function enterScene(scene, state) {
  const blocks = [], choices = [], effects = [];
  let line = [], go = null;
  const stack = [];
  const active = () => !stack.length || stack[stack.length - 1].on;
  const flush = () => { if (line.some(p => p.s.trim())) blocks.push({ t: "line", parts: line }); line = []; };
  scene.tokens.forEach((tk, i) => {
    if (go) return;
    if (tk.t === "cmd") {
      for (const op of tk.ops) {
        if (op.op === "if") { const parent = active(); const val = parent && !!evalCond(op.cond, state); stack.push({ parent, val, on: val }); }
        else if (op.op === "else") { const top = stack[stack.length - 1]; if (top) top.on = top.parent && !top.val; }
        else if (op.op === "end") stack.pop();
        else if (active()) {
          const e = apply(op, state);
          if (e?.kind === "go") { go = e.target; return; }
          if (e) effects.push(e);
        }
      }
      return;
    }
    if (!active()) return;
    if (tk.t === "text") line.push({ t: "text", s: tk.s });
    else if (tk.t === "tap") line.push({ t: "tap", s: tk.s, i });
    else if (tk.t === "img") { flush(); blocks.push({ t: "img", src: tk.src, alt: tk.alt }); }
    else if (tk.t === "choice") choices.push(tk);
    else if (tk.t === "nl") flush();
    else if (tk.t === "gap") { flush(); if (blocks.length && blocks[blocks.length - 1].t !== "gap") blocks.push({ t: "gap" }); }
  });
  flush();
  return { blocks, choices, effects, go };
}

/** Run a tapped word's commands (not if/else/end). */
export function tap(scene, i, state) {
  const tk = scene.tokens[i];
  const effects = [];
  if (tk?.t === "tap") for (const op of tk.ops) { const e = apply(op, state); if (e && e.kind !== "go") effects.push(e); }
  return effects;
}

/** "on", "locked" (shown greyed with what it needs) or "hidden". */
export function choiceState(ch, state) {
  if (!ch.cond || evalCond(ch.cond, state)) return "on";
  return ch.mode === "only" ? "hidden" : "locked";
}

/** Split a target into { file (absolute url or ""), scene, end }. `@end` finishes the chapter. */
export function resolveTarget(target, chapterUrl) {
  if (target === "@end") return { end: true };
  const [file, scene] = target.split("#");
  if (/\.md$/.test(file)) return { file: abs(file, chapterUrl), scene: scene || "" };
  return { file: "", scene: target };
}

/** Words in a rendered scene (for the "you read N words" cheer). */
export const countWords = blocks => blocks.reduce((n, b) => n + (b.t === "line" ? b.parts.map(p => p.s).join("").split(/\s+/).filter(w => /[\p{L}\d]/u.test(w)).length : 0), 0);

