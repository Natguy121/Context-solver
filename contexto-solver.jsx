import React, { useState, useRef, useEffect } from "react";

/* ---------- palette + type ---------- */
const C = {
  paper: "#EDEFF6",
  card: "#FFFFFF",
  ink: "#171526",
  soft: "#5A5772",
  line: "#D3D7E6",
  cold: [59, 111, 224],
  warm: [224, 166, 59],
  hot: [224, 67, 47],
};
const HOT = `rgb(${C.hot.join(",")})`;
const COLD = `rgb(${C.cold.join(",")})`;

const display = { fontFamily: '"Iowan Old Style", Charter, Georgia, serif' };
const ui = { fontFamily: '"Avenir Next", "Segoe UI", system-ui, sans-serif' };
const data = { fontFamily: 'Menlo, ui-monospace, "SF Mono", monospace' };

function closeness(rank) {
  const t = 1 - Math.log(Math.max(1, rank)) / Math.log(20000);
  return Math.max(0.02, Math.min(1, t));
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function heat(rank) {
  const t = closeness(rank);
  const rgb = t < 0.5 ? mix(C.cold, C.warm, t * 2) : mix(C.warm, C.hot, (t - 0.5) * 2);
  return `rgb(${rgb.join(",")})`;
}

/* ================= learned memory ================= */
const MEM_KEY = "contexto:memory";
const FEATURES = ["votes", "answer", "leader", "assoc", "stem", "prior"];
const START_W = { votes: 0.8, answer: 0.9, leader: 1.2, assoc: 0.5, stem: 0.2, prior: -0.1, bias: -1.2 };
const blankMemory = () => ({ games: [], assoc: {}, weights: { ...START_W }, targets: {}, steps: 0 });

async function loadMemory() {
  try {
    const r = await window.storage.get(MEM_KEY, false);
    return r ? { ...blankMemory(), ...JSON.parse(r.value) } : blankMemory();
  } catch (e) {
    return blankMemory();
  }
}
async function saveMemory(m) {
  try {
    await window.storage.set(MEM_KEY, JSON.stringify(m), false);
  } catch (e) {
    /* memory is a bonus, never block play on it */
  }
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const shareStem = (a, b) => a.length > 3 && b.length > 3 && a.slice(0, 4) === b.slice(0, 4);

function assocScore(word, ladder, mem) {
  let s = 0;
  ladder.forEach((l) => {
    const edge = mem.assoc[l.word]?.[word];
    if (edge) s += edge * closeness(l.rank);
  });
  return Math.tanh(s);
}

function features(word, ladder, ctx, mem) {
  return {
    votes: Math.min(1, (ctx.votes || 1) / 3),
    answer: ctx.kind === "answer" ? 1 : 0,
    leader: ctx.leader ? 1 : 0,
    assoc: assocScore(word, ladder, mem),
    stem: ladder[0] && shareStem(word, ladder[0].word) ? 1 : 0,
    prior: Math.min(1, mem.targets[word] || 0),
  };
}

function score(x, w) {
  let z = w.bias;
  FEATURES.forEach((f) => (z += (w[f] || 0) * (x[f] || 0)));
  return sigmoid(z);
}

function sgd(examples, w0, lr = 0.3, epochs = 14) {
  const w = { ...w0 };
  for (let e = 0; e < epochs; e++) {
    const order = examples.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((i) => {
      const { x, y } = examples[i];
      const err = y - score(x, w);
      FEATURES.forEach((f) => {
        w[f] = Math.max(-3, Math.min(3, w[f] + lr * err * (x[f] || 0)));
      });
      w.bias = Math.max(-3, Math.min(3, w.bias + lr * err));
    });
  }
  return w;
}

function recall(ladder, mem, tried) {
  const s = new Map();
  mem.games.forEach((g) => {
    let overlap = 0;
    g.close.forEach((c) => {
      const cur = ladder.find((l) => l.word === c.word);
      if (cur) overlap += closeness(cur.rank) * c.w;
    });
    if (overlap > 0.08 && !tried.has(g.target)) s.set(g.target, (s.get(g.target) || 0) + overlap);
  });
  return [...s.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => ({ word, why: "matched a solved game", votes: 1, recalled: true }));
}

function recallText(ladder, mem) {
  const hits = [];
  mem.games.forEach((g) => {
    const shared = g.close.filter((c) => ladder.some((l) => l.word === c.word)).map((c) => c.word);
    if (shared.length >= 2) hits.push(`when ${shared.slice(0, 3).join(", ")} ranked close, the answer was ${g.target}`);
  });
  return hits.slice(0, 2);
}

/* ================= parsing ================= */
function parseRows(text) {
  const cleaned = text.replace(/^\s*\d+[.)]\s+/gm, "");
  const tokens = cleaned.toLowerCase().match(/[a-z][a-z'’-]*|\d{1,6}/g) || [];
  const pairs = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    const an = /^\d+$/.test(a);
    const bn = /^\d+$/.test(b);
    if (!an && bn) {
      pairs.push({ word: a, rank: parseInt(b, 10) });
      i++;
    } else if (an && !bn) {
      pairs.push({ word: b, rank: parseInt(a, 10) });
      i++;
    }
  }
  const seen = new Set();
  const out = [];
  pairs.forEach((p) => {
    if (p.word.length > 1 && p.rank > 0 && !seen.has(p.word)) {
      seen.add(p.word);
      out.push(p);
    }
  });
  return out;
}

const words = (s) => (s.toLowerCase().match(/[a-z][a-z'’-]*/g) || []).filter((w) => w.length > 1);

/* accepts 120, "120", "1,200", " 120 " */
function toRank(v) {
  const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(40000, n) : null;
}

/* ================= api ================= */
function extractJSON(text) {
  const t = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    /* fall through */
  }
  const m = t.match(/[{[][\s\S]*[}\]]/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch (e) {
      /* fall through */
    }
  }
  throw new Error(`reply wasn't JSON: ${t.slice(0, 70) || "(empty)"}`);
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const e = new Error("Aborted");
    e.name = "AbortError";
    throw e;
  }
}

async function callOnce(content, signal) {
  throwIfAborted(signal);
  let text;
  try {
    text = await window.claude.complete(content);
  } catch (e) {
    throw new Error("request failed");
  }
  throwIfAborted(signal);
  if (!text || !text.trim()) throw new Error("empty response");
  return extractJSON(text);
}

async function callClaude(content, signal, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await callOnce(content, signal);
    } catch (e) {
      if (e.name === "AbortError") throw e;
      last = e;
    }
  }
  throw last;
}

const why = (e) => String(e?.message || e || "unknown error").slice(0, 150);

/* ================= prompts ================= */
function evidence(guesses) {
  const s = [...guesses].sort((a, b) => a.rank - b.rank);
  const close = s.slice(0, 18);
  const far = s.slice(18);
  let t = close.map((g) => `${g.word}=${g.rank}`).join(", ");
  if (far.length) t += `\nalso tried and far off: ${far.map((g) => g.word).join(", ")}`;
  return t;
}

const RULES = `Contexto: a secret target word is fixed. Each guess gets a rank from a word2vec-style model. Rank 1 is the target. Low ranks mean semantically close; ranks in the thousands mean the wrong region entirely. Targets are ordinary lowercase words, usually nouns, sometimes verbs or adjectives. No proper nouns, no hyphens.`;
const JSON_ONLY = `Reply with JSON only — no prose, no markdown fences.`;
const SCALE = `The rank is a word's position in a similarity ordering of about 40000 English words against the target. Calibration: 2-40 near-synonym or immediate associate; 40-400 clearly same topic; 400-3000 loosely connected; 3000-12000 unrelated but same register; 12000+ nothing in common.`;

const ANGLES = [
  { id: "near", ask: `List 15 tight semantic neighbours of the best-ranked words — synonyms, near-synonyms, and words that co-occur with them constantly.` },
  { id: "guess", ask: `Ignore neighbourliness and answer directly: what 15 words could BE the target? Each must explain why the low ranks are low and the high ranks are high.` },
  { id: "split", ask: `The evidence probably supports two or three competing readings. Name them silently, then list 15 words that would score very differently depending on which reading is right.` },
];

/* ================= shared bits ================= */
const label = { ...data, color: C.soft, fontSize: 11, letterSpacing: "0.18em" };
const inputBase = {
  ...ui,
  fontSize: 17,
  color: C.ink,
  backgroundColor: C.card,
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: "12px 14px",
  outline: "none",
  minHeight: 48,
};
const solidBtn = { ...ui, fontSize: 16, color: C.card, backgroundColor: C.ink, minHeight: 48 };
const ghostBtn = { ...ui, fontSize: 16, color: C.ink, backgroundColor: C.card, border: `1.5px solid ${C.ink}`, minHeight: 48 };

function Ladder({ rows, onRemove, note }) {
  if (!rows.length) return null;
  return (
    <ul className="space-y-2">
      {[...rows]
        .sort((a, b) => a.rank - b.rank)
        .map((g) => {
          const color = heat(g.rank);
          const t = closeness(g.rank);
          return (
            <li key={g.word} className="flex items-center gap-3 rounded-xl pr-3" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
              <span style={{ backgroundColor: color, width: 6, alignSelf: "stretch", borderTopLeftRadius: 11, borderBottomLeftRadius: 11 }} />
              <div className="flex-1 py-3">
                <div style={{ color: C.ink, fontSize: 18 }}>{g.word}</div>
                {note && g.why && (
                  <div style={{ color: C.soft, fontSize: 12 }} className="mt-0.5">
                    {g.why}
                  </div>
                )}
                <div className="mt-1.5 h-1 w-full rounded" style={{ backgroundColor: C.paper }}>
                  <div className="h-1 rounded" style={{ width: `${Math.round(t * 100)}%`, backgroundColor: color }} />
                </div>
              </div>
              <span style={{ ...data, color, fontSize: 16 }}>{g.rank}</span>
              {onRemove && (
                <button onClick={() => onRemove(g.word)} aria-label={`Remove ${g.word}`} className="rounded-lg px-2" style={{ color: C.soft, fontSize: 20, minHeight: 44, minWidth: 36 }}>
                  ×
                </button>
              )}
            </li>
          );
        })}
    </ul>
  );
}

/* ================= app ================= */
export default function ContextoSolver() {
  const [tab, setTab] = useState("solve");
  const [mem, setMem] = useState(blankMemory());
  const [memReady, setMemReady] = useState(false);
  const [showMem, setShowMem] = useState(false);

  const [guesses, setGuesses] = useState([]);
  const [word, setWord] = useState("");
  const [rank, setRank] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const [scanned, setScanned] = useState([]);
  const [pool, setPool] = useState([]);
  const [leader, setLeader] = useState(null);
  const [picks, setPicks] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [elapsed, setElapsed] = useState(null);
  const [trainNote, setTrainNote] = useState(null);

  const [play, setPlay] = useState({ status: "idle", secret: null, level: "normal", rows: [], busy: false });
  const [playWord, setPlayWord] = useState("");

  const [mainWord, setMainWord] = useState("");
  const [others, setOthers] = useState("");
  const [compared, setCompared] = useState([]);
  const [comparing, setComparing] = useState(false);

  const [error, setError] = useState("");

  const rankRef = useRef(null);
  const wordRef = useRef(null);
  const abortRef = useRef(null);
  const seenRef = useRef(new Map());
  const trainedRef = useRef(null);

  useEffect(() => {
    loadMemory().then((m) => {
      setMem(m);
      setMemReady(true);
    });
  }, []);

  const sorted = [...guesses].sort((a, b) => a.rank - b.rank);
  const best = sorted[0];
  const solved = best && best.rank === 1;
  const busy = phase === "searching" || phase === "weighing";
  const trained = mem.steps > 0;

  function logGame(target, ladder, negatives) {
    const next = { ...mem, assoc: { ...mem.assoc }, targets: { ...mem.targets }, games: [...mem.games] };
    let deltas = null;
    if (negatives.length >= 3) {
      const examples = [
        { x: features(target, ladder, seenRef.current.get(target) || { votes: 1 }, mem), y: 1 },
        ...negatives.map(([w, ctx]) => ({ x: features(w, ladder, ctx, mem), y: 0 })),
      ];
      const after = sgd(examples, mem.weights);
      deltas = FEATURES.map((f) => ({ f, from: mem.weights[f], to: after[f] }));
      next.weights = after;
      next.steps = mem.steps + 1;
    }
    const close = ladder.slice(0, 8).map((g) => ({ word: g.word, w: closeness(g.rank) }));
    close.forEach((c) => {
      next.assoc[c.word] = { ...(next.assoc[c.word] || {}) };
      next.assoc[c.word][target] = Math.min(1, (next.assoc[c.word][target] || 0) + c.w);
    });
    next.games = [{ target, close, at: Date.now() }, ...next.games].slice(0, 60);
    next.targets[target] = (next.targets[target] || 0) + 1;
    setMem(next);
    saveMemory(next);
    return { target, links: close.length, deltas, examples: negatives.length + 1 };
  }

  useEffect(() => {
    if (!solved || !memReady) return;
    if (trainedRef.current === best.word) return;
    trainedRef.current = best.word;
    const ladder = sorted.filter((g) => g.rank > 1);
    const negatives = [...seenRef.current.entries()].filter(([w]) => w !== best.word).slice(0, 24);
    setTrainNote(logGame(best.word, ladder, negatives));
  }, [solved, memReady, best?.word]);

  /* ---- solve: manual entry ---- */
  function addGuess() {
    const w = word.trim().toLowerCase();
    const r = toRank(rank);
    if (!w) {
      setError("Type a word first.");
      wordRef.current?.focus();
      return;
    }
    if (!r) {
      setError("Rank is a whole number, 1 or higher.");
      rankRef.current?.focus();
      return;
    }
    if (guesses.some((g) => g.word === w)) {
      setError(`${w} is already on the ladder.`);
      return;
    }
    setError("");
    setGuesses([...guesses, { word: w, rank: r }]);
    setPicks((p) => p.filter((x) => x.word !== w));
    setPool((p) => p.filter((x) => x.word !== w));
    setWord("");
    setRank("");
    wordRef.current?.focus();
  }

  const removeGuess = (w) => setGuesses(guesses.filter((g) => g.word !== w));

  function stageRows(rows) {
    const tried = new Set(guesses.map((g) => g.word));
    const clean = rows.filter((r) => r.word && r.rank && !tried.has(r.word)).sort((a, b) => a.rank - b.rank);
    if (!clean.length) setError("Nothing to read yet — try one row per line, like: boat 42");
    setScanned(clean);
  }

  function acceptScan() {
    const tried = new Set(guesses.map((g) => g.word));
    setGuesses([...guesses, ...scanned.filter((r) => !tried.has(r.word))]);
    setScanned([]);
    setBulk("");
    setError("");
  }

  /* ---- solve: search ---- */
  async function run() {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    const t0 = performance.now();

    setError("");
    setPicks([]);
    setLeader(null);
    setPool([]);
    setElapsed(null);
    setPhase("searching");

    const ladder = [...guesses].sort((a, b) => a.rank - b.rank);
    const tried = new Set(guesses.map((g) => g.word));
    const lessons = ladder.length ? recallText(ladder, mem) : [];
    const ev = guesses.length
      ? `Guesses so far, closest first:\n${evidence(guesses)}${lessons.length ? `\n\nFrom puzzles already solved by this player: ${lessons.join("; ")}.` : ""}`
      : `No guesses yet.`;

    const results = await Promise.allSettled(
      ANGLES.map((a) =>
        callClaude(
          `${RULES}\n\n${ev}\n\n${
            guesses.length
              ? a.ask
              : `Give 15 opening probes spread across distinct semantic fields — body, nature, tools, emotion, money, motion, time, food, place, conflict, thought, material — so the first ranks triangulate fast.`
          }\n\n${JSON_ONLY}\n{"words":[{"word":"example","why":"four to six words"}]}`,
          ctl.signal
        )
      )
    );
    if (ctl.signal.aborted) return;

    const votes = new Map();
    results.forEach((r) => {
      if (r.status !== "fulfilled") return;
      (r.value.words || []).forEach((s) => {
        const w = String(s.word || "").toLowerCase().trim();
        if (!w || w.includes(" ") || tried.has(w)) return;
        const prev = votes.get(w);
        if (prev) prev.votes += 1;
        else votes.set(w, { word: w, why: s.why || "", votes: 1 });
      });
    });
    recall(ladder, mem, tried).forEach((r) => {
      const prev = votes.get(r.word);
      if (prev) {
        prev.votes += 1;
        prev.recalled = true;
      } else votes.set(r.word, r);
    });

    let candidates = [...votes.values()];
    if (!candidates.length) {
      setPhase("idle");
      const failed = results.find((r) => r.status === "rejected");
      setError(failed ? `Search failed — ${why(failed.reason)}` : "Nothing came back. Try again.");
      return;
    }
    candidates = rankLocally(candidates, ladder);
    setPool(candidates);
    candidates.forEach((c) => seenRef.current.set(c.word, { votes: c.votes, recalled: c.recalled }));

    if (!guesses.length) {
      setElapsed((performance.now() - t0) / 1000);
      setPhase("done");
      return;
    }

    setPhase("weighing");
    try {
      const parsed = await callClaude(
        `${RULES}\n\n${ev}\n\nA search produced these candidates. The number is how many independent lines of reasoning proposed it:\n${candidates
          .slice(0, 60)
          .map((c) => `${c.word}(${c.votes})`)
          .join(", ")}\n\nDecide which single word is most likely to BE the target, and how sure you are. Then choose 10 guesses: mark "answer" for ones that might be the target outright, "probe" for ones whose rank would most narrow the field. Prefer words that discriminate over words that merely feel close.\n\n${JSON_ONLY}\n{"leader":{"word":"x","confidence":55,"reason":"one short sentence"},"picks":[{"word":"x","kind":"answer","why":"four to six words"}]}`,
        ctl.signal
      );
      if (ctl.signal.aborted) return;

      const leadWord = String(parsed.leader?.word || "").toLowerCase().trim();
      const clean = rankLocally(
        (parsed.picks || [])
          .map((p) => {
            const w = String(p.word || "").toLowerCase().trim();
            return {
              word: w,
              kind: p.kind === "answer" ? "answer" : "probe",
              why: p.why || "",
              votes: votes.get(w)?.votes || 1,
              recalled: votes.get(w)?.recalled,
              leader: w === leadWord,
            };
          })
          .filter((p) => p.word && !tried.has(p.word)),
        ladder
      );
      setPicks(clean);
      clean.forEach((c) => seenRef.current.set(c.word, { votes: c.votes, kind: c.kind, leader: c.leader }));

      if (leadWord && !tried.has(leadWord)) {
        setLeader({
          word: leadWord,
          confidence: Math.max(0, Math.min(100, Number(parsed.leader.confidence) || 0)),
          reason: parsed.leader.reason || "",
        });
        seenRef.current.set(leadWord, { votes: votes.get(leadWord)?.votes || 1, kind: "answer", leader: true });
      }
      setElapsed((performance.now() - t0) / 1000);
      setPhase("done");
    } catch (e) {
      if (ctl.signal.aborted) return;
      setError(`Weighing failed — ${why(e)}. The candidates above still stand.`);
      setElapsed((performance.now() - t0) / 1000);
      setPhase("done");
    }
  }

  function rankLocally(items, ladder) {
    return items.map((it) => ({ ...it, p: score(features(it.word, ladder, it, mem), mem.weights) })).sort((a, b) => b.p - a.p);
  }

  function pick(w) {
    setWord(w);
    setError("");
    rankRef.current?.focus();
  }

  function newPuzzle() {
    abortRef.current?.abort();
    seenRef.current = new Map();
    trainedRef.current = null;
    setGuesses([]);
    setPicks([]);
    setPool([]);
    setLeader(null);
    setPhase("idle");
    setElapsed(null);
    setError("");
    setTrainNote(null);
    setScanned([]);
    setBulk("");
  }

  /* ================= play ================= */
  async function startGame() {
    setError("");
    setPlay((p) => ({ ...p, busy: true }));
    try {
      const avoid = Object.keys(mem.targets).slice(0, 40).join(", ");
      const parsed = await callClaude(
        `Pick one secret word for a Contexto-style guessing game. Difficulty ${play.level}: easy = a very common concrete noun; normal = a common noun, verb or adjective; hard = an everyday word that is harder to triangulate, such as an abstract noun or a verb.

Lowercase, singular, no proper nouns, no hyphens.${avoid ? ` Do not choose any of these: ${avoid}.` : ""}

${JSON_ONLY}
{"word":"x"}`
      );
      const secret = String(parsed.word || "").toLowerCase().trim();
      if (!secret) throw new Error("no word came back");
      setPlay({ status: "playing", secret, level: play.level, rows: [], busy: false });
      setPlayWord("");
    } catch (e) {
      setPlay((p) => ({ ...p, busy: false }));
      setError(`Couldn't start a game — ${why(e)}`);
    }
  }

  async function guessPlay() {
    const w = playWord.trim().toLowerCase();
    if (!w || w.includes(" ")) {
      setError("One word at a time.");
      return;
    }
    if (play.rows.some((r) => r.word === w)) {
      setError(`${w} is already on the ladder.`);
      return;
    }
    setError("");

    if (w === play.secret) {
      const rows = [...play.rows, { word: w, rank: 1 }];
      setPlay({ ...play, rows, status: "won" });
      setPlayWord("");
      if (memReady) logGame(w, rows.filter((r) => r.rank > 1), []);
      return;
    }

    setPlay((p) => ({ ...p, busy: true }));
    try {
      const known = [...play.rows].sort((a, b) => a.rank - b.rank).map((r) => `${r.word}=${r.rank}`).join(", ");
      const parsed = await callClaude(
        `Target word: "${play.secret}". Rank the guess "${w}" against it. ${SCALE}
${known ? `Ranks already given this game — stay consistent with them: ${known}.` : ""}
The guess is not the target, so the rank must be 2 or higher.

${JSON_ONLY}
{"rank":123}`
      );
      let r = toRank(parsed.rank);
      if (!r) throw new Error("no rank came back");
      r = Math.max(2, r);
      while (play.rows.some((x) => x.rank === r)) r += 1;
      setPlay((p) => ({ ...p, rows: [...p.rows, { word: w, rank: r }], busy: false }));
      setPlayWord("");
    } catch (e) {
      setPlay((p) => ({ ...p, busy: false }));
      setError(`Guess didn't land — ${why(e)}`);
    }
  }

  /* ================= compare ================= */
  async function compare() {
    const m = mainWord.trim().toLowerCase();
    const list = words(others).filter((w) => w !== m);
    if (!m) {
      setError("Give a main word first.");
      return;
    }
    if (!list.length) {
      setError("Add at least one word to compare.");
      return;
    }
    setError("");
    setComparing(true);
    setCompared([]);
    try {
      const parsed = await callClaude(
        `Main word: "${m}". For each word below, give the Contexto rank it would get against that main word. ${SCALE}
Rank them consistently against each other — the closest word gets the lowest number.

Words: ${list.join(", ")}

${JSON_ONLY}
{"rows":[{"word":"x","rank":120,"why":"five to eight words on the link"}]}`
      );
      const raw = Array.isArray(parsed) ? parsed : parsed.rows || parsed.words || [];
      const rows = raw
        .map((r) => ({ word: String(r.word || "").toLowerCase().trim(), rank: toRank(r.rank), why: r.why || r.reason || "" }))
        .filter((r) => r.word && r.rank);
      if (!rows.length) throw new Error("no usable rows in the reply");
      setCompared(rows);
    } catch (e) {
      setError(`Couldn't rank those — ${why(e)}`);
    }
    setComparing(false);
  }

  /* ================= render ================= */
  const chip = (item, accent) => (
    <button key={item.word} onClick={() => pick(item.word)} className="rounded-xl px-4 py-3 text-left" style={{ backgroundColor: C.card, border: `1px solid ${accent || C.line}`, minHeight: 48, minWidth: 132 }}>
      <div className="flex items-baseline gap-2">
        <span style={{ color: C.ink, fontSize: 17 }}>{item.word}</span>
        {item.votes > 1 && <span style={{ ...data, color: C.soft, fontSize: 11 }}>×{item.votes}</span>}
        {trained && item.p != null && <span style={{ ...data, color: C.soft, fontSize: 11 }}>{Math.round(item.p * 100)}</span>}
      </div>
      <div style={{ color: C.soft, fontSize: 12 }} className="mt-0.5">
        {item.recalled ? "recalled from memory" : item.why}
      </div>
    </button>
  );

  const answers = picks.filter((p) => p.kind === "answer");
  const probes = picks.filter((p) => p.kind === "probe");
  const showPool = phase === "searching" || (phase !== "idle" && !picks.length);
  const links = Object.values(mem.assoc).reduce((n, o) => n + Object.keys(o).length, 0);
  const bulkRows = parseRows(bulk);
  const playBest = [...play.rows].sort((a, b) => a.rank - b.rank)[0];

  const blurb = {
    solve: "Feed in the ranks your game gave you. Three lines of reasoning run at once, and a scorer you've trained decides which of their answers to trust.",
    play: "A secret word is held here. Guess, and every guess comes back with a rank.",
    compare: "Give a main word and any number of others. See where each one lands against it.",
  }[tab];

  const errorLine = error ? (
    <p style={{ color: HOT, fontSize: 14, lineHeight: 1.45 }} className="mb-4">
      {error}
    </p>
  ) : null;

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: C.paper, ...ui }}>
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        <header className="mb-6">
          <div style={label} className="uppercase">
            {mem.games.length} solved · {links} links
          </div>
          <h1 style={{ ...display, color: C.ink, fontSize: 40, lineHeight: 1.05 }} className="mt-1">
            Contexto
          </h1>
          <p style={{ color: C.soft, fontSize: 15 }} className="mt-2">
            {blurb}
          </p>
        </header>

        <div className="mb-6 flex gap-6" style={{ borderBottom: `1px solid ${C.line}` }}>
          {[
            ["solve", "solver"],
            ["play", "play"],
            ["compare", "compare"],
          ].map(([id, name]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setError("");
              }}
              className="uppercase"
              style={{ ...label, color: tab === id ? C.ink : C.soft, minHeight: 44, borderBottom: tab === id ? `2px solid ${C.ink}` : "2px solid transparent" }}
            >
              {name}
            </button>
          ))}
        </div>

        {/* ============ SOLVER ============ */}
        {tab === "solve" && (
          <>
            <section className="mb-6">
              {sorted.length === 0 ? (
                <div className="rounded-xl px-5 py-6" style={{ backgroundColor: C.card, border: `1px dashed ${C.line}`, color: C.soft }}>
                  <p style={{ fontSize: 15 }}>
                    Start with something broad — <em style={display}>water</em>, <em style={display}>money</em>,{" "}
                    <em style={display}>city</em>. Any rank you get is information.
                  </p>
                </div>
              ) : (
                <Ladder rows={sorted} onRemove={removeGuess} />
              )}
            </section>

            {trainNote && (
              <section className="mb-6 rounded-xl px-5 py-5" style={{ backgroundColor: C.card, border: `1.5px solid ${HOT}` }}>
                <div style={label} className="uppercase">
                  trained on {trainNote.target}
                </div>
                {trainNote.deltas ? (
                  <>
                    <p style={{ color: C.soft, fontSize: 14 }} className="mt-2">
                      {trainNote.examples} examples, {trainNote.links} new links. The scorer moved:
                    </p>
                    <ul className="mt-3 space-y-1.5">
                      {trainNote.deltas
                        .filter((d) => Math.abs(d.to - d.from) > 0.001)
                        .map((d) => (
                          <li key={d.f} className="flex items-center gap-3">
                            <span style={{ ...data, color: C.soft, fontSize: 12, width: 58 }}>{d.f}</span>
                            <span style={{ ...data, color: C.ink, fontSize: 12 }}>
                              {d.from.toFixed(2)} → {d.to.toFixed(2)}
                            </span>
                            <span style={{ ...data, color: d.to > d.from ? HOT : COLD, fontSize: 12 }}>{d.to > d.from ? "▲" : "▼"}</span>
                          </li>
                        ))}
                    </ul>
                  </>
                ) : (
                  <p style={{ color: C.soft, fontSize: 14 }} className="mt-2">
                    Logged {trainNote.links} links. Too few candidates on screen to train the scorer this round.
                  </p>
                )}
                <button onClick={newPuzzle} className="mt-4 rounded-xl px-5" style={solidBtn}>
                  New puzzle
                </button>
              </section>
            )}

            <section className="mb-3 flex gap-2">
              <input ref={wordRef} value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rankRef.current?.focus()} placeholder="word" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="flex-1" style={inputBase} />
              <input ref={rankRef} value={rank} onChange={(e) => setRank(e.target.value.replace(/[^0-9]/g, ""))} onKeyDown={(e) => e.key === "Enter" && addGuess()} placeholder="rank" inputMode="numeric" className="w-24" style={{ ...inputBase, ...data }} />
              <button onClick={addGuess} className="rounded-xl px-5" style={solidBtn}>
                Add
              </button>
            </section>

            <button onClick={() => setShowBulk(!showBulk)} className="mb-4 uppercase" style={{ ...label, minHeight: 44 }}>
              {showBulk ? "− " : "+ "}paste several rows
            </button>

            {showBulk && (
              <div className="mb-4">
                <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"boat 42\nharbor 118\nsail 7"} rows={4} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="w-full" style={{ ...inputBase, ...data, fontSize: 15, lineHeight: 1.6, resize: "vertical" }} />
                <button onClick={() => stageRows(bulkRows)} disabled={!bulk.trim()} className="mt-2 w-full rounded-xl px-5" style={{ ...ghostBtn, opacity: bulk.trim() ? 1 : 0.45 }}>
                  {bulkRows.length ? `Read ${bulkRows.length} rows` : "Read rows"}
                </button>
                {scanned.length > 0 && (
                  <div className="mt-4">
                    <div style={label} className="mb-3 uppercase">
                      found {scanned.length} rows
                    </div>
                    <Ladder rows={scanned} onRemove={(w) => setScanned(scanned.filter((x) => x.word !== w))} />
                    <button onClick={acceptScan} className="mt-3 w-full rounded-xl px-5" style={solidBtn}>
                      Add {scanned.length} to the ladder
                    </button>
                  </div>
                )}
              </div>
            )}

            {errorLine}

            <button onClick={run} disabled={busy} className="w-full rounded-xl px-5" style={{ ...ghostBtn, minHeight: 52, opacity: busy ? 0.55 : 1 }}>
              {phase === "searching" ? "Searching three angles…" : phase === "weighing" ? `Weighing ${pool.length} candidates…` : guesses.length ? "Search for the word" : "Suggest opening words"}
            </button>

            {leader && (
              <section className="mt-7 rounded-xl px-5 py-5" style={{ backgroundColor: C.card, border: `1.5px solid ${leader.confidence >= 60 ? HOT : C.line}` }}>
                <div style={label} className="uppercase">
                  {leader.confidence >= 60 ? "best answer" : "leading theory"}
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span style={{ ...display, color: C.ink, fontSize: 32 }}>{leader.word}</span>
                  <span style={{ ...data, color: C.soft, fontSize: 13 }}>{leader.confidence}%</span>
                </div>
                <div className="mt-2 h-1 w-full rounded" style={{ backgroundColor: C.paper }}>
                  <div className="h-1 rounded" style={{ width: `${leader.confidence}%`, backgroundColor: leader.confidence >= 60 ? HOT : C.soft }} />
                </div>
                {leader.reason && (
                  <p style={{ color: C.soft, fontSize: 14 }} className="mt-3">
                    {leader.reason}
                  </p>
                )}
                <button onClick={() => pick(leader.word)} className="mt-4 rounded-xl px-5" style={solidBtn}>
                  Load it
                </button>
              </section>
            )}

            {showPool && pool.length > 0 && (
              <section className="mt-7">
                <div style={label} className="mb-3 uppercase">
                  {pool.length} candidates
                </div>
                <div className="flex flex-wrap gap-2">{pool.slice(0, 18).map((p) => chip(p))}</div>
              </section>
            )}

            {answers.length > 0 && (
              <section className="mt-7">
                <div style={label} className="mb-3 uppercase">
                  could be the word
                </div>
                <div className="flex flex-wrap gap-2">{answers.map((p) => chip(p, HOT))}</div>
              </section>
            )}

            {probes.length > 0 && (
              <section className="mt-6">
                <div style={label} className="mb-3 uppercase">
                  probes to narrow it
                </div>
                <div className="flex flex-wrap gap-2">{probes.map((p) => chip(p))}</div>
              </section>
            )}

            {picks.length > 0 && (
              <p style={{ color: C.soft, fontSize: 13 }} className="mt-4">
                Tap one to load it, then type the rank the game gave you.
              </p>
            )}
          </>
        )}

        {/* ============ PLAY ============ */}
        {tab === "play" && (
          <>
            {play.status === "idle" && (
              <section>
                <div style={label} className="mb-3 uppercase">
                  difficulty
                </div>
                <div className="flex gap-2">
                  {["easy", "normal", "hard"].map((lv) => (
                    <button key={lv} onClick={() => setPlay((p) => ({ ...p, level: lv }))} className="flex-1 rounded-xl px-4" style={play.level === lv ? { ...solidBtn } : { ...ghostBtn, borderColor: C.line, color: C.soft }}>
                      {lv}
                    </button>
                  ))}
                </div>
                <button onClick={startGame} disabled={play.busy} className="mt-4 w-full rounded-xl px-5" style={{ ...solidBtn, minHeight: 52, opacity: play.busy ? 0.55 : 1 }}>
                  {play.busy ? "Thinking of a word…" : "Start a game"}
                </button>
                {errorLine}
                <p style={{ color: C.soft, fontSize: 13 }} className="mt-3">
                  Ranks are judged fresh each guess and stay consistent with the ones already on the board.
                </p>
              </section>
            )}

            {play.status !== "idle" && (
              <>
                <div className="mb-4 flex items-baseline gap-4">
                  <span style={label} className="uppercase">
                    {play.rows.length} guesses
                  </span>
                  {playBest && <span style={{ ...data, color: heat(playBest.rank), fontSize: 12 }}>best {playBest.rank}</span>}
                </div>

                {(play.status === "won" || play.status === "revealed") && (
                  <section className="mb-5 rounded-xl px-5 py-5" style={{ backgroundColor: C.card, border: `1.5px solid ${play.status === "won" ? HOT : C.line}` }}>
                    <div style={label} className="uppercase">
                      {play.status === "won" ? `solved in ${play.rows.length}` : "the word was"}
                    </div>
                    <div style={{ ...display, color: C.ink, fontSize: 32 }} className="mt-1">
                      {play.secret}
                    </div>
                    <button onClick={() => setPlay({ status: "idle", secret: null, level: play.level, rows: [], busy: false })} className="mt-4 rounded-xl px-5" style={solidBtn}>
                      Play again
                    </button>
                  </section>
                )}

                {play.status === "playing" && (
                  <section className="mb-4 flex gap-2">
                    <input value={playWord} onChange={(e) => setPlayWord(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !play.busy && guessPlay()} placeholder="your guess" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="flex-1" style={inputBase} />
                    <button onClick={guessPlay} disabled={play.busy} className="rounded-xl px-5" style={{ ...solidBtn, opacity: play.busy ? 0.55 : 1 }}>
                      {play.busy ? "…" : "Guess"}
                    </button>
                  </section>
                )}

                {errorLine}

                <Ladder rows={play.rows} />

                {play.status === "playing" && (
                  <button onClick={() => setPlay((p) => ({ ...p, status: "revealed" }))} className="mt-6 rounded-lg uppercase" style={{ ...label, minHeight: 44 }}>
                    give up
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* ============ COMPARE ============ */}
        {tab === "compare" && (
          <>
            <section className="mb-4">
              <div style={label} className="mb-2 uppercase">
                main word
              </div>
              <input value={mainWord} onChange={(e) => setMainWord(e.target.value)} placeholder="boat" autoCapitalize="none" autoCorrect="off" spellCheck={false} className="w-full" style={inputBase} />

              <div style={label} className="mb-2 mt-4 uppercase">
                words to place against it
              </div>
              <textarea value={others} onChange={(e) => setOthers(e.target.value)} placeholder="sail, harbor, ocean, tractor" rows={3} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="w-full" style={{ ...inputBase, resize: "vertical" }} />

              <button onClick={compare} disabled={comparing} className="mt-3 w-full rounded-xl px-5" style={{ ...solidBtn, minHeight: 52, opacity: comparing ? 0.55 : 1 }}>
                {comparing ? "Placing them…" : "Rank them"}
              </button>
            </section>

            {errorLine}

            {compared.length > 0 && (
              <section>
                <div style={label} className="mb-3 uppercase">
                  against {mainWord.trim().toLowerCase()}
                </div>
                <Ladder rows={compared} note />
                <p style={{ color: C.soft, fontSize: 13 }} className="mt-4">
                  Estimated ranks, not the game's own numbers — useful for judging which of two guesses is worth
                  spending a turn on.
                </p>
              </section>
            )}
          </>
        )}

        {/* memory */}
        <section className="mt-10 rounded-xl px-5 py-4" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
          <button onClick={() => setShowMem(!showMem)} className="flex w-full items-center justify-between" style={{ minHeight: 44 }}>
            <span style={label} className="uppercase">
              memory · {mem.games.length} games · {links} links · {mem.steps} training runs
            </span>
            <span style={{ color: C.soft, fontSize: 18 }}>{showMem ? "−" : "+"}</span>
          </button>

          {showMem && (
            <div className="mt-4">
              <p style={{ color: C.soft, fontSize: 13 }}>
                {trained ? "What the scorer has learned to trust when ordering candidates." : "Untrained — these are the starting weights. Solve a puzzle to move them."}
              </p>
              <ul className="mt-3 space-y-2">
                {FEATURES.map((f) => {
                  const w = mem.weights[f] || 0;
                  return (
                    <li key={f} className="flex items-center gap-3">
                      <span style={{ ...data, color: C.soft, fontSize: 12, width: 58 }}>{f}</span>
                      <span className="relative h-1.5 flex-1 rounded" style={{ backgroundColor: C.paper }}>
                        <span className="absolute h-1.5 rounded" style={{ left: w >= 0 ? "50%" : `${50 - (Math.abs(w) / 3) * 50}%`, width: `${(Math.abs(w) / 3) * 50}%`, backgroundColor: w >= 0 ? HOT : COLD }} />
                      </span>
                      <span style={{ ...data, color: C.ink, fontSize: 12, width: 44 }} className="text-right">
                        {w.toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {mem.games.length > 0 && (
                <p style={{ color: C.soft, fontSize: 13 }} className="mt-4">
                  Solved: {mem.games.slice(0, 12).map((g) => g.target).join(", ")}
                </p>
              )}
              <button
                onClick={async () => {
                  const fresh = blankMemory();
                  setMem(fresh);
                  await saveMemory(fresh);
                  setTrainNote(null);
                }}
                className="mt-4 rounded-lg"
                style={{ ...data, color: HOT, fontSize: 12, letterSpacing: "0.1em", minHeight: 44 }}
              >
                FORGET EVERYTHING
              </button>
            </div>
          )}
        </section>

        {tab === "solve" && (
          <div className="mt-6 flex items-center gap-5">
            {guesses.length > 0 && (
              <button onClick={newPuzzle} className="rounded-lg" style={{ ...data, color: C.soft, fontSize: 12, letterSpacing: "0.1em", minHeight: 44 }}>
                NEW PUZZLE
              </button>
            )}
            {elapsed != null && <span style={{ ...data, color: C.soft, fontSize: 12 }}>{elapsed.toFixed(1)}s</span>}
          </div>
        )}
      </div>
    </div>
  );
}
