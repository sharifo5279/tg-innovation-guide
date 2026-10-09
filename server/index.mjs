// Visitor stats service for the H2 2026 Trading Grid Innovation Guide (Render web service).
//   POST /api/hit              the guide page reports one open (navigator.sendBeacon); 204
//   POST /api/play             Grid Runner, the Trading Grid game at /play/, reports one run started; 204
//   GET  /api/stats?days=1..90 daily opens, visitors, places and Grid Runner plays and players, newest last (public by the owner's choice)
//   GET  /healthz              liveness for Render
// ?test=1 on both API routes uses a separate table, so the pipeline can be checked without touching the real counts.
// Location comes from the open DB-IP Lite city database (CC BY 4.0), looked up in memory; the IP itself is never stored.
import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import pg from "pg";
import maxmind from "maxmind";
import { MAX_DAYS, isBot, utcDay, addDays, sha256hex, place, summarizeDay, addPlays, clientIp } from "./visits.mjs";

const PORT = +(process.env.PORT || 10000);
const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const require = createRequire(import.meta.url);
const geoDir = require.resolve("@ip-location-db/dbip-city-mmdb/package.json").replace(/package\.json$/, "");

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  ssl: /sslmode=require|render\.com/.test(process.env.DATABASE_URL || "") ? { rejectUnauthorized: false } : undefined,
});

async function migrate() {
  await pool.query(`
    create table if not exists visits (id bigserial primary key, day date not null, cc char(2) not null,
      region text not null default '', city text not null default '', vid text not null, ts timestamptz not null default now());
    create index if not exists visits_day on visits (day);
    create table if not exists visits_test (like visits including all);
    create table if not exists plays (id bigserial primary key, day date not null, cc char(2) not null,
      region text not null default '', city text not null default '', vid text not null, ts timestamptz not null default now());
    create index if not exists plays_day on plays (day);
    create table if not exists plays_test (like plays including all);
    create table if not exists salts (day date primary key, salt text not null);
    create table if not exists imports (source text primary key, digest text not null, at timestamptz not null default now());`);
  await importNetlifyHistory();
}

// One-time carry-over of the counts recorded on Netlify before the move (data/netlify-history.json, the Netlify
// /api/stats?days=90 output). Each place-day is rebuilt as rows with stand-in visitor ids ("nf..."), so the same
// visitors and opens show here. Re-running with a newer export replaces the earlier carry-over.
async function importNetlifyHistory() {
  const file = new URL("../data/netlify-history.json", import.meta.url);
  let text; try { text = fs.readFileSync(file, "utf8"); } catch (e) { return; }
  const digest = crypto.createHash("sha256").update(text).digest("hex");
  const { rows } = await pool.query("select digest from imports where source = 'netlify'");
  if (rows[0] && rows[0].digest === digest) return;
  const days = JSON.parse(text).days || [], client = await pool.connect();
  let n = 0;
  try {
    await client.query("begin");
    await client.query("delete from visits where vid like 'nf%'");
    for (const d of days) for (const [cc, region, city, visitors, opens] of d.places || []) {
      for (let i = 0; i < opens; i++) {
        const vid = "nf" + sha256hex([d.date, cc, region, city, i % Math.max(1, visitors)].join("|")).slice(0, 14);
        await client.query("insert into visits (day, cc, region, city, vid, ts) values ($1, $2, $3, $4, $5, $1::date + time '12:00')", [d.date, cc, region || "", city || "", vid]);
        n++;
      }
    }
    await client.query("insert into imports (source, digest) values ('netlify', $1) on conflict (source) do update set digest = excluded.digest, at = now()", [digest]);
    await client.query("commit");
    console.log("carried over", n, "opens from Netlify");
  } catch (e) { await client.query("rollback"); throw e; } finally { client.release(); }
}

// today's salt: created once per UTC day (the insert settles a race between two first visits), older salts deleted
let saltCache = { day: "", salt: "" };
async function dailySalt(day) {
  if (saltCache.day === day) return saltCache.salt;
  const fresh = crypto.randomBytes(24).toString("hex");
  await pool.query("insert into salts (day, salt) values ($1, $2) on conflict (day) do nothing", [day, fresh]);
  const { rows } = await pool.query("select salt from salts where day = $1", [day]);
  await pool.query("delete from salts where day < $1", [day]);
  saltCache = { day, salt: rows[0].salt };
  return saltCache.salt;
}

// a single address cannot flood the counts: 30 opens a minute at most
const hits = new Map();
function limited(ip) {
  const now = Date.now(), w = hits.get(ip);
  if (!w || now - w.t > 60000) { hits.set(ip, { t: now, n: 1 }); return false; }
  return ++w.n > 30;
}
setInterval(() => { const now = Date.now(); for (const [k, w] of hits) if (now - w.t > 60000) hits.delete(k); }, 60000).unref();

