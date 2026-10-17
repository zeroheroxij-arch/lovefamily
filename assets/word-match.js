const API = window.LOVEFAMILY_API_BASE_URL;
const ROUND_SIZE = 5;
let words = [];
let round = [];
let selectedEnglish = null;
let matched = new Set();
let progress = { words: {} };

function shuffle(items) { return [...items].sort(() => Math.random() - .5); }
function api(path, options = {}) { return fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...options.headers }, ...options }); }
function libraryId() { return new URLSearchParams(location.search).get("library") || "p1-family-and-feelings"; }

async function loadWords() {
  const status = document.querySelector("#data-status");
  status.className = "data-status";
  status.innerHTML = "<span>正在从家庭词库读取…</span>";
  try {
    const [libraryResponse, progressResponse] = await Promise.all([api(`/api/libraries/${libraryId()}`), api("/api/progress/duoduo")]);
    if (!libraryResponse.ok) throw new Error("词库暂时不可用");
    const library = await libraryResponse.json();
    progress = progressResponse.ok ? await progressResponse.json() : { words: {} };
    words = library.words.filter((word) => word.english && word.chinese && word.id);
    if (words.length < ROUND_SIZE) throw new Error("词库至少需要 5 个有效单词");
    status.innerHTML = `<span><strong>已加载 ${words.length} 个单词</strong> · 来源：${escapeHtml(library.title)} · 更新于 ${formatDate(library.updatedAt)}</span>`;
    startRound();
  } catch (error) {
    status.className = "data-status error";
    status.innerHTML = `<span><strong>词库读取失败</strong> · ${escapeHtml(error.message)}。请稍后重新读取。</span>`;
  }
}

function weightedRound() {
  const pool = words.map((word) => ({ word, weight: Math.max(1, 7 - Math.min(progress.words[word.id]?.correct || 0, 5) * 1.35) }));
  const picked = [];
  while (picked.length < ROUND_SIZE && pool.length) { const total = pool.reduce((sum, item) => sum + item.weight, 0); let marker = Math.random() * total; const index = pool.findIndex((item) => (marker -= item.weight) <= 0); picked.push(pool.splice(Math.max(index, 0), 1)[0].word); }
  return picked;
}
function startRound() { round = weightedRound(); matched = new Set(); selectedEnglish = null; renderRound(); setHint("开始吧：", "先选择左侧的英文单词。"); updateStats(); }
function renderRound() { document.querySelector("#english-list").replaceChildren(...round.map((word) => card(word, "english"))); document.querySelector("#chinese-list").replaceChildren(...shuffle(round).map((word) => card(word, "chinese"))); }
function card(word, side) { const button = document.createElement("button"); button.className = "word-card"; button.type = "button"; button.dataset.key = word.id; button.dataset.side = side; button.textContent = side === "english" ? word.english : word.chinese; button.addEventListener("click", () => choose(word, side)); return button; }
function choose(word, side) {
  if (matched.has(word.id)) return;
  if (side === "english") { selectedEnglish = word; document.querySelectorAll('[data-side="english"]').forEach((item) => item.classList.toggle("selected", item.dataset.key === word.id)); setHint("已选择：", `“${word.english}”，现在选择它的中文意思。`); return; }
  if (!selectedEnglish) { setHint("先选英文：", "请先从左侧选择一个英文单词。", true); return; }
  if (selectedEnglish.id === word.id) { matched.add(word.id); document.querySelectorAll(`[data-key="${CSS.escape(word.id)}"]`).forEach((item) => { item.classList.remove("selected"); item.classList.add("matched"); item.disabled = true; }); recordAnswer(selectedEnglish, true); selectedEnglish = null; const complete = matched.size === round.length; setHint(complete ? "本轮完成：" : "答对了：", complete ? "太棒了，换一组单词继续巩固吧。" : "继续选择下一组英文和中文。"); updateStats(); return; }
  recordAnswer(selectedEnglish, false); const wrongButton = document.querySelector(`[data-side="chinese"][data-key="${CSS.escape(word.id)}"]`); wrongButton.classList.add("wrong"); setTimeout(() => wrongButton.classList.remove("wrong"), 350); setHint("再想一想：", `“${selectedEnglish.english}” 不等于 “${word.chinese}”。`, true);
}
async function recordAnswer(word, correct) { try { const response = await api("/api/progress/answer", { method: "POST", body: JSON.stringify({ wordId: word.id, correct }) }); if (!response.ok) throw new Error(); const result = await response.json(); progress.words[word.id] = result.progress; updateStats(); } catch { setHint("记录未同步：", "网络恢复后请继续练习，学习数据会在下次答题时更新。", true); } }
function setHint(lead, content, warning = false) { document.querySelector("#match-hint").innerHTML = `<strong style="color:${warning ? "var(--coral)" : "var(--deep-sage)"}">${lead}</strong> ${content}`; }
function updateStats() { const entries = Object.values(progress.words); const todayCorrect = entries.filter((entry) => entry.lastPracticedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).reduce((sum, entry) => sum + (entry.correct || 0), 0); document.querySelector("#round-progress").textContent = `${matched.size} / ${round.length || ROUND_SIZE}`; document.querySelector("#today-correct").textContent = todayCorrect; document.querySelector("#mastered-count").textContent = entries.filter((entry) => entry.mastery === "mastered").length; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value)) : "未知时间"; }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
document.querySelector("#new-round").addEventListener("click", startRound);
document.querySelector("#reload-words").addEventListener("click", loadWords);
loadWords();
