// Link preview cards for the guide (owner, Oct 10): the banner card for the guide itself, and a product-screen card for each
// product in the master's script#tg-share. 1200 x 630 JPEG under 300 KB (WhatsApp skips bigger images).
//   NODE_PATH=<global node_modules with playwright> node tools/share-cards/render.mjs /path/to/master.html /path/to/image-root
// Writes tools/share-cards/out/guide.jpg, out/<slug>.jpg and out/cards.json (which screenshots each card used).
// Re-run after a product's name, summary or first screenshots change, then rebuild the site (tools/build-site.mjs copies
// the cards and writes the share pages; the page text in each preview comes from the master on every build).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, "out");
const MASTER = process.argv[2], IMGDIR = path.resolve(process.argv[3] || path.dirname(MASTER || "."));
if (!MASTER) throw new Error("usage: render.mjs master.html image-root");
const FONT = [300, 400, 600, 700, 800].map((w) => `@font-face{font-family:Inter;font-weight:${w};src:url(${pathToFileURL(path.join(HERE, "fonts", `inter-latin-${w}-normal.woff2`)).href}) format("woff2")}`).join("");
const BASE = `${FONT}*{box-sizing:border-box;margin:0}html,body{width:1200px;height:630px;overflow:hidden}body{font-family:Inter,Arial,sans-serif;letter-spacing:-.011em;-webkit-font-smoothing:antialiased;position:relative}.lg{display:block;height:30px;width:auto}`;
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const brief = (t, max = 220) => { const ss = t.split(/(?<=[.!?])\s+/); let o = ""; for (const x of ss) { o = o ? o + " " + x : x; if (o.length >= 40) break; } return o.length > max ? o.slice(0, o.lastIndexOf(" ", max - 1)) + "…" : o; };

// Thumbnail-safe layout (owner, Oct 10, Teams screenshot: "in that square box, we need to have these items aligned to the
// left"). Teams cuts a box from the middle of the card, the full height and about 1.25 times as wide (x 205 to 995 of
// 1200); a square crop would be x 285 to 915. Everything that names the page is left-aligned from x 288, inside both, and
// nothing straddles their edges: no pillars on the banner, and the product screens enter from the right as one piece.
const L = 288;
// the guide: the page's own banner and title (owner's choice A)
function bannerCard(d) {
  const logo = d.logo.replace('class="logo"', 'class="lg"').replace('fill="#101C2F"', 'fill="#fff"');
  return `<style>${BASE}
body{color:#fff;background-color:#0022A8;background-image:radial-gradient(60% 90% at 92% 0%,rgba(0,102,255,.38) 0%,rgba(0,102,255,0) 70%),linear-gradient(115deg,#00008B 0%,#0022A8 52%,#0033CF 100%)}
.dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 1.4px,transparent 1.8px);background-size:30px 30px;background-position:15px 15px;-webkit-mask-image:linear-gradient(90deg,transparent 45%,#000 92%)}
.glow{position:absolute;top:-55%;right:-12%;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,rgba(0,102,255,.55) 0%,rgba(0,102,255,.16) 45%,rgba(0,102,255,0) 70%)}
.art{position:absolute;left:700px;top:392px;width:470px;-webkit-mask-image:linear-gradient(90deg,transparent 0%,#000 40%)}.art svg{display:block;width:100%;height:auto}.art .flow{display:none}
.c{position:absolute;left:${L}px;top:62px;bottom:58px;width:640px;display:flex;flex-direction:column;align-items:flex-start}
.lg{height:32px}
.mid{margin:auto 0}
.eb{display:flex;align-items:center;gap:14px;margin-bottom:18px;font:700 15px/18px Inter;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.9)}.eb::before{content:"";width:34px;height:3px;background:#fff}
.ar{font:600 38px/44px Inter;letter-spacing:-.015em}
h1{font:800 108px/104px Inter;letter-spacing:-.032em;margin:6px 0 12px}
.ed{font:300 50px/56px Inter;letter-spacing:-.02em;color:rgba(255,255,255,.92)}
</style><div class="glow"></div><div class="dots"></div><div class="art">${d.art.replace('class="art"', 'class="na"')}</div>
<div class="c">${logo}<div class="mid"><div class="eb">${esc(d.eyebrow)}</div><div class="ar">${esc(d.area)}</div><h1>${esc(d.h1).replace(" ", "<br>")}</h1><div class="ed">${esc(d.ed)}</div></div></div>`;
}

