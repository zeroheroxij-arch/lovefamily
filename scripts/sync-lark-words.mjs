import { writeFile } from "node:fs/promises";

const required = ["LARK_APP_ID", "LARK_APP_SECRET", "LARK_SPREADSHEET_TOKEN", "LARK_SHEET_ID"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);

const openBaseUrl = (process.env.LARK_OPEN_BASE_URL || "https://open.larksuite.com").replace(/\/$/, "");
const tokenResponse = await fetch(`${openBaseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ app_id: process.env.LARK_APP_ID, app_secret: process.env.LARK_APP_SECRET })
});
const tokenPayload = await tokenResponse.json();
if (!tokenResponse.ok || tokenPayload.code) throw new Error(`Could not get Lark token: ${tokenPayload.msg || tokenResponse.status}`);

const range = process.env.LARK_WORD_RANGE || `${process.env.LARK_SHEET_ID}!A:B`;
const valuesUrl = `${openBaseUrl}/open-apis/sheets/v2/spreadsheets/${encodeURIComponent(process.env.LARK_SPREADSHEET_TOKEN)}/values/${encodeURIComponent(range)}`;
const valuesResponse = await fetch(valuesUrl, { headers: { Authorization: `Bearer ${tokenPayload.tenant_access_token}` } });
const valuesPayload = await valuesResponse.json();
if (!valuesResponse.ok || valuesPayload.code) throw new Error(`Could not read Lark sheet: ${valuesPayload.msg || valuesResponse.status}`);

const rows = valuesPayload.data?.valueRange?.values || [];
if (rows.length < 2) throw new Error("The Lark sheet needs a header row and at least one word.");
const headers = rows[0].map((value) => String(value).trim().toLowerCase());
const englishIndex = headers.findIndex((header) => ["english", "英文", "单词", "word"].includes(header));
const chineseIndex = headers.findIndex((header) => ["chinese", "中文", "中文意思", "释义", "meaning"].includes(header));
if (englishIndex < 0 || chineseIndex < 0) throw new Error("Expected columns named English/英文 and Chinese/中文.");
const words = rows.slice(1).map((row) => ({ english: String(row[englishIndex] || "").trim(), chinese: String(row[chineseIndex] || "").trim() })).filter((word) => word.english && word.chinese);
if (!words.length) throw new Error("No valid English and Chinese word pairs were found.");

await writeFile("data/words.json", `${JSON.stringify({ updatedAt: new Date().toISOString(), source: "Lark Sheet", words }, null, 2)}\n`);
console.log(`Synced ${words.length} word pairs from Lark Sheet.`);
