const KITCHEN_STORAGE_KEY = "lovefamily-kitchen-v1";
const DEFAULT_DISHES = [
  { id: "tomato-egg", name: "番茄炒蛋", category: "家常菜", emoji: "🍅", available: true },
  { id: "chicken-wings", name: "蜜汁鸡翅", category: "家常菜", emoji: "🍗", available: true },
  { id: "broccoli", name: "蒜蓉西兰花", category: "家常菜", emoji: "🥦", available: true },
  { id: "salmon-rice", name: "三文鱼饭团", category: "主食", emoji: "🍙", available: true },
  { id: "corn-soup", name: "玉米排骨汤", category: "汤羹", emoji: "🌽", available: true },
  { id: "pancake", name: "香蕉松饼", category: "小点心", emoji: "🥞", available: true }
];
let state = loadKitchen();
let chosenDate = dateKey(1);
let chosenMeal = "午餐";
let selectedDishes = new Set();

function loadKitchen() {
  try {
    const saved = JSON.parse(localStorage.getItem(KITCHEN_STORAGE_KEY));
    if (saved?.dishes && saved?.orders) return saved;
  } catch { /* Use the starter kitchen below. */ }
  return { dishes: DEFAULT_DISHES, orders: [] };
}
function saveKitchen() { localStorage.setItem(KITCHEN_STORAGE_KEY, JSON.stringify(state)); }
function dateKey(offset) { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); }
function dateText(key, compact = false) { return new Intl.DateTimeFormat("zh-CN", compact ? { month: "numeric", day: "numeric" } : { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${key}T12:00:00`)); }
function emojiForCategory(category) { return { "家常菜": "🍲", "主食": "🍚", "汤羹": "🥣", "小点心": "🍪" }[category] || "🍽"; }

function renderDates() {
  const holder = document.querySelector("#date-choices");
  holder.replaceChildren(...Array.from({ length: 7 }, (_, index) => {
    const key = dateKey(index + 1); const button = document.createElement("button"); button.type = "button";
    button.className = `date-choice${key === chosenDate ? " active" : ""}`;
    button.innerHTML = `<span>${index === 0 ? "明天" : index === 1 ? "后天" : dateText(key, true)}</span><small>${new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(new Date(`${key}T12:00:00`))}</small>`;
    button.addEventListener("click", () => { chosenDate = key; renderDates(); renderMomOrders(); updateOrderSummary(); });
    return button;
  }));
}
function renderDishes() {
  const holder = document.querySelector("#dish-grid"); const available = state.dishes.filter((dish) => dish.available);
  if (!available.length) { holder.innerHTML = '<p class="empty">妈妈还没有上架菜品，等等她的拿手菜吧。</p>'; return; }
  holder.replaceChildren(...available.map((dish) => {
    const button = document.createElement("button"); button.type = "button"; button.className = `dish-card${selectedDishes.has(dish.id) ? " selected" : ""}`;
    button.innerHTML = `<span class="dish-emoji">${dish.emoji || emojiForCategory(dish.category)}</span><span><strong>${escapeHtml(dish.name)}</strong><small>${dish.category}</small></span><i>${selectedDishes.has(dish.id) ? "✓" : "+"}</i>`;
    button.addEventListener("click", () => { selectedDishes.has(dish.id) ? selectedDishes.delete(dish.id) : selectedDishes.add(dish.id); renderDishes(); updateOrderSummary(); });
    return button;
  }));
}
function updateOrderSummary() {
  const count = selectedDishes.size; const label = `${dateText(chosenDate)} ${chosenMeal}`;
  document.querySelector("#order-count").textContent = `${count} 道已选`;
  document.querySelector("#order-summary").textContent = count ? `准备点 ${count} 道菜 · ${label}` : "还没有选择菜品。";
  document.querySelector("#place-order").disabled = !count;
}
function placeOrder() {
  const dishes = state.dishes.filter((dish) => selectedDishes.has(dish.id));
  if (!dishes.length) return;
  state.orders.push({ id: `${Date.now()}`, date: chosenDate, meal: chosenMeal, dishes: dishes.map((dish) => ({ id: dish.id, name: dish.name, emoji: dish.emoji || emojiForCategory(dish.category) })), createdAt: new Date().toISOString() });
  selectedDishes.clear(); saveKitchen(); renderDishes(); updateOrderSummary(); renderMomOrders(); renderRecentOrders();
}
function renderMomOrders() {
  const holder = document.querySelector("#mom-orders");
  const orders = state.orders.filter((order) => order.date >= chosenDate).sort((a, b) => `${a.date}${a.meal}`.localeCompare(`${b.date}${b.meal}`));
  if (!orders.length) { holder.innerHTML = `<div class="mom-empty">${dateText(chosenDate)}开始，还没有待做点单。</div>`; return; }
  holder.replaceChildren(...orders.map((order) => orderItem(order, true)));
}
function renderRecentOrders() {
  const holder = document.querySelector("#recent-orders");
  const orders = [...state.orders].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0, 6);
  if (!orders.length) { holder.innerHTML = '<div class="empty">还没有点单，先去挑一道最想吃的菜吧。</div>'; return; }
  holder.replaceChildren(...orders.map((order) => orderItem(order, false)));
}
function orderItem(order, compact) {
  const item = document.createElement("article"); item.className = compact ? "mom-order-item" : "kitchen-order-item";
  item.innerHTML = `<div><span class="order-date">${dateText(order.date, true)} · ${order.meal}</span><strong>${order.dishes.map((dish) => `${dish.emoji} ${escapeHtml(dish.name)}`).join(" · ")}</strong></div>${compact ? `<button type="button" class="complete-order" data-id="${order.id}">做好了</button>` : `<span class="order-created">已点单</span>`}`;
  if (compact) item.querySelector("button").addEventListener("click", () => completeOrder(order.id));
  return item;
}
function completeOrder(id) { state.orders = state.orders.filter((order) => order.id !== id); saveKitchen(); renderMomOrders(); renderRecentOrders(); }
function renderMenuManager() {
  const holder = document.querySelector("#menu-manager-list");
  holder.replaceChildren(...state.dishes.map((dish) => {
    const row = document.createElement("div"); row.className = "menu-manager-item";
    row.innerHTML = `<span>${dish.emoji || emojiForCategory(dish.category)}</span><div><strong>${escapeHtml(dish.name)}</strong><small>${dish.category}</small></div><button type="button" data-id="${dish.id}">${dish.available ? "下架" : "上架"}</button>`;
    row.querySelector("button").addEventListener("click", () => { dish.available = !dish.available; saveKitchen(); renderMenuManager(); renderDishes(); });
    return row;
  }));
}
function addDish(event) {
  event.preventDefault(); const name = document.querySelector("#dish-name").value.trim(); const category = document.querySelector("#dish-category").value;
  if (!name) return;
  state.dishes.push({ id: `dish-${Date.now()}`, name, category, emoji: emojiForCategory(category), available: true }); saveKitchen(); event.currentTarget.reset(); renderMenuManager(); renderDishes();
}
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }

document.querySelectorAll(".meal-choice").forEach((button) => button.addEventListener("click", () => { chosenMeal = button.dataset.meal; document.querySelectorAll(".meal-choice").forEach((item) => item.classList.toggle("active", item === button)); updateOrderSummary(); }));
document.querySelectorAll(".manager-tab").forEach((tab) => tab.addEventListener("click", () => { document.querySelectorAll(".manager-tab").forEach((item) => item.classList.toggle("active", item === tab)); document.querySelector("#mom-orders").hidden = tab.dataset.view !== "orders"; document.querySelector("#mom-menu").hidden = tab.dataset.view !== "menu"; }));
document.querySelector("#place-order").addEventListener("click", placeOrder);
document.querySelector("#dish-form").addEventListener("submit", addDish);
renderDates(); renderDishes(); updateOrderSummary(); renderMomOrders(); renderRecentOrders(); renderMenuManager();
