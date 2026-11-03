/* ============ EDIT HERE ============ */

/* Opening messages. Each one fades in, then grows and fades out. */
const MESSAGES = [
  "Hello.",
  "This is the survey.",
  "Loading disclaimer..."
];

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
const WORKER_URL  = "";
const SUBMIT_URL  = "";
const ARCHIVE_URL = "";

const MAX_CHARS = 400;
const MSG_MS = 4200;           /* how long each opening message lasts, in milliseconds */
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

/* ---------- 1. intro ---------- */
async function playIntro(){
  const el = $("msg");
  const frames = reduced
    ? [{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.8},{opacity:0}]
    : [
        {opacity:0, transform:"scale(.94)"},
        {opacity:1, transform:"scale(1)",    offset:.26},
        {opacity:1, transform:"scale(1.04)", offset:.62},
        {opacity:0, transform:"scale(1.7)"}
      ];
  await sleep(1200);
  for (const text of MESSAGES){
    el.textContent = text;
    await el.animate(frames, {duration: reduced ? 2200 : MSG_MS, easing:"ease-in-out", fill:"forwards"}).finished;
  }
  el.textContent = "";
  $("disclaimerText").textContent = DISCLAIMER;
  $("disclaimerNote").textContent = DISCLAIMER_NOTE;
  show("disclaimer");
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

  const payload = { submittedAt: new Date().toISOString(), answers };
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
