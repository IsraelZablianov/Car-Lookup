# Car Lookup Skill Implementation Plan

> Historical Claude v1 implementation plan, not an active task list. Current
> instructions are in `AGENTS.md` and `.agents/skills/car-lookup/SKILL.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/car-lookup` Claude Code skill that scrapes Yad2 and Facebook Marketplace for all matching used-car listings, visits each listing for km data, scores them by km/year ratio, and outputs a sortable interactive Hebrew HTML dashboard.

**Architecture:** A single skill markdown file (`~/.claude/skills/car-lookup.md`) contains all instructions, lookup tables, and JS snippets that Claude follows step-by-step when invoked. A standalone HTML template with embedded JS (no external deps) is generated per search run and written to the `results/` folder. All scraping uses the `mcp__playwright-extension__*` tools already available in Claude Code.

**Tech Stack:** Claude Code skill (markdown), Playwright MCP extension, vanilla HTML/CSS/JS (RTL), Node.js Bash for file ops.

**Spec:** `docs/superpowers/specs/2026-09-01-car-lookup-skill-design.md`

---

## File Map

| File | Purpose |
|---|---|
| `~/.claude/skills/car-lookup.md` | The skill file Claude reads when `/car-lookup` is invoked |
| `~/Documents/dev/AI/Car-Lookup/template/results.html` | Reference HTML template (embedded inline in skill) |
| `~/Documents/dev/AI/Car-Lookup/results/*.html` | Per-run output files |
| `~/Documents/dev/AI/Car-Lookup/.gitignore` | Ignore generated results |

---

## Task 1: Project Scaffold

**Files:**
- Create: `~/Documents/dev/AI/Car-Lookup/.gitignore`

- [ ] **Step 1: Create .gitignore**

```
results/*.html
.playwright-mcp/
```

- [ ] **Step 2: Commit**

```bash
cd ~/Documents/dev/AI/Car-Lookup
git add .gitignore docs/
git commit -m "chore: scaffold car-lookup project structure and design spec"
```

---

## Task 2: HTML Template

Build and verify the interactive results HTML template. This is the output format; building it first means the skill just needs to fill in the data.

**Files:**
- Create: `~/Documents/dev/AI/Car-Lookup/template/results.html`

- [ ] **Step 1: Create the template file**

Write `~/Documents/dev/AI/Car-Lookup/template/results.html` with the complete content below. This file uses placeholder `__DATA__` which gets replaced with a JSON array at skill runtime.