const cors = (origin) => (origin && ORIGINS.includes(origin) ? { "access-control-allow-origin": origin, vary: "origin" } : {});
function send(res, status, body, headers = {}) {
  const json = body === undefined ? null : JSON.stringify(body);
  res.writeHead(status, { "cache-control": "no-store", ...(json ? { "content-type": "application/json" } : {}), ...headers });
  res.end(json);
}

// one guide open (kind "visits") or one Grid Runner run started (kind "plays"), same rules for both
async function hit(req, res, url, geo4, geo6, kind) {
  const ua = req.headers["user-agent"] || "", origin = req.headers.origin || "";
  // drain the tiny beacon body
  for await (const _ of req) { /* ignore */ }
  if (isBot(ua)) return send(res, 204, undefined, cors(origin));
  // only the guide's own pages may report opens
  if (origin && !ORIGINS.includes(origin)) return send(res, 403);
  const ip = clientIp(req.headers, req.socket.remoteAddress);
  if (limited(kind + "|" + ip)) return send(res, 429, undefined, cors(origin));
  const day = utcDay(), salt = await dailySalt(day);
  const vid = sha256hex(salt + "|" + ip + "|" + ua).slice(0, 16);
  let g = null; try { g = (ip.includes(":") ? geo6 : geo4).get(ip.replace(/^::ffff:/, "")); } catch (e) { g = null; }
  const p = place(g), test = url.searchParams.get("test") === "1";
  await pool.query(`insert into ${test ? kind + "_test" : kind} (day, cc, region, city, vid) values ($1, $2, $3, $4, $5)`, [day, p.cc, p.region, p.city, vid]);
  if (test) return send(res, 200, { stored: [day, p.cc, p.region, p.city] }, cors(origin));
  return send(res, 204, undefined, cors(origin));
}

async function stats(req, res, url) {
  const n = Math.min(MAX_DAYS, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));
  const test = url.searchParams.get("test") === "1", today = utcDay(), from = addDays(today, 1 - n);
  const { rows } = await pool.query(
    `select to_char(day, 'YYYY-MM-DD') as day, cc, region, city, vid from ${test ? "visits_test" : "visits"} where day >= $1 and day <= $2`, [from, today]);
  const byDay = new Map();
  for (const r of rows) { if (!byDay.has(r.day)) byDay.set(r.day, []); byDay.get(r.day).push(r); }
  const played = await pool.query(
    `select to_char(day, 'YYYY-MM-DD') as day, count(*) as plays, count(distinct vid) as players from ${test ? "plays_test" : "plays"} where day >= $1 and day <= $2 group by day`, [from, today]);
  const days = addPlays(Array.from({ length: n }, (_, i) => addDays(from, i)).map((d) => summarizeDay(d, byDay.get(d) || [])), played.rows);
  send(res, 200, { generated: new Date().toISOString(), timezone: "UTC", days }, { "access-control-allow-origin": "*", "cache-control": "public, max-age=30" });
}

let dbReady = false;
async function connectDb() {
  if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set: the API answers 503 until it is"); return; }
  for (let i = 0; !dbReady; i++) {
    try { await migrate(); dbReady = true; console.log("database ready"); }
    catch (e) { console.error("database not reachable yet:", String(e && e.message || e)); await new Promise((r) => setTimeout(r, Math.min(30000, 2000 * (i + 1)))); }
  }
}

async function main() {
  const [geo4, geo6] = await Promise.all([maxmind.open(geoDir + "dbip-city-ipv4.mmdb"), maxmind.open(geoDir + "dbip-city-ipv6.mmdb")]);
  connectDb();
  http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    try {
      if (req.method === "OPTIONS") return send(res, 204, undefined, { ...cors(req.headers.origin), "access-control-allow-methods": "GET, POST", "access-control-max-age": "86400" });
      if (url.pathname.startsWith("/api/") && !dbReady) return send(res, 503, { error: "stats database not ready" }, { "access-control-allow-origin": "*" });
      if (url.pathname === "/api/hit" && req.method === "POST") return await hit(req, res, url, geo4, geo6, "visits");
      if (url.pathname === "/api/play" && req.method === "POST") return await hit(req, res, url, geo4, geo6, "plays");
      if (url.pathname === "/api/stats" && req.method === "GET") return await stats(req, res, url);
      if (url.pathname === "/healthz") return send(res, 200, { ok: true, database: dbReady });
      return send(res, 404, { error: "not found" });
    } catch (e) {
      console.error("request failed", url.pathname, String(e && e.message || e));
      return send(res, 500, { error: "server error" });
    }
  }).listen(PORT, () => console.log("tg guide stats listening on", PORT, "origins", ORIGINS.join(" ") || "(none)"));
}
main().catch((e) => { console.error("startup failed", e); process.exit(1); });
