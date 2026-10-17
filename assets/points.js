const PEOPLE = [
  { name: "爸爸", className: "dad", initial: "爸" },
  { name: "妈妈", className: "mom", initial: "妈" },
  { name: "多多", className: "duoduo", initial: "多" }
];
const PROJECTS = {
  plus: ["主动帮忙家务", "完成学习计划", "照顾家人", "遵守家庭约定", "特别的好习惯"],
  minus: ["忘记收拾物品", "没有遵守约定", "说话不够友善", "拖延没有完成任务", "其他需要改进的事"]
};
const API_BASE_URL = (window.LOVEFAMILY_API_BASE_URL || "").replace(/\/$/, "");
let mode = "plus";
let selectedMonth = new Date().toISOString().slice(0, 7);
let state = { month: selectedMonth, transactions: [] };

function configured() { return API_BASE_URL && !API_BASE_URL.includes("YOUR-WORKER"); }
function monthTitle(month) { return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(new Date(`${month}-01T12:00:00`)); }
function scoreFor(member) { return state.transactions.filter((item) => item.member === member).reduce((sum, item) => sum + item.points, 0); }
function setStatus(message, error = false) {
  const status = document.querySelector("#points-status");
  status.textContent = message;
  status.classList.toggle("error", error);
}

async function api(path, options = {}) {
  if (!configured()) throw new Error("积分服务尚未配置，请先填写 assets/family-api-config.js 中的 Worker 地址。");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败，请稍后再试。");
  return data;
}

async function loadMonth() {
  setStatus("正在读取共享积分记录…");
  try {
    state = await api(`/api/points/${selectedMonth}`);
    render();
    setStatus(state.transactions.length ? "数据已从家庭私有仓库同步。" : "本月还没有积分记录。");
  } catch (error) {
    setStatus(error.message, true);
  }
}

function render() {
  document.querySelector("#month-picker").value = selectedMonth;
  document.querySelector("#month-copy").textContent = `${monthTitle(selectedMonth)} · 记录每位家人的努力与改变。`;
  const ranking = PEOPLE.map((person) => ({ ...person, score: scoreFor(person.name), count: state.transactions.filter((item) => item.member === person.name).length })).sort((a, b) => b.score - a.score);
  document.querySelector("#scoreboard").replaceChildren(...ranking.map((person, index) => scoreRow(person, index)));
  renderTransactions();
}

function scoreRow(person, index) {
  const row = document.createElement("div");
  row.className = "score-row";
  row.innerHTML = `<span class="person-dot ${person.className}">${person.initial}</span><div><div class="person-name"><span class="rank-label">NO.${index + 1}</span>${person.name}</div><div class="person-detail">本月 ${person.count} 条成长记录</div></div><div class="score">${person.score}<small>分</small></div>`;
  return row;
}

function renderTransactions() {
  const list = document.querySelector("#transaction-list");
  const records = [...state.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (!records.length) { list.innerHTML = '<div class="empty">这个月还没有积分记录，先为家人记一笔吧。</div>'; return; }
  list.replaceChildren(...records.map((item) => {
    const row = document.createElement("div");
    const plus = item.points > 0;
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
  document.querySelector("#project-select").replaceChildren(...PROJECTS[mode].map((project) => new Option(project, project)));
}

async function addTransaction() {
  const button = document.querySelector("#submit-transaction");
  button.disabled = true;
  try {
    const data = await api(`/api/points/${selectedMonth}`, {
      method: "POST",
      body: JSON.stringify({
        member: document.querySelector("#member-select").value,
        project: document.querySelector("#project-select").value,
        value: Number(document.querySelector("#points-select").value),
        mode,
        note: document.querySelector("#note-input").value.trim()
      })
    });
    state = data.points;
    document.querySelector("#note-input").value = "";
    render();
    setStatus("积分已同步到家庭私有仓库。");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function moveMonth(delta) {
  const value = new Date(`${selectedMonth}-01T12:00:00`);
  value.setMonth(value.getMonth() + delta);
  selectedMonth = value.toISOString().slice(0, 7);
  loadMonth();
}
function formatTime(value) { return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }

document.querySelectorAll(".action-tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
document.querySelector("#previous-month").addEventListener("click", () => moveMonth(-1));
document.querySelector("#next-month").addEventListener("click", () => moveMonth(1));
document.querySelector("#month-picker").addEventListener("change", (event) => { selectedMonth = event.target.value; loadMonth(); });
document.querySelector("#submit-transaction").addEventListener("click", addTransaction);
setMode("plus");
loadMonth();