```html
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title id="page-title">חיפוש רכב</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; color: #222; direction: rtl; }
  #header { background: #1a1a2e; color: #fff; padding: 20px 24px; }
  #header h1 { font-size: 1.6rem; margin-bottom: 6px; }
  #header .meta { font-size: 0.85rem; color: #aab; }
  #filter-bar { background: #fff; border-bottom: 1px solid #ddd; padding: 12px 20px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .filter-group { display: flex; gap: 6px; align-items: center; }
  .filter-group label { font-size: 0.8rem; color: #666; font-weight: 600; }
  .chip { border: 1.5px solid #bbb; border-radius: 16px; padding: 4px 14px; font-size: 0.8rem; cursor: pointer; background: #fff; transition: all .15s; }
  .chip.active { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
  #stats-bar { padding: 10px 20px; background: #eef; font-size: 0.85rem; color: #334; }
  .container { padding: 16px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
  thead { background: #1a1a2e; color: #fff; }
  th { padding: 12px 10px; text-align: right; white-space: nowrap; cursor: pointer; user-select: none; font-size: 0.85rem; }
  th:hover { background: #2a2a4e; }
  th.sorted-asc::after { content: ' ▲'; }
  th.sorted-desc::after { content: ' ▼'; }
  td { padding: 10px 10px; border-bottom: 1px solid #eee; font-size: 0.87rem; vertical-align: middle; }
  tr:hover td { background: #f0f4ff; }
  tr.expanded td { background: #fafafa; }
  .score-excellent { background: #d4edda; color: #155724; border-radius: 4px; padding: 2px 8px; font-weight: 700; white-space: nowrap; }
  .score-good { background: #e8f5e0; color: #2d6a2d; border-radius: 4px; padding: 2px 8px; font-weight: 700; white-space: nowrap; }
  .score-average { background: #fff3cd; color: #856404; border-radius: 4px; padding: 2px 8px; font-weight: 700; white-space: nowrap; }
  .score-high { background: #f8d7da; color: #721c24; border-radius: 4px; padding: 2px 8px; font-weight: 700; white-space: nowrap; }
  .score-na { background: #e2e3e5; color: #383d41; border-radius: 4px; padding: 2px 8px; white-space: nowrap; }
  .src-yad2 { color: #e44d26; font-weight: 700; font-size: 0.8rem; }
  .src-facebook { color: #1877f2; font-weight: 700; font-size: 0.8rem; }
  .link-btn { display: inline-block; background: #1a1a2e; color: #fff; padding: 4px 10px; border-radius: 4px; text-decoration: none; font-size: 0.8rem; white-space: nowrap; }
  .link-btn:hover { background: #2a2a5e; }
  .detail-row td { padding: 8px 16px; background: #f9f9f9; font-size: 0.82rem; color: #555; border-bottom: 2px solid #ddd; }
  .hidden { display: none !important; }
  #no-results { text-align: center; padding: 40px; color: #888; font-size: 1rem; }
  .price-cell { font-weight: 700; color: #1a1a2e; white-space: nowrap; }
  .km-cell { white-space: nowrap; }
</style>
</head>
<body>

<div id="header">
  <h1 id="main-title">טוען...</h1>
  <div class="meta" id="search-meta"></div>
  <div class="meta" id="gen-time"></div>
</div>

<div id="filter-bar">
  <div class="filter-group">
    <label>מקור:</label>
    <button class="chip active" data-filter="source" data-val="all" onclick="setFilter('source','all',this)">הכל</button>
    <button class="chip" data-filter="source" data-val="yad2" onclick="setFilter('source','yad2',this)">יד2</button>
    <button class="chip" data-filter="source" data-val="facebook" onclick="setFilter('source','facebook',this)">פייסבוק</button>
  </div>
  <div class="filter-group">
    <label>יד:</label>
    <button class="chip active" data-filter="hand" data-val="all" onclick="setFilter('hand','all',this)">הכל</button>
    <button class="chip" data-filter="hand" data-val="1" onclick="setFilter('hand','1',this)">יד 1</button>
    <button class="chip" data-filter="hand" data-val="2" onclick="setFilter('hand','2',this)">יד 2</button>
    <button class="chip" data-filter="hand" data-val="3+" onclick="setFilter('hand','3+',this)">יד 3+</button>
  </div>
  <div class="filter-group">
    <label>ניקוד:</label>
    <button class="chip active" data-filter="score" data-val="all" onclick="setFilter('score','all',this)">הכל</button>
    <button class="chip" data-filter="score" data-val="excellent" onclick="setFilter('score','excellent',this)">מצוין</button>
    <button class="chip" data-filter="score" data-val="good" onclick="setFilter('score','good',this)">טוב</button>
    <button class="chip" data-filter="score" data-val="average" onclick="setFilter('score','average',this)">ממוצע</button>
    <button class="chip" data-filter="score" data-val="high" onclick="setFilter('score','high',this)">גבוה</button>
  </div>
</div>

<div id="stats-bar"></div>

<div class="container">
  <table id="results-table">
    <thead>
      <tr>
        <th onclick="sortBy('source')">מקור</th>
        <th onclick="sortBy('seller')">מוכר</th>
        <th onclick="sortBy('model')">דגם</th>
        <th onclick="sortBy('year')">שנה</th>
        <th onclick="sortBy('hand')">יד</th>
        <th onclick="sortBy('km')" class="km-cell">ק"מ</th>
        <th onclick="sortBy('kmPerYear')">ק"מ/שנה</th>
        <th onclick="sortBy('scoreCat')">ניקוד</th>
        <th onclick="sortBy('engine')">מנוע</th>
        <th onclick="sortBy('price')">מחיר ₪</th>
        <th>קישור</th>
      </tr>
    </thead>
    <tbody id="table-body"></tbody>
  </table>
  <div id="no-results" class="hidden">אין תוצאות תואמות לסינון הנוכחי</div>
</div>

<script>
const LISTINGS = __DATA__;
const META = __META__;

// ── State ───────────────────────────────────────────────────────────────────
const filters = { source: 'all', hand: 'all', score: 'all' };
let sortKey = 'kmPerYear';
let sortDir = 1; // 1=asc, -1=desc
const expandedRows = new Set();

// ── Init ────────────────────────────────────────────────────────────────────
document.title = `חיפוש: ${META.make} ${META.model}`;
document.getElementById('main-title').textContent = `חיפוש: ${META.make} ${META.model}`;
document.getElementById('search-meta').textContent =
  `מחיר: ${META.priceMin.toLocaleString()}–${META.priceMax.toLocaleString()} ₪  |  שנים: ${META.yearMin}–${META.yearMax}  |  ק"מ עד: ${META.kmMax.toLocaleString()}  |  מנוע: ${META.engine || 'כל הנפחים'}`;
document.getElementById('gen-time').textContent = `נוצר: ${META.generatedAt}`;

render();

