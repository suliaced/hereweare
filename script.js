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
const BACKGROUND_GIF = "bg/stars";
const BACKGROUND_DIM = 0.7;

/* Music. Two tracks. It starts at the same moment the background gif begins to fade in.
   SONG_FIRST plays once, all the way through. The moment it ends, SONG_LOOP starts
   and repeats until the survey is over, then fades out.
   Put your audio files in the repo next to index.html, then type their file names here, e.g. "intro.mp3".
   Leave both blank for no music. If only one is filled in, that one is used
   (SONG_FIRST alone plays once and stops; SONG_LOOP alone loops from the start).
   Note: browsers block sound until the visitor has clicked or pressed a key on the page.
   If that hasn't happened yet, the music starts on their first click (the Agree button) instead. */
const SONG_FIRST = "anotherme.wav";
const SONG_LOOP = "anothermeshort.wav";
const SONG_VOLUME = 0.6;          /* 0 = silent, 1 = full volume */
const SONG_FADE_MS = 3000;        /* how long the first track takes to fade in */
const SONG_END_FADE_MS = 3000;    /* how long the music takes to fade out when the survey is over */

/* The change after "Connected.", in milliseconds:
   the intro text and eye fade out while the background and song fade in,
   then the disclaimer (and after it, the survey) fades in. */
const INTRO_FADE_MS = 1400;       /* intro text and eye fading out */
const BACKGROUND_FADE_MS = 3000;  /* background gif fading in */
const SURVEY_FADE_MS = 1800;      /* disclaimer screen fading in */

/* Survey timing, in milliseconds.
   Each question types itself in, then the answer box or sliders fade in below it.
   After you answer, the question disappears and the AI's reply types in on its own,
   stays up for a moment, disappears, and the next question starts after a short break. */
const PROMPT_TYPE_MS = 45;        /* average time per character when a question types in */
const PROMPT_TO_INPUT_MS = 350;   /* pause between the question finishing and the answer box appearing */
const REPLY_TYPE_MS = 55;         /* average time per character when the AI reply types in */
const REPLY_HOLD_MS = 2600;       /* how long the finished reply stays on screen */
const NEXT_PAUSE_MS = 500;        /* break between the reply disappearing and the next question */

/* The disclaimer screen. */
const DISCLAIMER = "Before you continue, understand that this may involve the giving of personal info on your end.";
const DISCLAIMER_NOTE = "Be truthful";

/* Survey questions. All placeholders for now.
   type "text"    = open-ended answer
   type "ratings" = one slider (1 to 10) per item
   For ratings, the item names are used as keys: Speed -> speed, Strength -> strength, ...
   Those match the stat fields in the archive's character files. */
const PCOL = ["#ff5d5d","#ff9a3c","#ffd23f","#2ee6c5","#5aa9ff","#b57cff"];
const MCOL = ["#a6ff3c","#ff4fd8","#4dffb0","#ff8f6b","#8f9bff","#e8e86a"];

