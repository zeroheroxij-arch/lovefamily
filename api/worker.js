const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      const url = new URL(request.url);
      if (url.pathname === "/api/auth/login" && request.method === "POST") return json(await login(request, env), 200, cors);
      const pointsMonth = url.pathname.match(/^\/api\/points\/(\d{4}-\d{2})$/);
      if (pointsMonth && request.method === "GET") return json(await getPoints(env, pointsMonth[1]), 200, cors);
      if (pointsMonth && request.method === "POST") return json(await addPoint(request, env, pointsMonth[1]), 201, cors);
      const session = await requireSession(request, env);
      if (url.pathname === "/api/family/bootstrap" && request.method === "GET") return json(await bootstrap(env), 200, cors);
      if (url.pathname === "/api/progress/answer" && request.method === "POST") return json(await recordAnswer(request, env, session), 200, cors);
      if (url.pathname.startsWith("/api/admin/") && request.method === "PUT") return json(await writeAdminData(request, env, session, url.pathname), 200, cors);
      return json({ error: "Not found" }, 404, cors);
    } catch (error) {
      const status = error.status || 500;
      return json({ error: error.message || "Unexpected server error" }, status, cors);
    }
  }
};

async function login(request, env) {
  const { password, role = "family" } = await request.json();
  if (!password || !["family", "mom"].includes(role)) throw httpError(400, "Invalid login request");
  const expected = role === "mom" ? env.MOM_PASSWORD : env.FAMILY_PASSWORD;
  if (!expected || !(await secretMatches(password, expected))) throw httpError(401, "密码不正确");
  const token = await signToken({ role, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8 }, env.SESSION_SECRET);
  return { token, role, expiresIn: 28800 };
}

async function bootstrap(env) {
  const today = new Date().toISOString().slice(0, 10);
  const [catalogue, task, progress, videos] = await Promise.all([
    getJson(env, "libraries.json"), getJson(env, `tasks/${today}.json`, true), getJson(env, "progress/duoduo.json"), getJson(env, "videos/p1.json")
  ]);
  return { catalogue, task, progress, videos };
}

async function recordAnswer(request, env, session) {
  const { wordId, correct } = await request.json();
  if (!wordId || typeof correct !== "boolean") throw httpError(400, "Invalid answer event");
  const progress = await getJson(env, "progress/duoduo.json");
  const entry = progress.words[wordId] || { attempts: 0, correct: 0, streak: 0, mastery: "new" };
  entry.attempts += 1;
  entry.correct += correct ? 1 : 0;
  entry.streak = correct ? entry.streak + 1 : 0;
  entry.lastPracticedAt = new Date().toISOString();
  const accuracy = entry.correct / entry.attempts;
  entry.mastery = entry.correct >= 6 && accuracy >= .85 ? "mastered" : entry.correct >= 3 && accuracy >= .75 ? "familiar" : entry.correct ? "learning" : "new";
  progress.words[wordId] = entry;
  progress.updatedAt = entry.lastPracticedAt;
  await putJson(env, "progress/duoduo.json", progress, "Update Duoduo word progress");
  return { wordId, progress: entry, learner: session.role };
}

const POINT_MEMBERS = new Set(["爸爸", "妈妈", "多多"]);
const POINT_PROJECTS = {
  plus: new Set(["主动帮忙家务", "完成学习计划", "照顾家人", "遵守家庭约定", "特别的好习惯"]),
  minus: new Set(["忘记收拾物品", "没有遵守约定", "说话不够友善", "拖延没有完成任务", "其他需要改进的事"])
};
const POINT_VALUES = new Set([1, 2, 3, 5]);

async function getPoints(env, month) {
  const points = await getJson(env, `points/${month}.json`, true);
  return normalizePoints(points, month);
}