// ── Helpers ─────────────────────────────────────────────────────────────────
function scoreCategory(kmPerYear) {
  if (kmPerYear === null || kmPerYear === undefined || isNaN(kmPerYear)) return 'na';
  if (kmPerYear <= 10000) return 'excellent';
  if (kmPerYear <= 15000) return 'good';
  if (kmPerYear <= 20000) return 'average';
  return 'high';
}

function scoreLabel(cat) {
  return { excellent: 'מצוין ⭐', good: 'טוב ✓', average: 'ממוצע ~', high: 'גבוה ⚠', na: 'N/A' }[cat];
}

function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('he-IL');
}

function handLabel(h) {
  if (!h) return '—';
  const m = { 1: 'ראשונה', 2: 'שנייה', 3: 'שלישית', 4: 'רביעית' };
  return m[h] ? `יד ${m[h]}` : `יד ${h}`;
}

// ── Filtering ───────────────────────────────────────────────────────────────
function setFilter(key, val, el) {
  filters[key] = val;
  el.closest('.filter-group').querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  render();
}

function passesFilter(item) {
  const cat = scoreCategory(item.kmPerYear);
  if (filters.source !== 'all' && item.source !== filters.source) return false;
  if (filters.hand !== 'all') {
    if (filters.hand === '3+') { if (!item.hand || item.hand < 3) return false; }
    else { if (String(item.hand) !== filters.hand) return false; }
  }
  if (filters.score !== 'all' && cat !== filters.score) return false;
  return true;
}

// ── Sorting ──────────────────────────────────────────────────────────────────
function sortBy(key) {
  if (sortKey === key) sortDir *= -1;
  else { sortKey = key; sortDir = 1; }
  document.querySelectorAll('th').forEach(th => th.classList.remove('sorted-asc','sorted-desc'));
  const thIdx = ['source','seller','model','year','hand','km','kmPerYear','scoreCat','engine','price'].indexOf(key);
  if (thIdx >= 0) {
    const th = document.querySelectorAll('thead th')[thIdx];
    th.classList.add(sortDir === 1 ? 'sorted-asc' : 'sorted-desc');
  }
  render();
}

function cmpVal(item, key) {
  if (key === 'scoreCat') return scoreCategory(item.kmPerYear) === 'na' ? 9 : ['excellent','good','average','high'].indexOf(scoreCategory(item.kmPerYear));
  const v = item[key];
  if (v === null || v === undefined || v === '') return sortDir === 1 ? Infinity : -Infinity;
  return typeof v === 'string' ? v : Number(v);
}

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  const visible = LISTINGS.filter(passesFilter);
  visible.sort((a, b) => {
    const av = cmpVal(a, sortKey), bv = cmpVal(b, sortKey);
    if (av === bv) return 0;
    if (typeof av === 'string') return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });

  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  visible.forEach((item, idx) => {
    const cat = scoreCategory(item.kmPerYear);
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    tr.onclick = () => toggleDetail(item.href, idx);
    tr.innerHTML = `
      <td><span class="src-${item.source}">${item.source === 'yad2' ? 'יד2' : 'FB'}</span></td>
      <td>${item.seller || '—'}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${item.model || ''}">${item.model || '—'}</td>
      <td>${item.year || '—'}</td>
      <td>${handLabel(item.hand)}</td>
      <td class="km-cell">${fmtNum(item.km)}</td>
      <td class="km-cell">${fmtNum(item.kmPerYear)}</td>
      <td><span class="score-${cat}">${scoreLabel(cat)}</span></td>
      <td>${item.engine || '—'}</td>
      <td class="price-cell">${fmtNum(item.price)}</td>
      <td><a class="link-btn" href="${item.href}" target="_blank" onclick="event.stopPropagation()">פתח מודעה</a></td>`;
    tbody.appendChild(tr);

    // Detail row (hidden by default)
    const detailTr = document.createElement('tr');
    detailTr.className = 'detail-row hidden';
    detailTr.id = `detail-${idx}`;
    detailTr.innerHTML = `<td colspan="11">${item.location ? '<strong>מיקום:</strong> ' + item.location + '  |  ' : ''}${item.description ? '<strong>תיאור:</strong> ' + item.description.substring(0, 300) : ''}</td>`;
    tbody.appendChild(detailTr);
  });

  const noRes = document.getElementById('no-results');
  noRes.classList.toggle('hidden', visible.length > 0);

  const stats = document.getElementById('stats-bar');
  const yad2Count = visible.filter(i => i.source === 'yad2').length;
  const fbCount = visible.filter(i => i.source === 'facebook').length;
  stats.textContent = `מוצגות ${visible.length} מתוך ${LISTINGS.length} מודעות  |  יד2: ${yad2Count}  |  פייסבוק: ${fbCount}`;
}