const QUESTIONS = [
  { id:"q1", type:"text", prompt:"What should we call you?" },
  { id:"physical", type:"ratings", prompt:"What is your physicality like?",
    items:["Speed","Strength","Durability","Height","Stamina","Precision"], colors:PCOL },
  { id:"mental", type:"ratings", prompt:"What is your mind like?",
    items:["Cognition","Social","Adaptability","Creativity","Composure","Perception"], colors:MCOL },
  { id:"q4", type:"text", prompt:"Tell us something about yourself." },
  { id:"q5", type:"text", prompt:"What is something you are proud of. .?" }
  { id:"q6", type:"text", prompt:"What is one of your fears?" }
  { id:"q7", type:"text", prompt:"Do you believe in free will?" }
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
function startBackground(){
  if (!BACKGROUND_GIF) return;
  const bg = $("bg");
  bg.style.setProperty("--bg-fade", BACKGROUND_FADE_MS + "ms");
  bg.classList.add("on");
}
setupBackground();

/* ---------- song ---------- */
let songWanted = false, songStopped = false, songFadeTimer = null;
let songNow = null;     /* whichever track is the current one */

function makeTrack(src, loop){
  const a = new Audio(src);
  a.loop = loop;
  a.preload = "auto";   /* both tracks load up front so the second can start the instant the first ends */
  a.volume = 0;
  return a;
}
const songFirst = SONG_FIRST ? makeTrack(SONG_FIRST, false) : null;
const songLoop  = SONG_LOOP  ? makeTrack(SONG_LOOP, true)   : null;

/* When the first track is fully over, the looping track begins right away. */
if (songFirst && songLoop){
  songFirst.addEventListener("ended", () => {
    if (songStopped) return;
    songNow = songLoop;
    songLoop.volume = SONG_VOLUME;
    songLoop.play().catch(() => {});
  });
}

function fadeSongIn(track){
  clearInterval(songFadeTimer);
  if (reduced){ track.volume = SONG_VOLUME; return; }
  const t0 = performance.now();
  songFadeTimer = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / SONG_FADE_MS);
    track.volume = SONG_VOLUME * p;
    if (p >= 1) clearInterval(songFadeTimer);
  }, 50);
}

function startSong(){
  if (songStopped) return;
  const track = songNow || songFirst || songLoop;
  if (!track) return;
  songNow = track;
  songWanted = true;
  /* If the browser blocks it (no click yet), it is tried again on the visitor's first click or key press. */
  track.play().then(() => fadeSongIn(track)).catch(() => {});
}
["pointerdown", "keydown"].forEach(type => {
  document.addEventListener(type, () => {
    if (songWanted && !songStopped && songNow && songNow.paused && !songNow.ended) startSong();
  });
});

/* Fades the music out and stops it. Called when the survey is over. */
function fadeSongOut(){
  songStopped = true;
  songWanted = false;
  clearInterval(songFadeTimer);
  const track = songNow;
  if (!track) return;
  if (reduced){ track.pause(); return; }
  const v0 = track.volume;
  const t0 = performance.now();
  songFadeTimer = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / SONG_END_FADE_MS);
    track.volume = v0 * (1 - p);
    if (p >= 1){ clearInterval(songFadeTimer); track.pause(); }
  }, 50);
}

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

  /* 1. The background and the song begin fading in while the intro text and eye fade out. */
  startBackground();
  startSong();
  if (!wasSkipped && !reduced){
    await $("intro").animate([{opacity:1},{opacity:0}], {duration:INTRO_FADE_MS, easing:"ease", fill:"forwards"}).finished;
    await sleep(400);
  }

  /* 2. Then the disclaimer (and after it, the survey) fades in over the background. */
  $("disclaimerText").textContent = DISCLAIMER;
  $("disclaimerNote").textContent = DISCLAIMER_NOTE;
  if (!reduced) $("disclaimer").style.animationDuration = SURVEY_FADE_MS + "ms";
  show("disclaimer");
  $("agree").focus();
}

/* ---------- 3. survey ---------- */
const answers = {};
let idx = 0, busy = false;

