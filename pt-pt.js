// Portuguese answers in Portugal's Portuguese (pt-PT), the owner's choice.
// The model is told to write pt-PT, but it still mixes in Brazilian forms ("acessem", "na tela").
// This runs on the finished answer, on the server, with no extra provider call:
//   brazilianForms(text) lists the Brazilian forms it finds (for the log and for tests);
//   toPortugal(text) replaces only the forms whose pt-PT word is certain from the words around them.
// Forms that need the sentence rewritten ("você", "baixar", "arquivo", a bare "tela" or "celular")
// are only flagged: a wrong automatic change would be worse than the Brazilian word.

const L = String.raw`(?<!\p{L})`;   // start of a word (also for accented letters)
const R = String.raw`(?![\p{L}-])`;  // end of a word

// [Brazilian form, pt-PT form]. Same gender and number on both sides, so articles stay right.
const WORDS = [
  ["contato", "contacto"], ["contatos", "contactos"], ["contatar", "contactar"], ["contate", "contacte"],
  ["contatem", "contactem"], ["contatou", "contactou"], ["contatá-lo", "contactá-lo"], ["contatá-la", "contactá-la"],
  ["equipe", "equipa"], ["equipes", "equipas"],
  ["usuário", "utilizador"], ["usuários", "utilizadores"], ["usuária", "utilizadora"], ["usuárias", "utilizadoras"],
  ["acessar", "aceder"], ["acesse", "aceda"], ["acessem", "acedam"], ["acessa", "acede"], ["acessam", "acedem"],
  ["acessou", "acedeu"], ["acessaram", "acederam"], ["acessá-lo", "acedê-lo"], ["acessá-la", "acedê-la"],
  ["trem", "comboio"], ["trens", "comboios"],
  ["registro", "registo"], ["registros", "registos"], ["registrar", "registar"], ["registre", "registe"],
  ["registrado", "registado"], ["registrada", "registada"], ["registrados", "registados"], ["registradas", "registadas"],
  ["esporte", "desporto"], ["esportes", "desportos"], ["esportivo", "desportivo"], ["esportiva", "desportiva"],
  ["esportivos", "desportivos"], ["esportivas", "desportivas"],
  ["econômico", "económico"], ["econômica", "económica"], ["econômicos", "económicos"], ["econômicas", "económicas"],
  ["fenômeno", "fenómeno"], ["fenômenos", "fenómenos"], ["gênero", "género"], ["gêneros", "géneros"],
  ["acadêmico", "académico"], ["acadêmica", "académica"], ["anônimo", "anónimo"], ["anônima", "anónima"],
  ["tênis", "ténis"], ["Antônio", "António"], ["bebê", "bebé"], ["bebês", "bebés"], ["câmera", "câmara"], ["câmeras", "câmaras"],
];

// Phrases where the words around make the pt-PT form certain.
const PHRASES = [
  [new RegExp(`${L}(n|d|pel)a tela${R}`, "giu"), (m, p) => keepCase(m, { n: "no", d: "do", pel: "pelo" }[p.toLowerCase()] + " ecrã")],
  [new RegExp(`${L}(o|do|no|pelo|ao|um|seu|teu) celular${R}`, "giu"), (m, d) => d + " telemóvel"],
  [new RegExp(`${L}(os|dos|nos|pelos|aos|seus|teus) celulares${R}`, "giu"), (m, d) => d + " telemóveis"],
  [new RegExp(`${L}(os|dos|nos|pelos|aos) ônibus${R}`, "giu"), (m, d) => d + " autocarros"],
  [new RegExp(`${L}ônibus${R}`, "giu"), (m) => keepCase(m, "autocarro")],
  [new RegExp(`${L}de fato${R}`, "giu"), (m) => keepCase(m, "de facto")],
  [new RegExp(`${L}café da manhã${R}`, "giu"), (m) => keepCase(m, "pequeno-almoço")],
];