function toggleDetail(href, idx) {
  const row = document.getElementById(`detail-${idx}`);
  if (row) row.classList.toggle('hidden');
}
</script>
</body>
</html>
```

- [ ] **Step 2: Verify template visually**

Open it in browser with test data to confirm layout:

```bash
# Temporarily patch __DATA__ and __META__ to test
sed 's/__DATA__/[{"source":"yad2","seller":"Test Dealer","model":"קיה ספורטז'"'"' Urban","year":2021,"hand":1,"km":90000,"kmPerYear":18000,"engine":"1.6","price":65000,"href":"https:\/\/www.yad2.co.il\/item\/test","location":"תל אביב","description":"טסט"}]/; s/__META__/{"make":"קיה","model":"ספורטז'"'"'","priceMin":51000,"priceMax":69000,"yearMin":2016,"yearMax":2026,"kmMax":150000,"engine":"1.6","generatedAt":"2026-09-01 14:30"}/' ~/Documents/dev/AI/Car-Lookup/template/results.html > /tmp/car-test.html
open /tmp/car-test.html
```

Expected: Page loads, table shows 1 row with orange "ממוצע ~" score badge, sorting headers work.

- [ ] **Step 3: Commit template**

```bash
cd ~/Documents/dev/AI/Car-Lookup
git add template/results.html
git commit -m "feat: add interactive HTML results template with RTL, sort, and filter"
```

---

## Task 3: Write Skill — Header, Lookup Tables, and Query Parsing

**Files:**
- Create: `~/.claude/skills/car-lookup.md`

- [ ] **Step 1: Create the skill file with header and lookup tables**

Write `~/.claude/skills/car-lookup.md`:

```markdown
---
name: car-lookup
description: Search Yad2 and Facebook Marketplace for used cars matching a description. Outputs a sortable interactive HTML file. Usage: /car-lookup I want Kia Sportage 1.6 around 60k
---

# Car Lookup Skill

Search Yad2 and Facebook Marketplace for used cars, visit each listing for detailed km data, score by km/year ratio, and generate an interactive sortable HTML dashboard.

## Step 0: Announce

Tell the user: "מחפש רכבים... זה יקח כמה דקות. אאסוף את כל המודעות הזמינות."

## Step 1: Parse the Query

Extract these fields from the user's natural-language input:

| Field | How to extract |
|---|---|
| make_en | English brand (Kia, Hyundai, Toyota, Mazda, etc.) |
| make_he | Hebrew brand (קיה, יונדאי, טויוטה, מאזדה) |
| model_en | English model (Sportage, Tucson, Corolla, CX-5, etc.) |
| model_he | Hebrew model (ספורטז', טוסון, קורולה, CX-5) |
| price_center | numeric value — "60k"→60000, "around 65k"→65000 |
| price_min | price_center × 0.85 (round to nearest 1000) |
| price_max | price_center × 1.15 (round to nearest 1000) |
| engine_cc_min | "1.6"→1560, "2.0"→1950, omit if not specified |
| engine_cc_max | "1.6"→1700, "2.0"→2100, omit if not specified |
| year_min | explicit or (currentYear - 10) |
| year_max | explicit or currentYear |
| km_max | explicit or 200000 |

**Examples:**
- "Kia Sportage 1.6 around 60k" → make=Kia/קיה, model=Sportage/ספורטז', price 51000-69000, engine 1560-1700
- "יונדאי טוסון עד 70 אלף" → make=Hyundai/יונדאי, model=Tucson/טוסון, price 0-70000, no engine filter
- "Toyota Corolla 2.0 between 55k and 75k" → make=Toyota, model=Corolla, price 55000-75000, engine 1950-2100

## Step 2: Resolve Yad2 Manufacturer and Model IDs

Use this lookup table first:

| make_en | manufacturer_id | model_en | model_id |
|---|---|---|---|
| Kia | 48 | Sportage | 10720 |
| Kia | 48 | Sorento | 10718 |
| Kia | 48 | Niro | 10708 |
| Kia | 48 | Stonic | 10722 |
| Kia | 48 | Ceed | 10698 |
| Kia | 48 | K5 | 11743 |
| Hyundai | 37 | Tucson | (fetch) |
| Hyundai | 37 | i35 | (fetch) |
| Hyundai | 37 | i25 | (fetch) |
| Toyota | 82 | Corolla | (fetch) |
| Toyota | 82 | C-HR | (fetch) |
| Toyota | 82 | RAV4 | (fetch) |
| Mazda | 55 | CX-5 | (fetch) |
| Mazda | 55 | Mazda3 | (fetch) |
| Skoda | 74 | Octavia | (fetch) |
| Skoda | 74 | Kodiaq | (fetch) |

If the model_id is "(fetch)" or the make is not in the table, fetch it:
1. Use mcp__playwright-extension__browser_navigate to open: `https://www.yad2.co.il/vehicles/cars`
2. Use mcp__playwright-extension__browser_evaluate to run:
```js
async () => {
  const r = await fetch('https://gw.yad2.co.il/vehicles-cars-catalog/', {credentials:'include'});
  const d = await r.json();
  return JSON.stringify(d.data.manufacturer.map(m => ({id: m.id, en: m.engTitle, he: m.title})));
}
```
3. Find the manufacturer by matching make_en or make_he → get manufacturer_id
4. Run second fetch to get models:
```js
async () => {
  const r = await fetch(`https://gw.yad2.co.il/vehicles-cars-catalog/?manufacturer=${MANUFACTURER_ID}`, {credentials:'include'});
  const d = await r.json();
  return JSON.stringify(d.data.model.map(m => ({id: m.id, title: m.title})));
}
```
5. Find model by matching model_en or model_he → get model_id
```

