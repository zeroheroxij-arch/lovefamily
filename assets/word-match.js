const WORDS_URL = "data/words.json";
const ROUND_SIZE = 5;
const STORAGE_KEY = "lovefamily-word-progress-v1";

let words = [];
let round = [];
let selectedEnglish = null;
let matched = new Set();
let progress = loadProgress();

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveProgress() { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
function hashWord(word) { return `${word.english}::${word.chinese}`; }
function shuffle(items) { return [...items].sort(() => Math.random() - .5); }
function today() { return new Date().toISOString().slice(0, 10); }

async function loadWords() {
  const status = document.querySelector("#data-status");
  status.className = "data-status";
  status.innerHTML = "<span>正在读取词库…</span>";
  try {
    const response = await fetch(`${WORDS_URL}?v=${Date.now()}`);
    if (!response.ok) throw new Error("词库文件不可用");
    const data = await response.json();
    words = data.words.filter((word) => word.english && word.chinese);
    if (words.length < ROUND_SIZE) throw new Error("词库至少需要 5 个有效单词");
    status.innerHTML = `<span><strong>已加载 ${words.length} 个单词</strong> · 来源：${data.source || "词库"} · 更新于 ${formatDate(data.updatedAt)}</span>`;
    startRound();
  } catch (error) {
    status.className = "data-status error";
    status.innerHTML = `<span><strong>词库读取失败</strong> · ${error.message}。请稍后重新读取。</span>`;
  }
}

function weightedRound() {
  const pool = words.map((word) => {
    const stats = progress[hashWord(word)] || {};
    const mastery = Math.min(stats.correct || 0, 5);
    return { word, weight: Math.max(1, 7 - mastery * 1.35) };
  });
  const picked = [];
  while (picked.length < ROUND_SIZE && pool.length) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let marker = Math.random() * total;
    const index = pool.findIndex((item) => (marker -= item.weight) <= 0);
    picked.push(pool.splice(Math.max(index, 0), 1)[0].word);
  }
  return picked;
}

function startRound() {
  round = weightedRound();
  matched = new Set();
  selectedEnglish = null;
  renderRound();
  setHint("开始吧：", "先选择左侧的英文单词。");
  updateStats();
}

function renderRound() {
  const englishList = document.querySelector("#english-list");
  const chineseList = document.querySelector("#chinese-list");
  englishList.replaceChildren(...round.map((word) => card(word, "english")));
  chineseList.replaceChildren(...shuffle(round).map((word) => card(word, "chinese")));
}

function card(word, side) {
  const button = document.createElement("button");
  button.className = "word-card";
  button.type = "button";
  button.dataset.key = hashWord(word);
  button.dataset.side = side;
  button.textContent = side === "english" ? word.english : word.chinese;
  button.addEventListener("click", () => choose(word, side));
  return button;
}

function choose(word, side) {
  if (matched.has(hashWord(word))) return;
  if (side === "english") {
    selectedEnglish = word;
    document.querySelectorAll('[data-side="english"]').forEach((item) => item.classList.toggle("selected", item.dataset.key === hashWord(word)));
    setHint("已选择：", `“${word.english}”，现在选择它的中文意思。`);
    return;
  }
  if (!selectedEnglish) { setHint("先选英文：", "请先从左侧选择一个英文单词。", true); return; }
  const englishKey = hashWord(selectedEnglish);
  const chineseKey = hashWord(word);
  if (englishKey === chineseKey) {
    matched.add(englishKey);
    document.querySelectorAll(`[data-key="${CSS.escape(englishKey)}"]`).forEach((item) => { item.classList.remove("selected"); item.classList.add("matched"); item.disabled = true; });
    recordCorrect(selectedEnglish);
    selectedEnglish = null;
    const complete = matched.size === round.length;
    setHint(complete ? "本轮完成：" : "答对了：", complete ? "太棒了，换一组单词继续巩固吧。" : "继续选择下一组英文和中文。 ");
    updateStats();
    return;
  }
  const wrongButton = document.querySelector(`[data-side="chinese"][data-key="${CSS.escape(chineseKey)}"]`);
  wrongButton.classList.add("wrong");
  setTimeout(() => wrongButton.classList.remove("wrong"), 350);
  setHint("再想一想：", `“${selectedEnglish.english}” 不等于 “${word.chinese}”。`, true);
}

function recordCorrect(word) {
  const key = hashWord(word);
  const entry = progress[key] || { correct: 0, total: 0, dailyCorrect: 0, lastDate: "" };
  if (entry.lastDate !== today()) entry.dailyCorrect = 0;
  entry.correct += 1; entry.total += 1; entry.dailyCorrect += 1; entry.lastDate = today();
  progress[key] = entry;
  saveProgress();
}
function setHint(lead, content, warning = false) {
  document.querySelector("#match-hint").innerHTML = `<strong style="color:${warning ? "var(--coral)" : "var(--deep-sage)"}">${lead}</strong> ${content}`;
}
function updateStats() {
  const todayCorrect = Object.values(progress).filter((entry) => entry.lastDate === today()).reduce((sum, entry) => sum + (entry.dailyCorrect || 0), 0);
  const mastered = Object.values(progress).filter((entry) => entry.correct >= 3).length;
  document.querySelector("#round-progress").textContent = `${matched.size} / ${round.length || ROUND_SIZE}`;
  document.querySelector("#today-correct").textContent = todayCorrect;
  document.querySelector("#mastered-count").textContent = mastered;
}
function formatDate(value) { return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value)) : "未知时间"; }

document.querySelector("#new-round").addEventListener("click", startRound);
document.querySelector("#reload-words").addEventListener("click", loadWords);
loadWords();
