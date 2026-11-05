/* ============ EDIT HERE ============ */

/* Opening sequence. Each line is typed out on screen, one after another. */
const INTRO_LINES = {
  dots: ". . .",
  arrived: "You have arrived.",
  connecting: "Connecting. .",
  connected: "Connected."
};

/* How long "Connecting. ." stays up, in milliseconds (4000 to 7000 feels right).
   The closed eye slowly fades in during this time, then opens when it ends,
   and "Connected." is typed at that same moment. */
const CONNECT_MS = 5500;

/* Background gif, shown behind the disclaimer and the survey.
   Put your gif in the repo next to index.html, then type its file name here, e.g. "bg.gif".
   Leave it blank for a plain black background.
   BACKGROUND_DIM darkens it so the text stays readable: 0 = not at all, 1 = fully black. */
const BACKGROUND_GIF = "";
const BACKGROUND_DIM = 0.6;

/* The disclaimer screen. */
const DISCLAIMER = "Before you continue, understand that this may involve the giving of personal info on your end. Nothing serious though.";
const DISCLAIMER_NOTE = "Each answer is read by an AI, which replies with one short sentence.";

/* Survey questions. All placeholders for now.
   type "text"    = open-ended answer
   type "ratings" = one slider (1 to 10) per item
   For ratings, the item names are used as keys: Speed -> speed, Strength -> strength, ...
   Those match the stat fields in the archive's character files. */
const PCOL = ["#ff5d5d","#ff9a3c","#ffd23f","#2ee6c5","#5aa9ff","#b57cff"];
const MCOL = ["#a6ff3c","#ff4fd8","#4dffb0","#ff8f6b","#8f9bff","#e8e86a"];

const QUESTIONS = [
  { id:"q1", type:"text", prompt:"Placeholder question one. What should we call you?" },
  { id:"physical", type:"ratings", prompt:"Rate your own physical abilities, from 1 to 10.",
    items:["Speed","Strength","Durability","Height","Stamina","Precision"], colors:PCOL },
  { id:"mental", type:"ratings", prompt:"Rate your own mental abilities, from 1 to 10.",
    items:["Cognition","Social","Adaptability","Creativity","Composure","Perception"], colors:MCOL },
  { id:"q4", type:"text", prompt:"Placeholder question four. Describe yourself in a few words." },
  { id:"q5", type:"text", prompt:"Placeholder question five. What is something you are proud of?" }
];

/* Wiring (leave blank until you have them):
   WORKER_URL  = your Cloudflare Worker address. Blank = placeholder compliments.
   SUBMIT_URL  = where finished surveys get sent. Blank = nothing is sent anywhere.
   ARCHIVE_URL = link to the archive, shown on the last screen. Blank = no link. */
const WORKER_URL  = "https://square-rice-e3b0.cryogenix20.workers.dev";
const SUBMIT_URL  = "https://square-rice-e3b0.cryogenix20.workers.dev/submit";
const ARCHIVE_URL = "https://suliaced.github.io/archive";

const MAX_CHARS = 400;
const FALLBACK = "Thank you for sharing that.";
const PLACEHOLDER_COMPLIMENTS = [
  "Placeholder compliment: that was a thoughtful answer.",
  "Placeholder compliment: that says a lot in a few words.",
  "Placeholder compliment: that was honest and well put."
];

/* =================================== */

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function show(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === id));
  window.scrollTo(0, 0);
}

function fade(el, ms){
  if (!el || reduced) return;
  el.animate([{opacity:0},{opacity:1}], {duration:ms || 700, easing:"ease"});
}

/* ---------- background gif ---------- */
function setupBackground(){
  if (!BACKGROUND_GIF) return;
  const bg = $("bg");
  bg.style.backgroundImage = 'url("' + BACKGROUND_GIF + '")';
  bg.style.setProperty("--dim-level", BACKGROUND_DIM);
  new Image().src = BACKGROUND_GIF;   /* start loading it now so it doesn't pop in late */
}
function showBackground(){
  if (BACKGROUND_GIF) $("bg").classList.add("on");
}
setupBackground();