/* Builds the answer box or the sliders for a question (they stay hidden until the question has finished typing). */
function buildAnswer(q){
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

/* Types text into an element one character at a time, like the intro.
   The characters not typed yet are still laid out (invisibly), so the text never reflows while it types. */
async function typeInto(el, text, perChar){
  el.textContent = "";
  const sr = document.createElement("span");      /* screen readers get the whole text at once */
  sr.className = "sr";
  sr.textContent = text;
  const typed = document.createElement("span");
  typed.setAttribute("aria-hidden", "true");
  const rest = document.createElement("span");
  rest.className = "ghost";
  rest.setAttribute("aria-hidden", "true");
  el.append(sr, typed, rest);

  if (reduced){ typed.textContent = text; return; }
  for (let i = 1; i <= text.length; i++){
    typed.textContent = text.slice(0, i);
    rest.textContent = text.slice(i);
    const ch = text[i - 1];
    const beat = ".?!".includes(ch) && i < text.length ? 220 : 0;   /* small pause after a sentence ends */
    await sleep(perChar * (0.65 + Math.random() * 0.7) + beat);
  }
}

/* Fades an element out, then hides it. */
async function fadeOut(el, ms){
  if (!reduced){
    await el.animate([{opacity:1},{opacity:0}], {duration:ms, easing:"ease", fill:"forwards"}).finished;
  }
  el.hidden = true;
  el.getAnimations().forEach(a => a.cancel());
}

/* Shows one question: the prompt types itself in, then the answer box / sliders fade in below it. */
async function askQuestion(){
  const q = QUESTIONS[idx];
  busy = true;

  $("replyStage").hidden = true;
  $("qstage").hidden = false;
  $("inputs").hidden = true;
  $("hint").textContent = "";
  $("progress").textContent = (idx + 1) + " / " + QUESTIONS.length;
  buildAnswer(q);

  await typeInto($("prompt"), q.prompt, PROMPT_TYPE_MS);
  await sleep(PROMPT_TO_INPUT_MS);

  $("inputs").hidden = false;
  fade($("inputs"), 700);
  const first = $("answerArea").querySelector("textarea, input");
  if (first) first.focus();
  busy = false;
}

async function submitAnswer(){
  if (busy) return;
  const q = QUESTIONS[idx];
  const a = readAnswer(q);
  if (!a){ $("hint").textContent = "type something first."; return; }

  busy = true;
  answers[q.id] = a.value;
  lockInputs();
  $("hint").textContent = "";

  /* The question and the filled-in answer disappear. */
  await fadeOut($("qstage"), 500);

  /* The AI's reply is shown on its own, typed out like the intro. */
  const reply = $("reply");
  $("replyStage").hidden = false;
  let dots = 0;
  reply.textContent = "";
  const dotTimer = setInterval(() => { dots = (dots + 1) % 4; reply.textContent = ".".repeat(dots); }, 300);

  const line = await getCompliment(a.summary);

  clearInterval(dotTimer);
  await typeInto(reply, line, REPLY_TYPE_MS);
  await sleep(REPLY_HOLD_MS);
  await fadeOut(reply, 500);
  reply.hidden = false;      /* fadeOut hides the element; the stage itself is hidden next */
  $("replyStage").hidden = true;

  /* Short break, then the next question (or the end). */
  await sleep(NEXT_PAUSE_MS);
  idx++;
  if (idx >= QUESTIONS.length) finish(); else askQuestion();
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
  fadeSongOut();
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
$("agree").addEventListener("click", () => { show("survey"); askQuestion(); });
$("go").addEventListener("click", submitAnswer);

/* ---------- silent sound unlock ---------- */
/* Browsers only allow sound after the visitor has interacted with the page. Nothing is shown for this:
   the intro just plays, and the first key press or click during it (it does nothing on screen)
   unlocks the music, so it can fade in later at "Connected." Keys that browsers don't count as
   interaction (Shift, Ctrl, Alt, Escape...) are ignored. */
const UNLOCK_IGNORE_KEYS = ["Alt", "AltGraph", "Shift", "Control", "Meta", "CapsLock", "Escape"];
let musicUnlocked = false;

/* Plays each track silently for an instant, inside the key press, so the browser allows them later. */
function unlockMusic(ev){
  if (musicUnlocked) return;
  if (ev.type === "keydown" && UNLOCK_IGNORE_KEYS.includes(ev.key)) return;
  musicUnlocked = true;
  [songFirst, songLoop].forEach(track => {
    if (!track) return;
    track.play().then(() => {
      if (!songWanted){ track.pause(); track.currentTime = 0; }
    }).catch(() => {});
  });
}
["keydown", "pointerdown"].forEach(type => document.addEventListener(type, unlockMusic));

playIntro();