// a product: stage and name left-aligned in the middle box, its first screens entering from the right (owner's choice C)
function productCard(p, d) {
  const logo = d.logo.replace('class="logo"', 'class="lg"');
  const n = Math.min(3, p.screens.length);
  // front: the first screen (2px Electric Blue border); behind it, stepping up and right, the second and third
  const pos = n >= 3 ? [[752, 300, 540, 304], [792, 172, 520, 292], [832, 48, 500, 281]] : n === 2 ? [[752, 266, 560, 315], [812, 82, 540, 304]] : [[752, 116, 600, 400]];
  const shots = p.screens.slice(0, n).map((src, i) => { const [x, y, w, h] = pos[i]; return `<div class="shot${i === 0 ? " hero" : ""}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${5 - i}"><img src="${src}"></div>`; }).join("");
  const art = n === 0 ? `<div class="art">${d.art.replace('class="art"', 'class="na"').replace(/stroke="#fff"/g, 'stroke="#0066FF"').replace(/fill="#fff"/g, 'fill="#0066FF"')}</div>` : "";
  const stage = p.ga ? (p.status ? `<span class="st">${esc(p.status)}</span>` : `<span class="st ga">Generally available</span>`) : `<span class="k">Looking ahead</span>${p.status ? `<span class="st">${esc(p.status)}</span>` : ""}`;
  const w = n ? 430 : 600;
  return `<style>${BASE}
body{background:#F6F7F7;color:#3F4D62}
.c{position:absolute;left:${L}px;top:58px;bottom:54px;width:${w}px;display:flex;flex-direction:column;align-items:flex-start}
.mid{margin:auto 0}
.rule{width:96px;height:5px;background:#0066FF;margin-bottom:22px}
.eb{display:flex;align-items:center;gap:12px;font:700 15px/18px Inter;letter-spacing:.12em;text-transform:uppercase;margin-bottom:16px}
.eb .k{color:#3F4D62}.eb .st{display:inline-flex;align-items:center;gap:8px;color:#0066FF}.eb .st::before{content:"";width:9px;height:9px;border-radius:50%;background:currentColor}.eb .st.ga{color:#156615}
.fam{font:600 23px/29px Inter;color:#101C2F;letter-spacing:-.012em;margin-bottom:8px}
h1{color:#101C2F;font-weight:800;letter-spacing:-.028em;font-size:64px;line-height:1.05;width:${w}px}
.ft{font:600 17px/22px Inter;color:#3F4D62}
.shot{position:absolute;border-radius:10px;overflow:hidden;background:#fff;border:1px solid #E7EAEF;box-shadow:0 18px 40px rgba(16,28,47,.14),0 6px 12px rgba(16,28,47,.06)}
.shot.hero{border:2px solid #0066FF}
.shot img{display:block;width:100%;height:100%;object-fit:cover;object-position:left top}
.art{position:absolute;left:820px;top:236px;width:360px;opacity:.85}.art svg{display:block;width:100%;height:auto}.art .flow{display:none}
</style>${shots}${art}<div class="c">${logo}<div class="mid"><div class="rule"></div><div class="eb">${stage}</div>${p.family ? `<div class="fam">${esc(p.family)}</div>` : ""}<h1>${esc(p.name)}</h1></div><div class="ft">Trading Grid Innovation Guide · H2 2026</div></div>
<script>window.fit=function(){var h=document.querySelector('h1'),f=64,lh=1.05,room=document.querySelector('.c').getBoundingClientRect().height-32-22-60;
function lines(){return Math.round(h.getBoundingClientRect().height/(f*lh));}
while(f>40&&(lines()>3||h.scrollWidth>h.clientWidth+1||document.querySelector('.mid').getBoundingClientRect().height>room)){f-=2;h.style.fontSize=f+'px';}};</script>`;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "share-cards-"));
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.route(/^https?:/, (r) => r.abort());
const page = await ctx.newPage();
let master = fs.readFileSync(MASTER, "utf8");
master = master.replace("<head>", `<head><base href="${pathToFileURL(IMGDIR).href}/">`);
const mf = path.join(tmp, "master.html"); fs.writeFileSync(mf, master);
await page.goto(pathToFileURL(mf).href, { waitUntil: "domcontentloaded" });
const data = await page.evaluate(() => {
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const cfg = JSON.parse(document.getElementById("tg-share").textContent);
  const abs = (im) => im.getAttribute("src") && new URL(im.getAttribute("src"), document.baseURI).href;
  const big = (im) => !(+im.getAttribute("width") > 0 && +im.getAttribute("width") < 800);
  const d = {
    logo: document.querySelector(".mast svg.logo").outerHTML, art: document.querySelector(".hero svg.art").outerHTML,
    eyebrow: txt(document.querySelector(".hero .eyebrow")).replace(/^OpenText\s+/i, ""), area: txt(document.querySelector(".hero .hz-area")), h1: txt(document.querySelector(".hero h1")), ed: txt(document.querySelector(".hero .hz-ed")),
    pillars: [...document.querySelectorAll(".hero .roles a")].map(txt), products: [],
  };
  for (const [id, slug] of Object.entries(cfg.products)) {
    const el = document.getElementById(id), ga = el.tagName === "SECTION";
    let screens = [];
    if (ga) { for (const a of el.querySelectorAll("article.inn")) { const im = [...a.querySelectorAll("figure img")].find(big); if (im && !screens.includes(abs(im))) screens.push(abs(im)); if (screens.length === 3) break; } }
    else screens = [...new Set([...el.querySelectorAll("figure img")].filter(big).map(abs))].slice(0, 3);
    const name = txt(el.querySelector(ga ? "h2" : "h3")), fam = ga ? "" : txt(el.querySelector(".lbl"));
    d.products.push({ id, slug, ga, name, family: fam && fam !== name ? fam : "", status: txt(el.querySelector(ga ? "article.inn .ttl .ga.pv" : ".ttl .ga.pv")), sum: txt(el.querySelector(ga ? ".sec-sum" : ".deck")), screens: screens.filter(Boolean) });
  }
  return d;
});
fs.mkdirSync(OUT, { recursive: true });
async function shoot(name, html) {
  const f = path.join(tmp, name + ".html"); fs.writeFileSync(f, "<!doctype html><meta charset=utf-8>" + html);
  const p = await ctx.newPage(); await p.setViewportSize({ width: 1200, height: 630 });
  await p.goto(pathToFileURL(f).href); await p.evaluate(async () => { await document.fonts.ready; if (window.fit) window.fit(); });
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  await p.waitForTimeout(100);
  const missing = await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.src));
  if (missing.length) throw new Error(name + ": images did not load: " + missing.join(", "));
  let q = 86, buf; do { buf = await p.screenshot({ type: "jpeg", quality: q }); q -= 6; } while (buf.length > 290 * 1024 && q >= 56);
  fs.writeFileSync(path.join(OUT, name + ".jpg"), buf); await p.close();
  return Math.round(buf.length / 1024);
}
const log = { guide: await shoot("guide", bannerCard(data)) + " KB" }, used = {};
for (const p of data.products) {
  p.desc = brief(p.sum);
  log[p.slug] = (await shoot(p.slug, productCard(p, data))) + " KB, " + p.screens.length + " screens";
  used[p.slug] = { id: p.id, name: p.name, screens: p.screens.map((s) => s.replace(/^.*\/img\//, "img/")) };
}
fs.writeFileSync(path.join(OUT, "cards.json"), JSON.stringify(used, null, 1) + "\n");
await b.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log(log);