async function addPoint(request, env, month) {
  const { member, project, value, mode, note = "" } = await request.json();
  if (!POINT_MEMBERS.has(member) || !POINT_PROJECTS[mode]?.has(project) || !POINT_VALUES.has(value)) {
    throw httpError(400, "Invalid point transaction");
  }
  if (typeof note !== "string" || note.length > 32) throw httpError(400, "Invalid point note");

  const transaction = {
    id: crypto.randomUUID(), member, project,
    points: mode === "plus" ? value : -value,
    note: note.trim(),
    createdAt: new Date().toISOString()
  };
  const path = `points/${month}.json`;

  // The GitHub Contents API uses a SHA precondition. Retry a competing update
  // so two family members recording points do not lose one another's entry.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const points = normalizePoints(await getJson(env, path, true), month);
    points.transactions.push(transaction);
    points.updatedAt = transaction.createdAt;
    try {
      await putJson(env, path, points, `Add ${member} point transaction for ${month}`);
      return { transaction, points };
    } catch (error) {
      if (error.status !== 409 || attempt === 2) throw error;
    }
  }
}

function normalizePoints(points, month) {
  if (!points) return { month, updatedAt: null, transactions: [] };
  if (!Array.isArray(points.transactions)) throw httpError(500, "Invalid points data");
  return { month, updatedAt: points.updatedAt || null, transactions: points.transactions };
}

async function writeAdminData(request, env, session, pathname) {
  if (session.role !== "mom") throw httpError(403, "妈妈管理密码 required");
  const path = pathname.replace("/api/admin/", "");
  if (!/^(libraries(\/[a-z0-9-]+)?|tasks\/\d{4}-\d{2}-\d{2}|videos\/p1)\.json$/.test(path)) throw httpError(400, "Unsupported data path");
  const body = await request.json();
  await putJson(env, path, body, `Update ${path}`);
  return { ok: true, path };
}

async function getJson(env, path, optional = false) {
  const response = await github(env, `/repos/${env.GITHUB_DATA_REPO}/contents/${path}`);
  if (optional && response.status === 404) return null;
  if (!response.ok) throw httpError(response.status, `Could not read ${path}`);
  const payload = await response.json();
  return JSON.parse(atob(payload.content.replace(/\n/g, "")));
}

async function putJson(env, path, data, message) {
  const existing = await github(env, `/repos/${env.GITHUB_DATA_REPO}/contents/${path}`);
  const sha = existing.ok ? (await existing.json()).sha : undefined;
  if (!existing.ok && existing.status !== 404) throw httpError(existing.status, `Could not update ${path}`);
  const response = await github(env, `/repos/${env.GITHUB_DATA_REPO}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(`${JSON.stringify(data, null, 2)}\n`))), sha, branch: "main" })
  });
  if (!response.ok) throw httpError(response.status, `GitHub rejected the update to ${path}`);
}

function github(env, path, options = {}) {
  return fetch(`https://api.github.com${path}`, { ...options, headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${env.GITHUB_DATA_TOKEN}`, "Content-Type": "application/json", "User-Agent": "lovefamily-api", ...options.headers } });
}

async function requireSession(request, env) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw httpError(401, "请先进入家庭");
  const session = await verifyToken(token, env.SESSION_SECRET);
  if (!session || session.exp < Math.floor(Date.now() / 1000)) throw httpError(401, "家庭会话已过期");
  return session;
}
async function secretMatches(actual, expected) { return (await digest(actual)) === (await digest(expected)); }
async function digest(value) { const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value)); return [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
async function signToken(payload, secret) { const body = b64(JSON.stringify(payload)); const signature = await hmac(body, secret); return `${body}.${signature}`; }
async function verifyToken(token, secret) { const [body, signature] = token.split("."); if (!body || signature !== await hmac(body, secret)) return null; return JSON.parse(new TextDecoder().decode(fromB64(body))); }
async function hmac(value, secret) { const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))))); }
function b64(value) { return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fromB64(value) { const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4); return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)); }
function corsHeaders(request, env) { const origin = request.headers.get("Origin"); return origin && origin === env.ALLOWED_ORIGIN ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS", Vary: "Origin" } : {}; }
function json(value, status, headers) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json", ...headers } }); }
function httpError(status, message) { const error = new Error(message); error.status = status; return error; }
