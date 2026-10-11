const PEOPLE = [
  { name: "爸爸", className: "dad", initial: "爸" },
  { name: "妈妈", className: "mom", initial: "妈" },
  { name: "多多", className: "duoduo", initial: "多" }
];
const PROJECTS = {
  plus: ["主动帮忙家务", "完成学习计划", "照顾家人", "遵守家庭约定", "特别的好习惯"],
  minus: ["忘记收拾物品", "没有遵守约定", "说话不够友善", "拖延没有完成任务", "其他需要改进的事"]
};
const STORAGE_KEY = "lovefamily-points-v1";
let mode = "plus";
let selectedMonth = new Date().toISOString().slice(0, 7);
let state = loadState();

function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { months: {} }; } catch { return { months: {} }; } }
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function seedMonth(month) {
  if (state.months[month]) return;
  state.months[month] = { transactions: [] };
  if (month === new Date().toISOString().slice(0, 7)) {
    state.months[month].transactions = [
      { member: "多多", project: "完成学习计划", points: 3, createdAt: new Date().toISOString(), note: "认真完成英语练习" },
      { member: "妈妈", project: "照顾家人", points: 2, createdAt: new Date(Date.now() - 3600000).toISOString(), note: "准备了美味晚餐" },
      { member: "爸爸", project: "主动帮忙家务", points: 2, createdAt: new Date(Date.now() - 7200000).toISOString(), note: "一起收拾客厅" }
    ];
  }
  saveState();
}
function getMonth() { seedMonth(selectedMonth); return state.months[selectedMonth]; }
function scoreFor(member) { return getMonth().transactions.filter((item) => item.member === member).reduce((sum, item) => sum + item.points, 0); }
function monthTitle(month) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(`${month}-01T12:00:00`)); }
function render() {
  document.querySelector("#month-picker").value = selectedMonth;
  document.querySelector("#month-copy").textContent = `${monthTitle(selectedMonth)} · 记录每位家人的努力与改变。`;
  const ranking = PEOPLE.map((person) => ({ ...person, score: scoreFor(person.name), count: getMonth().transactions.filter((item) => item.member === person.name).length })).sort((a, b) => b.score - a.score);
  document.querySelector("#scoreboard").replaceChildren(...ranking.map((person, index) => scoreRow(person, index)));
  renderTransactions();
}
function scoreRow(person, index) {
  const row = document.createElement("div"); row.className = "score-row";
  row.innerHTML = `<span class="person-dot ${person.className}">${person.initial}</span><div><div class="person-name"><span class="rank-label">NO.${index + 1}</span>${person.name}</div><div class="person-detail">本月 ${person.count} 条成长记录</div></div><div class="score">${person.score}<small>分</small></div>`;
  return row;
}
function renderTransactions() {
  const list = document.querySelector("#transaction-list");
  const records = [...getMonth().transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!records.length) { list.innerHTML = '<div class="empty">这个月还没有积分记录，先为家人记一笔吧。</div>'; return; }
  list.replaceChildren(...records.map((item) => {
    const row = document.createElement("div"); const plus = item.points > 0;
    row.className = "transaction";
    row.innerHTML = `<div><div class="transaction-title">${item.member} · ${item.project}</div><div class="transaction-meta">${formatTime(item.createdAt)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</div></div><div class="transaction-points ${plus ? "plus" : "minus"}">${plus ? "+" : ""}${item.points} 分</div>`;
    return row;
  }));
}
function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll(".action-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  document.querySelector("#project-label").textContent = mode === "plus" ? "表扬项目" : "减分项目";
  document.querySelector("#submit-transaction").textContent = mode === "plus" ? "记录加分" : "记录减分";
  const select = document.querySelector("#project-select");
  select.replaceChildren(...PROJECTS[mode].map((project) => new Option(project, project)));
}
function moveMonth(delta) {
  const value = new Date(`${selectedMonth}-01T12:00:00`); value.setMonth(value.getMonth() + delta);
  selectedMonth = value.toISOString().slice(0, 7); render();
}
function addTransaction() {
  const member = document.querySelector("#member-select").value;
  const project = document.querySelector("#project-select").value;
  const amount = Number(document.querySelector("#points-select").value) * (mode === "plus" ? 1 : -1);
  const note = document.querySelector("#note-input").value.trim();
  getMonth().transactions.push({ member, project, points: amount, note, createdAt: new Date().toISOString() });
  document.querySelector("#note-input").value = ""; saveState(); render();
}
function formatTime(value) { return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }

document.querySelectorAll(".action-tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
document.querySelector("#previous-month").addEventListener("click", () => moveMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => moveMonth(1));
document.querySelector("#month-picker").addEventListener("change", (event) => { selectedMonth = event.target.value; render(); });
document.querySelector("#submit-transaction").addEventListener("click", addTransaction);
setMode("plus"); render();