- [ ] **Step 2: Verify skill file was created**

```bash
head -30 ~/.claude/skills/car-lookup.md
```

Expected: Shows the frontmatter and first steps.

---

## Task 4: Write Skill — Yad2 Scraping

**Files:**
- Modify: `~/.claude/skills/car-lookup.md` (append)

- [ ] **Step 1: Append Yad2 scraping section to skill file**

Append to `~/.claude/skills/car-lookup.md`:

```markdown
## Step 3: Scrape Yad2

### 3a. Build the search URL

Construct this URL (omit engineval if no engine filter):
```
https://www.yad2.co.il/vehicles/cars?manufacturer={manufacturer_id}&model={model_id}&price={price_min}-{price_max}&year={year_min}-{year_max}&km=0-{km_max}&engineval={engine_cc_min}-{engine_cc_max}
```

Example for Kia Sportage 1.6, 51000-69000, 2016-2026, km<150000:
```
https://www.yad2.co.il/vehicles/cars?manufacturer=48&model=10720&price=51000-69000&year=2016-2026&km=0-150000&engineval=1560-1700
```

### 3b. Discover all pages

Navigate to the search URL (page 0, no page param needed). Then run:

```js
() => {
  const links = Array.from(document.querySelectorAll('a[href]'));
  const pageNums = links
    .map(a => { const m = a.href.match(/page=(\d+)/); return m ? parseInt(m[1]) : -1; })
    .filter(n => n >= 0);
  return Math.max(0, ...pageNums);
}
```

This returns `lastPage`. If result is 0, there is only 1 page.

### 3c. Collect cards from all pages

For each page number from 0 to lastPage, navigate to `{searchURL}&page={N}` then run:

```js
() => {
  const links = Array.from(document.querySelectorAll('a[href*="/item/"]'))
    .filter(a => !a.closest('[class*="favorites"]'));
  return JSON.stringify(links.map(a => {
    const infoEl = a.querySelector('[data-testid="feed-item-info"]');
    const priceEl = a.querySelector('[data-testid="price"]');
    const isDealer = !!a.querySelector('[class*="agency"]') || !!a.querySelector('[class*="Agency"]');
    return {
      href: a.href.split('?')[0],
      infoText: infoEl?.textContent?.trim() || '',
      priceRaw: priceEl?.textContent?.replace(/[^\d]/g, '') || '',
      isDealer
    };
  }));
}
```

Accumulate all cards in an array (deduplicate by href). Skip cards with empty href or href that was already collected.

### 3d. Visit each Yad2 listing for detailed data

For each card href, navigate to it, then run:

```js
() => {
  const title = document.title;
  const specs = {};
  document.querySelectorAll('[class*="detail-card"]').forEach(card => {
    const label = card.querySelector('[class*="__label"]')?.textContent?.trim();
    const value = card.querySelector('[class*="__value"]')?.textContent?.trim();
    if (label && value) specs[label] = value;
  });
  const priceEl = document.querySelector('[class*="ad-price-module"][class*="price"]') ||
                  document.querySelector('[class*="adPriceBox"]');
  const price = priceEl?.textContent?.replace(/[^\d]/g, '') || '';
  const sellerEl = document.querySelector('[class*="agency-name"], [class*="agencyName"], h1[class*="agency"]');
  const locationEl = document.querySelector('[class*="address"], [data-testid*="address"], [class*="location"]');
  const engineEl = document.querySelector('[class*="engine"], [data-testid*="engine"]');
  return JSON.stringify({
    title,
    specs,
    price,
    seller: sellerEl?.textContent?.trim() || '',
    location: locationEl?.textContent?.trim() || '',
    engine: engineEl?.textContent?.trim() || ''
  });
}
```

**Parse the result** into a listing object:

```js
// From specs object:
// year: specs["שנה"] or specs["Year"]
// km:   specs["ק״מ"] or specs["ק\"מ"] — remove commas
// hand: specs["יד"]

