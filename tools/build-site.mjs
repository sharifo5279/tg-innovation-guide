// Build the Render static site from the guide's master page (the claude.ai artifact, staged in guide-live):
//   API_ORIGIN=https://tg-guide-stats.onrender.com node tools/build-site.mjs /path/to/master.html /path/to/image-root
// 1. site/index.html = the master page, footer stats link made relative, plus one small script that reports an open
//    to the stats service (skipped for automated browsers and for non-https pages).
// 2. site/img/... = every image the page references (src, data-src and CSS url()), copied from the image root.
// 3. site/stats/index.html = the stats page, reading from the stats service, with the guide's masthead logo.
//    The guide also reports product events (viewed, used, opened at by a link) for each product in script#tg-share, and
//    the stats page gets the same product list, in page order, to report them by product.
// 4. site/play/index.html = Grid Runner, the Trading Grid game (game/gridrunner.html), plus one small script that
//    reports each run started to the stats service (same rules as the guide's open).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MASTER = process.argv[2] || "/home/claude/guide-live/publish-index.html";
const IMGDIR = process.argv[3] || "/home/claude/guide-live";
const API = (process.env.API_ORIGIN || "").replace(/\/$/, "");
if (!/^https:\/\//.test(API)) throw new Error("set API_ORIGIN to the stats service's https origin");
let html = fs.readFileSync(MASTER, "utf8");

// the footer link may point at any earlier host's /stats/; on this site it is relative
const STATS = /https:\/\/[a-z0-9.-]+\/stats\//g;
if (!STATS.test(html)) throw new Error("footer stats link missing from the master");
html = html.replace(STATS, "/stats/");
// the footer's Grid Runner link likewise
html = html.replace(/https:\/\/[a-z0-9.-]+\/play\//g, "/play/");

// favicon (ot mark): the master carries its links after the title, inside <body>; on this site they go in <head>
const FAV = html.match(/<!--fav-->[\s\S]*?<!--\/fav-->/);
if (FAV) {
  html = html.replace(FAV[0], "");
  const h = html.indexOf("<head>");
  if (h < 0) throw new Error("no <head> in master");
  html = html.slice(0, h + 6) + FAV[0] + html.slice(h + 6);
}

// Link previews (owner, Oct 10). Messages, Teams, WhatsApp and LinkedIn read only <head>, and with no tags there they showed
// the first screenshot on the page. The guide gets the banner card; each product listed in the master's script#tg-share gets
// a share page /s/<slug>/ with its own product-screen card, which forwards readers to the product in the guide (crawlers
// do not run scripts, and the preview robots that do are let through). Cards come from tools/share-cards/out (rendered by
// tools/share-cards/render.mjs); a product without a card yet uses the banner card. Titles and descriptions are read from
// the master on every build, so they follow the page.
const CARDS = path.join(ROOT, "tools/share-cards/out");
const ent = (t) => t.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&#8217;/g, "’").replace(/\s+/g, " ").trim();
const attr = (t) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
function brief(t, max = 220) { const ss = t.split(/(?<=[.!?])\s+/); let o = ""; for (const x of ss) { o = o ? o + " " + x : x; if (o.length >= 40) break; } if (o.length > max) o = o.slice(0, o.lastIndexOf(" ", max - 1)) + "…"; return o; }
const cfgM = html.match(/<script type="application\/json" id="tg-share">([\s\S]*?)<\/script>/);
const SHARE = cfgM ? JSON.parse(cfgM[1]) : null;
const SITE = SHARE ? String(SHARE.site).replace(/\/$/, "") : "";
const GUIDE = "Trading Grid Innovation Guide H2 2026";
const GUIDE_DESC = "What’s generally available across Trading Grid in H2 2026, scenarios that show it working together, and where each pillar is heading.";
function cardUrl(slug) { const f = path.join(CARDS, slug + ".jpg"); if (!fs.existsSync(f)) return null; const v = crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex").slice(0, 8); return `${SITE}/share/${slug}.jpg?v=${v}`; }
function tags(t, d, url, img, alt) {
  return [`<meta name="description" content="${attr(d)}">`, `<meta property="og:type" content="website">`, `<meta property="og:site_name" content="Trading Grid Innovation Guide">`,
    `<meta property="og:title" content="${attr(t)}">`, `<meta property="og:description" content="${attr(d)}">`, `<meta property="og:url" content="${attr(url)}">`,
    ...(img ? [`<meta property="og:image" content="${attr(img)}">`, `<meta property="og:image:type" content="image/jpeg">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`, `<meta property="og:image:alt" content="${attr(alt)}">`] : []),
    `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">`, `<meta name="twitter:title" content="${attr(t)}">`, `<meta name="twitter:description" content="${attr(d)}">`, ...(img ? [`<meta name="twitter:image" content="${attr(img)}">`] : [])].join("");
}
// one product's name, status and summary, read from the master
function product(id) {
  const i = html.indexOf(`id="${id}"`); if (i < 0) return null;
  const open = html.lastIndexOf("<", i), tag = html.slice(open + 1, html.indexOf(" ", open));
  if (tag === "section") {
    const stop = html.indexOf("<section", i + 1), part = html.slice(i, stop > 0 ? stop : undefined);
    const h = part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/), sm = part.match(/<p class="sec-sum">([\s\S]*?)<\/p>/);
    const pv = part.match(/<span class="ga pv">([\s\S]*?)<\/span>/), name = h ? ent(h[1]) : id; return { name, title: name, desc: (pv ? ent(pv[1]) : "Generally available") + ". " + brief(sm ? ent(sm[1]) : GUIDE_DESC) };
  }
  const part = html.slice(i, html.indexOf("</article>", i));
  const lb = part.match(/<div class="label lbl">([\s\S]*?)<\/div>/), h = part.match(/<h3[^>]*>([\s\S]*?)<\/h3>/), st = part.match(/<span class="ga pv">([\s\S]*?)<\/span>/), dk = part.match(/<p class="deck">([\s\S]*?)<\/p>/);
  const name = h ? ent(h[1]) : id, lbl = lb ? ent(lb[1]) : "";
  return { name, title: lbl && lbl !== name ? (lbl.includes(name) ? lbl : `${lbl}: ${name}`) : name, desc: "Looking ahead" + (st ? ", " + ent(st[1]) : "") + ". " + brief(dk ? ent(dk[1]) : GUIDE_DESC) };
}
const sharePages = [];
if (SHARE) {
  // the master's title sits in <body>; previews read it from <head>
  const T = html.match(/<title>[\s\S]*?<\/title>/); if (T) html = html.replace(T[0], "");
  const img = cardUrl("guide");
  // after the charset and viewport lines, so the charset stays within the first 1024 bytes
  const hd = html.indexOf("<head>"), vp = html.slice(hd).match(/<meta name=["']?viewport[^>]*>/), h = vp ? hd + vp.index + vp[0].length - 6 : hd;
  html = html.slice(0, h + 6) + `<title>${GUIDE}</title>` + tags(GUIDE, GUIDE_DESC, SITE + "/", img, "Trading Grid Innovation Guide H2 2026, from OpenText Business Network: Data Visibility and Intelligence, Intelligent Process Applications, Trading Grid Aviator, Ecosystem and Portal") + html.slice(h + 6);
  for (const [id, slug] of Object.entries(SHARE.products)) {
    const p = product(id); if (!p) throw new Error("share product not in the master: " + id);
    const own = cardUrl(slug), url = `${SITE}/s/${slug}/`, title = `${p.title} · ${GUIDE}`;
    if (!own) console.warn("share card missing for " + slug + ", using the banner card");
    const fav = FAV ? FAV[0].replace(/href="img\//g, 'href="/img/') : "";
    const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${fav}<title>${attr(title)}</title>${tags(title, p.desc, url, own || img, `${p.title}, in the ${GUIDE}`)}<meta name="robots" content="noindex">
<script>(function(){var u=navigator.userAgent||"";if(/bot|crawler|spider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|Slackbot|TelegramBot|Discordbot|SkypeUriPreview|MicrosoftPreview|Iframely|Embedly|redditbot|Pinterest|Applebot/i.test(u))return;var h=location.hash&&location.hash.length>1?location.hash:${JSON.stringify("#" + id)};location.replace("/"+h);})();</script>
<style>body{margin:0;padding:48px 24px;font:400 16px/24px Inter,-apple-system,"Segoe UI",Arial,sans-serif;color:#3F4D62;background:#fff}a{color:#0066FF;font-weight:700}</style></head>
<body><p>Opening <a href="/#${attr(id)}">${attr(p.title)}</a> in the ${GUIDE}.</p></body></html>`;
    sharePages.push([slug, page]);
  }
}

const BEACON =`<script>/* count one open of the guide: no cookies, see /stats/ */(function(){try{if(navigator.webdriver||location.protocol!=="https:")return;var u=${JSON.stringify(API + "/api/hit")},b=new Blob(["{}"],{type:"text/plain"});if(!(navigator.sendBeacon&&navigator.sendBeacon(u,b)))fetch(u,{method:"POST",body:"{}",keepalive:true,mode:"no-cors"});}catch(e){}})();</script>`;
// Product analytics (owner, Oct 18). Each product in script#tg-share reports, at most once per open of the guide:
// "view" after 3 seconds in the middle band of the screen, "act" when a screenshot, link or control inside it is used, and
// "link" when the guide opens at it (a shared or direct link). Nothing is reported while presenting (slide show, kiosk) or
// in the capability peek. The stats page lists the same products, Generally available and Looking ahead, in page order.
const REG = [];
if (SHARE) {
  for (const id of Object.keys(SHARE.products)) {
    const i = html.indexOf(`id="${id}"`), open = html.lastIndexOf("<", i), tag = html.slice(open + 1, html.indexOf(" ", open));
    if (tag === "section") {
      const h = html.slice(i, html.indexOf("</h2>", i)).match(/<h2[^>]*>([\s\S]*)/);
      REG.push({ id, n: h ? ent(h[1]) : id, g: "ga", at: i });
    } else {
      const part = html.slice(i, html.indexOf("</article>", i));
      const lb = part.match(/<div class="label lbl">([\s\S]*?)<\/div>/), h = part.match(/<h3[^>]*>([\s\S]*?)<\/h3>/), st = part.match(/<span class="ga pv">([\s\S]*?)<\/span>/);
      const n = lb ? ent(lb[1]) : h ? ent(h[1]) : id, t = h ? ent(h[1]) : "";
      REG.push({ id, n, d: t && t !== n ? t : "", s: st ? ent(st[1]) : "", g: "la", at: i });
    }
  }
  REG.sort((a, b) => a.at - b.at).forEach((r) => delete r.at);
}
const TRACK = REG.length ? `<script>/* product views and interactions: no cookies, see /stats/ */(function(){try{if(navigator.webdriver||location.protocol!=="https:"||!window.IntersectionObserver)return;
var U=${JSON.stringify(API + "/api/event")},IDS=${JSON.stringify(REG.map((r) => r.id))},sent={},tm={},on={},de=document.documentElement;
function send(p,k){if(sent[p+k])return;sent[p+k]=1;var d=JSON.stringify({p:p,k:k});try{if(!(navigator.sendBeacon&&navigator.sendBeacon(U,new Blob([d],{type:"text/plain"}))))fetch(U,{method:"POST",body:d,keepalive:true,mode:"no-cors"});}catch(e){}}
function own(n){for(;n&&n.nodeType===1;n=n.parentNode)if(n.id&&IDS.indexOf(n.id)>=0)return n.id;return null;}
function busy(){return de.classList.contains("ss-on")||de.classList.contains("pk-on")||document.visibilityState!=="visible";}
function arm(id){clearTimeout(tm[id]);tm[id]=setTimeout(function(){if(!on[id])return;if(busy())arm(id);else send(id,"view");},3000);}
var io=new IntersectionObserver(function(es){es.forEach(function(e){var id=e.target.id;on[id]=e.isIntersecting;if(sent[id+"view"])return;if(on[id])arm(id);else clearTimeout(tm[id]);});},{rootMargin:"-30% 0px -30% 0px",threshold:0});
IDS.forEach(function(id){var n=document.getElementById(id);if(n)io.observe(n);});
document.addEventListener("click",function(e){var t=e.target&&e.target.closest&&e.target.closest("a,button,summary,img,video,[role=button]");var id=t&&own(t);if(id)send(id,"act");},true);
var h=location.hash.slice(1);if(h){try{h=decodeURIComponent(h);}catch(e){}var id=own(document.getElementById(h));if(id)send(id,"link");}
}catch(e){}})();</script>` : "";
const end = html.lastIndexOf("</body>");
if (end < 0) throw new Error("no </body> in master");
html = html.slice(0, end) + BEACON + TRACK + html.slice(end);
fs.rmSync(path.join(ROOT, "site"), { recursive: true, force: true });
fs.mkdirSync(path.join(ROOT, "site/stats"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "site/index.html"), html);
// share cards and share pages
if (SHARE) {
  if (fs.existsSync(CARDS)) { fs.mkdirSync(path.join(ROOT, "site/share"), { recursive: true }); for (const f of fs.readdirSync(CARDS)) if (f.endsWith(".jpg")) fs.copyFileSync(path.join(CARDS, f), path.join(ROOT, "site/share", f)); }
  for (const [slug, page] of sharePages) { fs.mkdirSync(path.join(ROOT, "site/s", slug), { recursive: true }); fs.writeFileSync(path.join(ROOT, "site/s", slug, "index.html"), page); }
}

const refs = new Set([...html.matchAll(/(?:src|data-src)="(img\/[^"]+)"/g), ...html.matchAll(/url\((img\/[^)]+)\)/g), ...html.matchAll(/<link [^>]*href="(img\/[^"]+)"/g)].map((m) => m[1]));
let bytes = 0;
for (const r of refs) {
  const from = path.join(IMGDIR, r), to = path.join(ROOT, "site", r);
  if (!fs.existsSync(from)) throw new Error("missing image " + r);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to); bytes += fs.statSync(to).size;
}

const m = html.match(/<header class="mast"><div class="wrap">(<svg class="logo"[\s\S]*?<\/svg>)/);
if (!m) throw new Error("masthead logo not found");
let st = fs.readFileSync(path.join(ROOT, "tools/stats-template.html"), "utf8").split("__API__").join(API);
if (!st.includes("__PRODUCTS__")) throw new Error("stats template has no product list placeholder");
st = st.split("__PRODUCTS__").join(JSON.stringify(REG).replace(/</g, "\\u003c"));
st = st.replace(/<!--LOGO-->[\s\S]*?<!--\/LOGO-->/, `<!--LOGO-->${m[1]}<!--/LOGO-->`);
if (FAV) {
  // the same icons on the stats page (absolute paths), and /favicon.ico at the site root for browsers that ask for it
  st = st.replace("<head>", "<head>" + FAV[0].replace(/href="img\//g, 'href="/img/'));
  const ico = path.join(IMGDIR, "img/favicon/favicon.ico");
  if (fs.existsSync(ico)) fs.copyFileSync(ico, path.join(ROOT, "site/favicon.ico"));
}
fs.writeFileSync(path.join(ROOT, "site/stats/index.html"), st);

// Grid Runner: startRun() calls window.grPlayed when it exists
let game = fs.readFileSync(path.join(ROOT, "game/gridrunner.html"), "utf8");
if (!game.includes("window.grPlayed")) throw new Error("game/gridrunner.html has no play hook");
const PLAYED = `<script>/* count one Grid Runner run: no cookies, see /stats/ */window.grPlayed=function(){try{if(navigator.webdriver||location.protocol!=="https:")return;var u=${JSON.stringify(API + "/api/play")},b=new Blob(["{}"],{type:"text/plain"});if(!(navigator.sendBeacon&&navigator.sendBeacon(u,b)))fetch(u,{method:"POST",body:"{}",keepalive:true,mode:"no-cors"});}catch(e){}};</script>`;
const gh = game.indexOf("</head>");
if (gh < 0) throw new Error("no </head> in game");
game = game.slice(0, gh) + PLAYED + game.slice(gh);
fs.mkdirSync(path.join(ROOT, "site/play"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "site/play/index.html"), game);

// Clickable prototypes (owner, Oct 14): each folder in prototypes/ is published as-is at /<folder>/
const PROTO = path.join(ROOT, "prototypes");
if (fs.existsSync(PROTO)) for (const d of fs.readdirSync(PROTO)) {
  const to = path.join(ROOT, "site", d);
  if (fs.existsSync(to)) throw new Error("prototype folder clashes with the site: " + d);
  fs.cpSync(path.join(PROTO, d), to, { recursive: true });
}
console.log("site/index.html", (html.length / 1024).toFixed(0) + " KB;", refs.size, "images,", (bytes / 1048576).toFixed(1), "MB; stats page reads", API, "; Grid Runner at /play/");