// "está fazendo" → "está a fazer": estar followed directly by a gerund.
const ESTAR = "estou|estás|está|estamos|estão|estava|estavas|estávamos|estavam|estive|esteve|estivemos|estiveram|" +
  "esteja|estejam|estar|estaria|estariam|estarei|estará|estaremos|estarão";
const GERUND = new RegExp(`${L}(${ESTAR}) (\\p{L}*?)(ando|endo|indo|ondo)${R}`, "giu");
// Words that end like a gerund but are not one ("está lindo", "estava quando").
const NOT_GERUND = new Set(["lindo", "quando", "brando", "tremendo", "estupendo", "horrendo", "remendo", "comando",
  "fundo", "mundo", "segundo", "redondo", "hediondo", "infindo"]);
function infinitive(root, end) {
  if (end === "ondo") return root === "p" ? "pôr" : root + "por"; // pondo → pôr, compondo → compor
  return root + { ando: "ar", endo: "er", indo: "ir" }[end];
}

// Flagged only: the pt-PT wording depends on the sentence.
const FLAG_ONLY = [
  ["você", new RegExp(`${L}vocês?${R}`, "iu")],
  ["tela", new RegExp(`${L}telas?${R}`, "iu")],
  ["celular", new RegExp(`${L}celular(?:es)?${R}`, "iu")],
  ["arquivo", new RegExp(`${L}arquivos?${R}`, "iu")],
  ["baixar", new RegExp(`${L}(?:baixar|baixe|baixem|baixou|baixando)${R}`, "iu")],
  ["aplicativo", new RegExp(`${L}aplicativos?${R}`, "iu")],
  ["banheiro", new RegExp(`${L}banheiros?${R}`, "iu")],
  ["geladeira", new RegExp(`${L}geladeiras?${R}`, "iu")],
  ["planilha", new RegExp(`${L}planilhas?${R}`, "iu")],
  ["mouse", new RegExp(`${L}mouse${R}`, "iu")],
  ["a gente", new RegExp(`${L}a gente${R}`, "iu")],
  ["pra", new RegExp(`${L}pra${R}`, "iu")],
];

function keepCase(original, replacement) {
  const first = original.charAt(0);
  return first !== first.toLowerCase() ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
}

const WORD_RE = WORDS.map(([br, pt]) => [new RegExp(`${L}${br}${R}`, "giu"), pt, br]);

function gerundsIn(text) {
  const found = [];
  for (const m of String(text).matchAll(GERUND)) {
    const word = (m[2] + m[3]).toLowerCase();
    if (!NOT_GERUND.has(word)) found.push(m[1] + " " + m[2] + m[3]);
  }
  return found;
}

// The Brazilian forms in a text, each named once, lower case.
function brazilianForms(text) {
  const t = String(text || "");
  const found = new Set();
  for (const [re, , br] of WORD_RE) { re.lastIndex = 0; if (re.test(t)) found.add(br.toLowerCase()); }
  for (const [re] of PHRASES) { re.lastIndex = 0; const m = t.match(re); if (m) found.add(m[0].toLowerCase()); }
  for (const g of gerundsIn(t)) found.add(g.toLowerCase());
  for (const [name, re] of FLAG_ONLY) if (re.test(t)) found.add(name);
  return [...found];
}

// The text with every certain Brazilian form changed to pt-PT; everything else unchanged.
function toPortugal(text) {
  let t = String(text || "");
  for (const [re, fix] of PHRASES) t = t.replace(re, fix);
  for (const [re, pt] of WORD_RE) t = t.replace(re, (m) => keepCase(m, pt));
  t = t.replace(GERUND, (m, estar, root, end) => {
    const word = (root + end).toLowerCase();
    return NOT_GERUND.has(word) ? m : `${estar} a ${keepCase(root + end, infinitive(root.toLowerCase(), end))}`;
  });
  return t;
}

module.exports = { brazilianForms, toPortugal };