// Fallback: parse title string "קיה ספורטז' שנת 2021 יד ראשונה 118,000 ק״מ | יד2"
const yearM = title.match(/שנת?\s*(20\d\d)/);
const kmM   = title.match(/([\d,]+)\s*(ק"מ|ק״מ|קילומטר)/);
const handM = title.match(/יד\s*(ראשונה|שנייה|שלישית|רביעית|[1-9])/);
const handMap = {ראשונה:1, שנייה:2, שלישית:3, רביעית:4};

// Also extract engine from infoText: "1.6 (136 כ״ס)"
const engineM = infoText.match(/(\d\.\d)\s*\(/);

// Final listing object:
{
  source: 'yad2',
  href,
  model: infoText.split(/\d{4}/)[0].trim(),  // text before year
  year:  parseInt(specs["שנה"] || yearM?.[1]),
  km:    parseInt((specs["ק״מ"] || specs['ק"מ'] || kmM?.[1] || '').replace(/,/g, '')),
  hand:  parseInt(specs["יד"] || handMap[handM?.[1]] || handM?.[1]),
  price: parseInt(price || priceRaw),
  engine: engineM?.[1] || engine || '',
  seller: seller || (isDealer ? 'עסקי' : 'פרטי'),
  location,
  description: '',
  isDealer
}
```

After visiting all listings, you have a `yad2Listings` array.
```

- [ ] **Step 2: Verify the appended content**

```bash
grep -n "Step 3" ~/.claude/skills/car-lookup.md
```

Expected: Shows lines with "Step 3", "3a", "3b", "3c", "3d".

---

## Task 5: Write Skill — Facebook Scraping

**Files:**
- Modify: `~/.claude/skills/car-lookup.md` (append)

- [ ] **Step 1: Append Facebook scraping section**

Append to `~/.claude/skills/car-lookup.md`:

```markdown
## Step 4: Scrape Facebook Marketplace

### 4a. Build the search URL

```
https://www.facebook.com/marketplace/search/?query={make_he}+{model_he}&minPrice={price_min}&maxPrice={price_max}&category_id=vehicles
```

Example: `https://www.facebook.com/marketplace/search/?query=קיה+ספורטז&minPrice=51000&maxPrice=69000&category_id=vehicles`

The URL-encoded Hebrew query: use encodeURIComponent(make_he + ' ' + model_he).

### 4b. Scroll to load all results

Navigate to the Facebook search URL. Then run this scroll loop — execute it multiple times until listings stop increasing:

```js
async () => {
  const before = document.querySelectorAll('a[href*="/marketplace/item/"]').length;
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 2500));
  const after = document.querySelectorAll('a[href*="/marketplace/item/"]').length;
  return JSON.stringify({before, after, increased: after > before});
}
```

Keep scrolling as long as `increased === true`. Stop when `increased === false` for 2 consecutive scroll attempts.

### 4c. Collect all listing links

After scrolling is complete, run:

```js
() => {
  const links = Array.from(document.querySelectorAll('a[href*="/marketplace/item/"]'));
  const unique = [...new Map(links.map(a => [a.href.split('?')[0], a])).values()];
  return JSON.stringify(unique.map(a => {
    const card = a.closest('[class]') || a.parentElement;
    const priceEl = Array.from(card?.querySelectorAll('span') || []).find(s => s.textContent.includes('₪'));
    const locEl   = Array.from(card?.querySelectorAll('span') || []).filter(s => !s.textContent.includes('₪'))[1];
    return {
      href: a.href.split('?')[0],
      priceRaw: priceEl?.textContent?.replace(/[^\d]/g, '') || '',
      location: locEl?.textContent?.trim() || ''
    };
  }));
}
```

### 4d. Visit each Facebook listing for detailed data

For each href, navigate to it, then run:

```js
() => {
  const title = document.title.replace(/\(\d+\)\s*/, '').replace('Marketplace - ', '').replace(' | Facebook', '').trim();
  // Find the main description — longest text block not in sidebar
  const spans = Array.from(document.querySelectorAll('span, div'))
    .filter(el => el.children.length === 0 && el.textContent.trim().length > 30)
    .sort((a, b) => b.textContent.length - a.textContent.length);
  const description = spans.slice(0, 5).map(s => s.textContent.trim()).join(' ');
  // Price: find the prominent ₪ element (not in similar items sidebar)
  const priceEls = Array.from(document.querySelectorAll('span')).filter(s => s.textContent.match(/^₪[\d,]+$/));
  const price = priceEls[0]?.textContent?.replace(/[^\d]/g, '') || '';
  // Seller name
  const sellerEl = document.querySelector('a[href*="/profile/"], a[href*="/user/"], a[href*="/groups/"]');
  return JSON.stringify({title, description: description.substring(0,500), price, seller: sellerEl?.textContent?.trim() || ''});
}
```

**Parse the description** to extract structured fields:

```js
const text = description + ' ' + title;

// km: look for "108,000 קילומטר" or "108000 ק\"מ" or "108,000 ק״מ"
const kmM = text.match(/([\d,]+)\s*(קילומטר|ק"מ|ק״מ|km)/i);
const km = kmM ? parseInt(kmM[1].replace(/,/g, '')) : null;

// year: "שנת 2021" or standalone 4-digit year 2010-2026
const yearM = text.match(/שנת?\s*(20[12]\d)/) || text.match(/\b(20(?:1[0-9]|2[0-6]))\b/);
const year = yearM ? parseInt(yearM[1]) : null;

// hand: "יד ראשונה/שנייה/שלישית/רביעית" or "יד 1/2/3/4" or "first/second hand"
const handMap = {ראשונה:1, שנייה:2, שלישית:3, רביעית:4, חמישית:5};
const handM = text.match(/יד\s*(ראשונה|שנייה|שלישית|רביעית|חמישית|[1-9])/i);
const hand = handM ? (handMap[handM[1]] || parseInt(handM[1])) : null;

// engine: "1.6 ליטר" or "2000 סמ\"ק" or "1.6L"
const engineM = text.match(/(\d\.\d)\s*(ליטר|liter|L\b)/i) || text.match(/(\d{3,4})\s*(סמ"ק|cc)/i);
const engine = engineM ? engineM[1] : null;

// Final listing object:
{
  source: 'facebook',
  href,
  model: title,
  year,
  km,
  hand,
  price: parseInt(price || priceRaw) || null,
  engine,
  seller,
  location,
  description: description.substring(0, 300),
  isDealer: false
}
```

After visiting all listings, you have a `facebookListings` array.
```

- [ ] **Step 2: Verify**

```bash
grep -n "Step 4" ~/.claude/skills/car-lookup.md
```

Expected: Shows Step 4 lines.

---

## Task 6: Write Skill — Data Processing and HTML Generation

**Files:**
- Modify: `~/.claude/skills/car-lookup.md` (append)

- [ ] **Step 1: Append data processing and HTML generation section**

Append to `~/.claude/skills/car-lookup.md`:

```markdown
## Step 5: Normalize and Score All Listings

Combine yad2Listings and facebookListings into `allListings`.

For each listing:
1. **Deduplicate** by href (keep first occurrence)
2. **Skip listings missing year** (can't score without it)
3. **Compute kmPerYear:**
   ```
   currentYear = new Date().getFullYear()  // 2026
   yearsOld = Math.max(1, currentYear - listing.year)
   listing.kmPerYear = listing.km ? Math.round(listing.km / yearsOld) : null
   ```
4. **Ensure price is integer** — if null, skip the listing
5. **Sort** by kmPerYear ascending (null values go to end)

Score categories (for HTML display):
- kmPerYear ≤ 10000 → "excellent"
- 10001–15000 → "good"
- 15001–20000 → "average"
- > 20000 → "high"
- null → "na"

## Step 6: Generate the HTML Output File

### 6a. Build the data structures

Create a JavaScript-safe JSON string from allListings:

```js
const listingsJson = JSON.stringify(allListings);
const metaJson = JSON.stringify({
  make: make_he,
  model: model_he,
  priceMin: price_min,
  priceMax: price_max,
  yearMin: year_min,
  yearMax: year_max,
  kmMax: km_max,
  engine: engine_cc_min ? `${engine_cc_min/1000}L` : null,
  generatedAt: new Date().toLocaleString('he-IL')
});
```

### 6b. Read the HTML template

Read the file at `~/Documents/dev/AI/Car-Lookup/template/results.html`.

Replace:
- `__DATA__` → listingsJson
- `__META__` → metaJson

### 6c. Write the output file

Determine output filename:
```
make_slug = make_en.toLowerCase()           // e.g., "kia"
model_slug = model_en.toLowerCase()         // e.g., "sportage"
timestamp = new Date().toISOString().slice(0,16).replace('T','-').replace(':','')
filename = `${make_slug}-${model_slug}-${timestamp}.html`
outputPath = `~/Documents/dev/AI/Car-Lookup/results/${filename}`
```

Use the Write tool to write the full HTML content to outputPath.

### 6d. Open in browser and report

```bash
open ~/Documents/dev/AI/Car-Lookup/results/{filename}
```

Report to the user:
```
נמצאו {total} מודעות: {yad2Count} מיד2 ו-{fbCount} מפייסבוק.
קובץ נשמר: results/{filename}
```

## Notes for Edge Cases

- **Yad2 listing 404:** Skip and continue. Note the count of skipped listings.
- **Missing km on Facebook listing:** Include listing with km=null, kmPerYear=null, sorted to bottom.
- **Facebook login wall:** If navigating to Facebook results in a login page, stop and tell the user: "יש להתחבר לפייסבוק בדפדפן תחילה, ולאחר מכן לנסות שוב."
- **Yad2 bot block:** If the page shows "Verifying your browser", wait 5 seconds and navigate again once. If still blocked, skip that page.
- **Engine filter on Facebook:** Facebook doesn't support engine filtering by URL — the engine filter from the URL params only applies to Yad2. For Facebook, note in results that engine data may vary.
- **Price discrepancy:** If a listing shows multiple prices (e.g. monthly payment and total), use the largest number that looks like a full car price (> 10000).
```

- [ ] **Step 2: Verify full skill file was written**

```bash
wc -l ~/.claude/skills/car-lookup.md
grep -n "^## Step" ~/.claude/skills/car-lookup.md
```

Expected: File is ~250+ lines. Shows Steps 0-6 with correct line numbers.

- [ ] **Step 3: Commit the skill file**

```bash
cd ~/Documents/dev/AI/Car-Lookup
git add template/results.html
# skill file lives outside the repo, just note its location in the README
git commit -m "feat: add car-lookup skill and HTML results template"
```

---

## Task 7: End-to-End Integration Test

- [ ] **Step 1: Create a simple test run**

In Claude Code, invoke:
```
/car-lookup I want Kia Sportage 1.6 around 60k
```

- [ ] **Step 2: Verify Yad2 scraping runs**

Watch for these outputs in sequence:
- "manufacturer ID: 48, model ID: 10720" (or equivalent)
- "Discovered N pages on Yad2..."
- "Visiting listing 1/N: yad2.co.il/item/..."

- [ ] **Step 3: Verify Facebook scraping runs**

Watch for:
- "Scrolling Facebook to load all results..."
- "Found N listings on Facebook"
- "Visiting FB listing 1/N..."

- [ ] **Step 4: Verify HTML output**

After skill completes:
```bash
ls -la ~/Documents/dev/AI/Car-Lookup/results/
```

Expected: A file like `kia-sportage-2026-09-01-1430.html` exists.

- [ ] **Step 5: Verify HTML content**

```bash
# Check the file has embedded listings data
grep -c '"source"' ~/Documents/dev/AI/Car-Lookup/results/kia-sportage-*.html
```

Expected: Returns a number > 0 (each listing has "source" field).

- [ ] **Step 6: Verify HTML interactivity**

Open the file in browser. Manually verify:
1. Table loads with all columns visible (RTL layout)
2. Click "שנה" column header → rows sort by year
3. Click "מחיר ₪" → sorts by price
4. Click "יד2" chip → filters to Yad2 only
5. Click a row → expands detail row with description
6. "פתח מודעה" link opens original ad in new tab
7. Score column shows colored badges

- [ ] **Step 7: Final commit**

```bash
cd ~/Documents/dev/AI/Car-Lookup
git add docs/superpowers/plans/
git commit -m "docs: add implementation plan for car-lookup skill"
```

---

## Self-Review

**Spec coverage:**
- ✅ Query parsing (Section 1 of spec) → Task 3
- ✅ Manufacturer/model ID lookup → Task 3, Step 1 (lookup table + dynamic fetch)
- ✅ Yad2 URL construction → Task 4, 3a
- ✅ Yad2 pagination → Task 4, 3b–3c
- ✅ Yad2 detail page (year/km/hand via detail-card) → Task 4, 3d
- ✅ Yad2 page title fallback → Task 4, 3d
- ✅ Facebook search URL → Task 5, 4a
- ✅ Facebook infinite scroll → Task 5, 4b
- ✅ Facebook description parsing regexes → Task 5, 4d
- ✅ km/year scoring with labels → Task 6, Step 1
- ✅ HTML template (sortable, filterable, RTL) → Task 2
- ✅ Auto-open in browser → Task 6, Step 1 6d
- ✅ Output file path → Task 6, Step 1 6c
- ✅ All error handling cases → Task 6, edge cases section
- ✅ No listing cap — skill scrapes all pages → Task 4 3c (all pages 0–lastPage)

**No TBDs or placeholders found.**

**Type consistency:** All JS property names consistent throughout (href, source, year, km, hand, price, kmPerYear, seller, location, description, engine, isDealer).
