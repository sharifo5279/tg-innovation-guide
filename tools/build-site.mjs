// Build the Render static site from the guide's master page (the claude.ai artifact, staged in guide-live):
//   API_ORIGIN=https://tg-guide-stats.onrender.com node tools/build-site.mjs /path/to/master.html /path/to/image-root
// 1. site/index.html = the master page, footer stats link made relative, plus one small script that reports an open
//    to the stats service (skipped for automated browsers and for non-https pages).
// 2. site/img/... = every image the page references (src, data-src and CSS url()), copied from the image root.
// 3. site/stats/index.html = the stats page, reading from the stats service, with the guide's masthead logo.
// 4. site/play/index.html = Grid Runner, the Trading Grid game (game/gridrunner.html), plus one small script that
//    reports each run started to the stats service (same rules as the guide's open).
import fs from "node:fs";
import path from "node:path";
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

const BEACON =`<script>/* count one open of the guide: no cookies, see /stats/ */(function(){try{if(navigator.webdriver||location.protocol!=="https:")return;var u=${JSON.stringify(API + "/api/hit")},b=new Blob(["{}"],{type:"text/plain"});if(!(navigator.sendBeacon&&navigator.sendBeacon(u,b)))fetch(u,{method:"POST",body:"{}",keepalive:true,mode:"no-cors"});}catch(e){}})();</script>`;
const end = html.lastIndexOf("</body>");
if (end < 0) throw new Error("no </body> in master");
html = html.slice(0, end) + BEACON + html.slice(end);
fs.rmSync(path.join(ROOT, "site"), { recursive: true, force: true });
fs.mkdirSync(path.join(ROOT, "site/stats"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "site/index.html"), html);

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
console.log("site/index.html", (html.length / 1024).toFixed(0) + " KB;", refs.size, "images,", (bytes / 1048576).toFixed(1), "MB; stats page reads", API, "; Grid Runner at /play/");