/* ---------- 1. intro ---------- */
/* Pressing Alt during the intro skips straight to the disclaimer. */
const SKIP_KEY = "Alt";
const SKIP = Symbol("skip");
let introSkipped = false, introDone = false, introWake = null;

/* Waits, but wakes early (and stops the whole sequence) if the intro is skipped. */
async function pause(ms){
  if (introSkipped) throw SKIP;
  await new Promise(r => { introWake = r; setTimeout(r, ms); });
  if (introSkipped) throw SKIP;
}

function skipIntro(){
  if (introDone || introSkipped) return;
  introSkipped = true;
  if (introWake) introWake();
}

/* Both keydown and keyup are blocked so the browser doesn't pop open its menu bar on Alt. */
["keydown", "keyup"].forEach(type => {
  document.addEventListener(type, ev => {
    if (ev.key !== SKIP_KEY || introDone) return;
    ev.preventDefault();
    if (type === "keydown") skipIntro();
  });
});

/* Types one line a character at a time. perChar = average milliseconds per character. */
async function typeLine(text, perChar){
  const out = $("msgText");
  $("msgGhost").textContent = text;     /* invisible full copy, keeps the line centered while typing */
  $("introSr").textContent = text;      /* screen readers get the whole line at once */
  out.textContent = "";
  if (reduced){ out.textContent = text; return; }
  for (const ch of text){
    out.textContent += ch;
    await pause(perChar * (0.65 + Math.random() * 0.7));
  }
}

function clearLine(){
  $("msgText").textContent = "";
  $("msgGhost").textContent = "";
}

async function playIntro(){
  const eye = $("eye");
  const connectMs = reduced ? 2500 : CONNECT_MS;

  try {
    await pause(1000);

    await typeLine(INTRO_LINES.dots, 260);
    await pause(900);
    clearLine();
    await pause(350);

    await typeLine(INTRO_LINES.arrived, 85);
    await pause(1100);
    clearLine();
    await pause(350);

    /* Connecting: the closed eye slowly fades in while this line sits on screen. */
    const t0 = performance.now();
    if (reduced) eye.style.opacity = 1;
    else eye.animate([{opacity:0},{opacity:1}], {duration:connectMs, easing:"ease-in", fill:"forwards"});
    await typeLine(INTRO_LINES.connecting, 85);
    await pause(Math.max(0, connectMs - (performance.now() - t0)));

    /* The eye opens on the same second "Connected." appears. */
    eye.classList.add("open");
    clearLine();
    await typeLine(INTRO_LINES.connected, 70);
    await pause(2200);
  } catch (e) {
    if (e !== SKIP) throw e;
  }

  await endIntro();
}

async function endIntro(){
  const wasSkipped = introSkipped;
  introDone = true;
  if (!wasSkipped && !reduced){
    await $("intro").animate([{opacity:1},{opacity:0}], {duration:700, easing:"ease", fill:"forwards"}).finished;
  }
  $("disclaimerText").textContent = DISCLAIMER;
  $("disclaimerNote").textContent = DISCLAIMER_NOTE;
  show("disclaimer");
  showBackground();
  $("agree").focus();
}

/* ---------- 3. survey ---------- */
const answers = {};
let idx = 0, busy = false;

function renderQuestion(){
  const q = QUESTIONS[idx];
  busy = false;
  $("progress").textContent = (idx + 1) + " / " + QUESTIONS.length;
  $("prompt").textContent = q.prompt;
  $("hint").textContent = "";
  $("reply").hidden = true;
  $("reply").textContent = "";
  $("next").hidden = true;
  $("go").hidden = false;

  const area = $("answerArea");
  area.innerHTML = "";

  if (q.type === "text"){
    const t = document.createElement("textarea");
    t.className = "field";
    t.id = "answerField";
    t.maxLength = MAX_CHARS;
    t.rows = 3;
    t.setAttribute("aria-label", "Your answer");
    t.addEventListener("keydown", ev => {
      if (ev.key === "Enter" && !ev.shiftKey){ ev.preventDefault(); submitAnswer(); }
    });
    area.appendChild(t);
  } else {
    q.items.forEach((name, i) => {
      const key = name.toLowerCase();
      const row = document.createElement("div");
      row.className = "rate";
      row.style.setProperty("--c", q.colors[i]);
      const label = document.createElement("label");
      label.htmlFor = "r-" + key;
      label.textContent = name;
      const input = document.createElement("input");
      input.type = "range"; input.min = 1; input.max = 10; input.step = 1; input.value = 5;
      input.id = "r-" + key; input.dataset.key = key;
      const out = document.createElement("output");
      out.htmlFor = input.id;
      out.textContent = input.value;
      input.addEventListener("input", () => { out.textContent = input.value; });
      row.append(label, input, out);
      area.appendChild(row);
    });
  }

  fade($("qblock"), 700);
  const first = area.querySelector("textarea, input");
  if (first) first.focus();
}

