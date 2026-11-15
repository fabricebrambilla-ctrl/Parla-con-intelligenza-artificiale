// Turns the text of a web page (markdown from Tavily Extract) into something small
// enough for the model: the part that matters for the question, or numbered parts
// for reading a long article aloud. Pure functions, no network.

const STOP = new Set(("the and for are was were with that this from what when where which who how does did can could would should " +
  "you your have has had not but about into than then them they there their its it's i'm please tell give know want need " +
  "che chi con per non una uno gli del della delle dei dai dal alla alle sono come cosa quando dove quale quali mi ti si ci " +
  "les des est une pour pas que qui dans sur avec sont mais quel quelle quand comment vous nous " +
  "как что это для или при где когда какой какая какие мне " +
  "как какво кога къде за от на " +
  "het een van dat niet zijn met voor maar ook wat wie waar wanneer hoe welke naar bij mij " +
  "uma dos das que não com por para mais como quando onde qual quais").split(" "));

function fold(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Words of the question worth looking for on the page (place names, numbers, nouns).
function terms(question) {
  const out = [];
  const words = fold(question).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const w of words) {
    const cjk = /[぀-ヿ一-鿿]/.test(w);
    if (STOP.has(w) || (!cjk && w.length < 3 && !/^\d+$/.test(w))) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out.slice(0, 24);
}

// Markdown to plain reading text: no images, links become their words, menus dropped.
function cleanPage(markdown) {
  return String(markdown || "")
    .replace(/\r/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\s*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // A PDF can run two tables into one line: a day heading ("MONDAY–FRIDAY") right after a time
    // starts the next table, so it starts a new line.
    .replace(/(?<=\d[:.]\d\d)[ \t]+(?=(MONDAY|TUESDAY|SATURDAY|SUNDAY|WEEKDAYS?|WEEKENDS?)\b)/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .filter((line) => !/^\s*(skip (to )?(navigation|main content|content)|menu|search|close|cookie settings?)\s*$/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const isTableLine = (line) => /^\s*\|/.test(line);

// Text from a PDF often arrives as one huge paragraph with very long lines (a whole timetable
// page on one line). Such text is cut into lines, and long lines into pieces of about `size`
// characters at a space, so that the part that matters can be found and the rest left out.
// Timetable rows are kept one per line, so that a run of rows can be followed across blank lines.
function pieces(para, size = 1000) {
  const lines = para.split("\n");
  if (lines.length > 1 && lines.some(isTimeRow)) return lines.filter((line) => line.trim());
  if (para.length <= 1500) return [para];
  const out = [];
  for (let line of para.split("\n")) {
    while (line.length > size * 1.2) {
      let cut = line.lastIndexOf(" ", size);
      if (cut < size / 2) cut = size;
      out.push(line.slice(0, cut).trim());
      line = line.slice(cut).trim();
    }
    if (line.trim()) out.push(line);
  }
  return out;
}

// Paragraphs, with each table kept together as one block.
function blocks(text) {
  const out = [];
  let table = [];
  const flush = () => { if (table.length) { out.push(table.join("\n")); table = []; } };
  for (const para of String(text).split(/\n{2,}/)) {
    const lines = para.split("\n");
    if (lines.every(isTableLine)) { table.push(...lines); continue; }
    flush();
    if (para.trim()) out.push(...pieces(para));
  }
  flush();
  return out;
}

function score(block, wanted, wantsTimes) {
  const f = fold(block);
  let s = 0;
  for (const w of wanted) if (f.includes(w)) s += 2;
  if (wantsTimes && /\b\d{1,2}[:.h]\d{2}(?=[aApP]\b|\b)/.test(block)) s += 1;
  // A direction heading ("L.A. → San Bernardino") towards a place that was asked about.
  for (const m of f.matchAll(/(?:→|->|➝)\s*([^→\n]{1,40})/g)) if (wanted.some((w) => m[1].includes(w))) { s += 3; break; }
  return s;
}

// A long table: its header and the rows that mention what was asked.
function trimTable(block, wanted, max) {
  if (block.length <= max) return block;
  const lines = block.split("\n");
  const head = lines.slice(0, 2);
  let rows = lines.slice(2).filter((line) => { const f = fold(line); return wanted.some((w) => f.includes(w)); });
  if (!rows.length) rows = lines.slice(2);
  const out = [...head];
  let size = head.join("\n").length;
  for (const row of rows) {
    if (size + row.length + 1 > max) break;
    out.push(row); size += row.length + 1;
  }
  return out.join("\n") + (out.length < lines.length ? "\n(table shortened to the matching rows)" : "");
}

// A timetable row: a stop followed by a list of times.
// "6:38", "6.38", "4:01a", "11:44P", "7:02 am" (the letters stay out of the match).
const TIME = /\b\d{1,2}[:.]\d{2}(?=[aApP]\b|\b)/g;
const isTimeRow = (block) => !block.includes("\n") && block.length <= 400 && (block.match(TIME) || []).length >= 5 &&
  block.search(TIME) <= 60;

const minutes = (t) => { const [h, m] = t.split(/[:.]/).map(Number); return (h % 12) * 60 + m; };
const stopOf = (row) => row.slice(0, row.search(TIME)).trim();

// PDF text often puts a table's heading in the wrong place, so the heading cannot be trusted to give
// the direction. The times can: one train's time grows from the stop it leaves to the stop it reaches.
// Compares the first time of the first and the last row (12-hour clocks, a trip under six hours).
// Rows named only "departs" or "arr." belong to the stop next to them: they are not the ends.
const isPlace = (row) => stopOf(row).length > 2 && !/(^|\s)(dep(arts?|\.)?|arr(ives?|\.)?|partenza|arrivo|départ|arrivée)($|\s)/i.test(stopOf(row));
function direction(run) {
  const ends = run.filter(isPlace);
  if (ends.length < 2) return "";
  const first = ends[0], last = ends[ends.length - 1];
  const a = first.match(TIME)[0], b = last.match(TIME)[0];
  const diff = (minutes(b) - minutes(a) + 720) % 720;
  if (!diff) return "";
  const [from, to] = diff < 360 ? [stopOf(first), stopOf(last)] : [stopOf(last), stopOf(first)];
  if (!from || !to) return "";
  return `(Worked out from the times: trains in this table travel from ${from} to ${to.replace(/\.$/, "")}.)\n`;
}

// Consecutive timetable rows belong together: the order of the stops and the way the times grow
// show the direction of travel. Cutting out only the rows that were asked about loses that, and a
// station's arrival time from the other direction gets mistaken for a departure. So a run of rows is
// kept as one block: rows that were asked about in full, the others as "stop, first time ... last time".
function timetableRuns(list, wanted) {
  const out = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const hit = run.some((row) => { const f = fold(row); return wanted.some((w) => f.includes(w)); });
    if (!hit || run.length < 3) out.push(...run);
    else out.push(direction(run) + run.map((row) => {
      const f = fold(row);
      if (wanted.some((w) => f.includes(w))) return row;
      const times = row.match(TIME);
      return `${stopOf(row)} ${times[0]} ... ${times[times.length - 1]}`;
    }).join("\n"));
    run = [];
  };
  for (const b of list) {
    if (isTimeRow(b)) run.push(b); else { flush(); out.push(b); }
  }
  flush();
  return out;
}

// The part of the page that matters for the question, at most `max` characters,
// in the page's own order. Falls back to the start of the page when nothing matches.
function relevantPart(text, question, max = 6000) {
  const clean = String(text || "");
  if (clean.length <= max) return clean;
  const wanted = terms(question);
  const wantsTimes = asksTime(question);
  const all = timetableRuns(blocks(clean), wanted)
    .map((b, i) => ({ i, text: isTableLine(b.split("\n")[0]) ? trimTable(b, wanted, 2500) : b }));
  for (const b of all) b.score = score(b.text, wanted, wantsTimes);
  const picked = new Set();
  let size = 0;
  const add = (b) => {
    if (picked.has(b.i) || size + b.text.length + 2 > max) return false;
    picked.add(b.i); size += b.text.length + 2;
    return true;
  };
  for (const b of [...all].sort((x, y) => y.score - x.score || x.i - y.i)) {
    if (b.score <= 0) break;
    // Keep the heading that introduces the block (a title, or a short line such as
    // "MONDAY–FRIDAY 300 302 ..."), so times keep their line, days and direction.
    const before = all[b.i - 1];
    if (before && (/^#{1,6}\s/.test(before.text) ? before.text.length < 200 : before.text.length < 300 && !isTimeRow(before.text))) add(before);
    add(b);
    if (size > max * 0.9) break;
  }
  if (!picked.size) return clean.slice(0, max);
  return all.filter((b) => picked.has(b.i)).map((b) => b.text.length > max ? b.text.slice(0, max) : b.text).join("\n\n");
}

// A long article in numbered parts for reading aloud, cut at paragraph ends.
function splitParts(text, size = 2500) {
  const parts = [];
  let cur = "";
  for (let para of String(text || "").split(/\n{2,}/)) {
    while (para.length > size) {
      let cut = para.lastIndexOf(". ", size);
      if (cut < size / 2) cut = para.lastIndexOf(" ", size);
      if (cut < size / 2) cut = size - 1;
      const head = para.slice(0, cut + 1);
      if (cur) { parts.push(cur); cur = ""; }
      parts.push(head.trim());
      para = para.slice(cut + 1);
    }
    if (cur && (cur + "\n\n" + para).length > size) { parts.push(cur); cur = para; }
    else cur = cur ? cur + "\n\n" + para : para;
  }
  if (cur.trim()) parts.push(cur);
  return parts.length ? parts : [""];
}

// Short sentences that say when the page's information is valid or was updated ("Effective Monday,
// January 26, 2026", "Valido dal 14 dicembre 2025", "Updated September 2025"), so the answer can name them.
const DATED = /\b(effective|valid|updated|last updated|published|revised|as of|valido|valida|in vigore|aggiornat[oa]|pubblicat[oa]|en vigueur|valable|mis à jour|publié|gültig|aktualisiert|действ|обновл|опубликов|в сила|актуализ|geldig|bijgewerkt|gepubliceerd|dienstregeling vanaf|válid[oa]|atualizad[oa]|publicad[oa]|em vigor)/i;
const HAS_DATE = /\b(19|20)\d{2}\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\d{4}年/;
function pageDates(text, max = 3) {
  const out = [];
  for (const sentence of String(text || "").split(/(?<=[.!?])\s+|\n+/)) {
    let s = sentence.trim();
    const at = s.search(DATED);
    if (at < 0 || !HAS_DATE.test(s)) continue;
    if (s.length > 160) {
      // A long run of PDF text: keep the words around the date only.
      const from = Math.max(0, at - 40);
      const tail = s.slice(at);
      const end = tail.search(HAS_DATE);
      if (end < 0 || end > 60) continue;
      s = (from ? "..." : "") + s.slice(from, at + end + 12).trim() + "...";
    }
    if (!out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

// The newest year named in the page's date sentences, or 0.
function newestYear(dates) {
  const years = (dates || []).join(" ").match(/\b(19|20)\d{2}\b/g) || [];
  return years.length ? Math.max(...years.map(Number)) : 0;
}

// Many times but no timetable rows that could be followed: the table's layout was lost
// (a PDF read column by column), so a time cannot be tied to a stop and a direction.
// Also when the page is full of times but none of them made it into the part chosen for the
// question (the times sit in columns, apart from the station names).
function layoutLost(text, page = "") {
  const t = String(text || ""), count = (x) => (String(x).match(TIME) || []).length;
  if (t.includes("(Worked out from the times:")) return false;
  return count(t) >= 20 || (count(page) >= 20 && count(t) < 5);
}

const asksTime = (question) => /\b(time|times|timetable|schedule|when|first|last|next|orari|orario|ora|quando|primo|ultimo|prossimo|horaire|heure|quand|premier|dernier|prochain|hoe laat|wanneer|eerste|laatste|volgende|dienstregeling|horario|horarios|primeiro|proximo|a que horas)\b|распис|время|когда|во сколько|в колко|кога|时间|时刻|時刻|何時|几点|いつ/i.test(fold(question));

// Links on the page that may hold the real answer (a timetable page or PDF), as absolute addresses.
function usefulLinks(markdown, base, question, max = 12) {
  const wanted = terms(question);
  const out = [], seen = new Set();
  const re = /\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g;
  let m;
  while ((m = re.exec(String(markdown || ""))) && out.length < max) {
    const label = m[1].replace(/!\[[^\]]*\]/g, "").trim();
    let url;
    try { url = new URL(m[2], base); } catch { continue; }
    if (!/^https?:$/.test(url.protocol)) continue;
    const hay = fold(label + " " + url.pathname);
    const useful = /timetable|schedule|orari|horaire|fahrplan|dienstregeling|horario|\.pdf\b|fares?|prices?|tariff|prezzi|tarifs|tarieven|precos/.test(hay) || wanted.some((w) => hay.includes(w));
    if (!useful || !label || seen.has(url.href)) continue;
    seen.add(url.href);
    out.push({ text: label.slice(0, 80), url: url.href.slice(0, 300) });
  }
  return out;
}

module.exports = { terms, cleanPage, relevantPart, splitParts, usefulLinks, pageDates, layoutLost, asksTime, newestYear };
