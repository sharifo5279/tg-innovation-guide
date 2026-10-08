// Privacy-friendly visit counting for the Innovation Guide (Render version).
//
// What is stored: one row per page open in Postgres table "visits": UTC day, country code, region, city and a visitor id.
// The visitor id is a 16-character hash of (today's random salt + IP address + browser user agent). The salt lives in
// table "salts" for one UTC day and is then deleted, so an id cannot be turned back into an IP address and the same
// person cannot be followed from one day to the next. No cookies, names, emails or IP addresses are stored.
import crypto from "node:crypto";

export const MAX_DAYS = 90;

// The page reports an open from script, so link unfurlers that never run script never count. This also drops crawlers,
// headless browsers and monitors that do run it.
const BOT = /bot|crawl|spider|slurp|headless|phantomjs|lighthouse|pingdom|uptime|monitor|preview|curl|wget|python-requests|go-http-client|node-fetch|axios/i;
export const isBot = (ua) => !ua || ua.length < 12 || BOT.test(ua);

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
export const addDays = (day, n) => { const d = new Date(day + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return utcDay(d); };
export const sha256hex = (text) => crypto.createHash("sha256").update(text).digest("hex");

// cleaned place fields: country is a two-letter code or XX, region and city at most 80 characters
export function place(g) {
  const cc = /^[A-Z]{2}$/.test(g?.country_code || "") ? g.country_code : "XX";
  const clip = (s) => String(s || "").trim().slice(0, 80);
  return { cc, region: clip(g?.state1), city: clip(g?.city) };
}

// rows for one day [{cc, region, city, vid}] -> { date, opens, visitors, places: [[country, region, city, visitors, opens]] }
export function summarizeDay(date, rows) {
  const vids = new Set(), places = new Map();
  for (const r of rows) {
    vids.add(r.vid);
    const k = r.cc + "|" + r.region + "|" + r.city;
    let p = places.get(k);
    if (!p) { p = { cc: r.cc, region: r.region, city: r.city, vids: new Set(), opens: 0 }; places.set(k, p); }
    p.opens++; p.vids.add(r.vid);
  }
  return {
    date, opens: rows.length, visitors: vids.size,
    places: [...places.values()].map((p) => [p.cc, p.region, p.city, p.vids.size, p.opens]).sort((a, b) => b[3] - a[3] || b[4] - a[4]),
  };
}

// the visitor's address: Render's proxy puts the client first in X-Forwarded-For
export function clientIp(headers, socketIp) {
  const pick = (h) => (h || "").split(",")[0].trim();
  return pick(headers["true-client-ip"]) || pick(headers["cf-connecting-ip"]) || pick(headers["x-forwarded-for"]) || socketIp || "";
}