function readAnswer(q){
  if (q.type === "text"){
    const v = $("answerField").value.trim();
    return v ? { value: v, summary: v } : null;
  }
  const value = {};
  const parts = [];
  document.querySelectorAll("#answerArea input[type=range]").forEach(inp => {
    value[inp.dataset.key] = Number(inp.value);
    parts.push(inp.dataset.key + " " + inp.value);
  });
  return { value, summary: "My self-ratings out of 10: " + parts.join(", ") + "." };
}

function lockInputs(){
  document.querySelectorAll("#answerArea textarea, #answerArea input").forEach(el => { el.disabled = true; });
}

async function submitAnswer(){
  if (busy) return;
  const q = QUESTIONS[idx];
  const a = readAnswer(q);
  if (!a){ $("hint").textContent = "type something first."; return; }

  busy = true;
  answers[q.id] = a.value;
  lockInputs();
  $("go").hidden = true;
  $("hint").textContent = "";

  const reply = $("reply");
  reply.hidden = false;
  let dots = 0;
  reply.textContent = "";
  const dotTimer = setInterval(() => { dots = (dots + 1) % 4; reply.textContent = ".".repeat(dots); }, 300);

  const line = await getCompliment(a.summary);

  clearInterval(dotTimer);
  reply.textContent = line;
  fade(reply, 900);

  const last = idx === QUESTIONS.length - 1;
  $("next").textContent = last ? "Finish" : "Continue";
  $("next").hidden = false;
  $("next").focus();
}

/* One sentence from the AI. Falls back to a plain line if anything goes wrong. */
async function getCompliment(text){
  if (!WORKER_URL){
    await sleep(900);
    return PLACEHOLDER_COMPLIMENTS[Math.floor(Math.random() * PLACEHOLDER_COMPLIMENTS.length)];
  }
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: text }),
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error("bad response");
    const j = await r.json();
    return String(j.compliment || "").trim() || FALLBACK;
  } catch {
    return FALLBACK;
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------- 4. finish ---------- */
async function finish(){
  show("end");
  const end = $("endText");
  end.textContent = "Thank you.";
  if (!reduced){
    end.animate([{opacity:0, transform:"scale(.94)"},{opacity:1, transform:"scale(1)"}],
      {duration:1600, easing:"ease", fill:"forwards"});
  } else {
    end.style.opacity = 1;
  }
  if (ARCHIVE_URL){
    $("archiveLink").href = ARCHIVE_URL;
    $("endLink").hidden = false;
  }

  const prompts = {};
  QUESTIONS.forEach(q => { if (q.type === "text") prompts[q.id] = q.prompt; });
  const payload = { submittedAt: new Date().toISOString(), answers, prompts };
  if (!SUBMIT_URL){
    console.info("Survey finished (not sent anywhere, SUBMIT_URL is blank):", payload);
    return;
  }
  try {
    await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch (err) {
    console.warn("Could not send the survey.", err);
  }
}

/* ---------- events ---------- */
$("agree").addEventListener("click", () => { show("survey"); renderQuestion(); });
$("go").addEventListener("click", submitAnswer);
$("next").addEventListener("click", () => {
  idx++;
  if (idx >= QUESTIONS.length) finish(); else renderQuestion();
});

playIntro();
