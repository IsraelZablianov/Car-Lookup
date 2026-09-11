# Car Lookup Skill — Design Spec

> Historical Claude v1 design. The current workflow is maintained in
> `.agents/skills/car-lookup/SKILL.md`; see the repository README.

**Date:** 2026-09-01  
**Status:** Approved  

---

## Overview

A Claude Code skill (`/car-lookup`) that accepts a natural-language description of a desired used car, searches Yad2 and Facebook Marketplace for all matching listings, visits each listing to extract structured data (including km), computes a km/year value score, and writes an interactive sortable HTML file with all results.

**Example invocation:**
```
/car-lookup I want Kia Sportage 1.6 around 60k
```

---

## 1. Query Parsing

Claude parses the free-text input into structured search parameters:

| Field | Parsing rule | Default |
|---|---|---|
| `make` | Hebrew or English brand name | Required |
| `model` | Hebrew or English model name | Required |
| `price_center` | Numeric value ("60k" → 60000) | Required |
| `price_min` | price_center × 0.85 | auto |
| `price_max` | price_center × 1.15 | auto |
| `engine_cc_min` | "1.6" → 1560, "2.0" → 1950 | omit filter |
| `engine_cc_max` | "1.6" → 1700, "2.0" → 2100 | omit filter |
| `year_min` | Explicit or (currentYear - 10) | currentYear-10 |
| `year_max` | Explicit or currentYear | currentYear |
| `km_max` | Explicit or 200,000 | 200,000 |

**Price range examples:**
- "around 60k" → 51,000–69,000
- "up to 70k" → 0–70,000
- "between 50k and 65k" → 50,000–65,000

### Manufacturer/Model ID Lookup (Yad2)

Use the Yad2 catalog API (via browser fetch with cookies):
- Manufacturer list: `GET https://gw.yad2.co.il/vehicles-cars-catalog/`  
  Response shape: `{ data: { manufacturer: [{id, engTitle, title}] } }`
- Model list: `GET https://gw.yad2.co.il/vehicles-cars-catalog/?manufacturer={id}`  
  Response shape: `{ data: { model: [{id, title, manufacturer}] } }`

Match by `engTitle` (English) or `title` (Hebrew) — case-insensitive substring match.

**Known IDs (hardcoded for speed):**

| Make | ID | Common Models | Model ID |
|---|---|---|---|
| Kia קיה | 48 | Sportage ספורטז' | 10720 |
| Hyundai יונדאי | 37 | Tucson טוסון | 10546 |
| Toyota טויוטה | 82 | Corolla קורולה | 10830 |
| Mazda מאזדה | 55 | CX-5 | 10609 |
| Skoda סקודה | 74 | Octavia | 10760 |

If the make/model is not in the hardcoded table, fetch dynamically from the catalog API.

---

## 2. Yad2 Scraping

### 2.1 Search URL Construction

```
https://www.yad2.co.il/vehicles/cars?manufacturer={id}&model={id}&price={min}-{max}&year={year_min}-{year_max}&km=0-{km_max}&engineval={cc_min}-{cc_max}
```

Omit `engineval` if no engine size was specified.

### 2.2 Pagination

1. Navigate to page 0 of the search URL
2. Extract all `<a href>` elements where href contains `?page=N`
3. Find the maximum page number → that is `lastPage`
4. Iterate pages 0 through `lastPage`, collecting listing cards from each page

### 2.3 Card Extraction (per page)

From each search results page, select all `<a href*="/item/">` elements that are **not** inside a `[class*="favorites"]` container. For each:

```js
{
  href: a.href.split('?')[0],                                    // clean URL
  infoText: a.querySelector('[data-testid="feed-item-info"]')    // "model year • יד N"
              ?.textContent.trim(),
  price: a.querySelector('[data-testid="price"]')
          ?.textContent.replace(/[^\d]/g, ''),                   // digits only
  source: 'yad2'
}
```

### 2.4 Detail Page Extraction (per listing)

Navigate to each `href`. Extract from `[class*="detail-card"]` elements:

```js
// Group by label → value pairs
const specs = {};
document.querySelectorAll('[class*="detail-card__box"], [class*="detail-card-module"]')
  .forEach(card => {
    const label = card.querySelector('[class*="label"]')?.textContent.trim();
    const value = card.querySelector('[class*="value"]')?.textContent.trim();
    if (label && value) specs[label] = value;
  });
// specs["שנה"] → year
// specs["ק״מ"] → km (remove commas)
// specs["יד"]  → hand number
```

**Fallback (page title parsing):**
Title format: `"קיה ספורטז' שנת 2021 יד ראשונה 118,000 ק״מ | יד2"`
- year: `/שנת?\s*(20\d\d)/`
- km: `/(\d[\d,]+)\s*(ק"מ|ק״מ|קילומטר)/`
- hand: `/יד\s*(ראשונה|שנייה|שלישית|רביעית|[1-9])/`

**Additional fields:**
- Seller name: page heading or breadcrumb
- Seller type (dealer vs private): presence of dealer badge / `[class*="agency"]` on the card in search results
- Location: city text near address elements
- Sub-model/trim: the subtitle line under the model name
- Engine: parsed from info text "1.6 (136 כ״ס)" pattern

---

## 3. Facebook Marketplace Scraping

### 3.1 Search URL Construction

```
https://www.facebook.com/marketplace/search/?query={make_heb}+{model_heb}&minPrice={price_min}&maxPrice={price_max}&category_id=vehicles
```

Hebrew make/model are used in the query for better results. Facebook auto-localizes to the user's country based on session.

### 3.2 Infinite Scroll — Load All Results

```
1. Navigate to search URL
2. Count current listing links: document.querySelectorAll('a[href*="/marketplace/item/"]').length
3. Scroll to bottom: window.scrollTo(0, document.body.scrollHeight)
4. Wait 2 seconds
5. Count again — if count increased, repeat from step 3
6. Stop when count does not change after 2 consecutive scrolls
```

### 3.3 Card Extraction

From each `<a href*="/marketplace/item/">`:
- `href`: listing URL
- `price`: text of the closest element containing `₪`
- `location`: secondary text in the card

### 3.4 Detail Page Extraction (per listing)

Navigate to each listing URL. Facebook listing descriptions are unstructured Hebrew text. Extract:

**Price:** Find element with `₪` not inside the similar-items sidebar.

**Description text:** largest text block on the page (typically a `<span>` with >50 chars).

**Parse description with regex:**
```
km:    /(\d[\d,]+)\s*(ק"מ|ק״מ|קילומטר|km)/i
year:  /שנת?\s*(20\d\d)|(^|\s)(20(?:1[0-9]|2[0-6]))(\s|$)/
hand:  /יד\s*(ראשונה|1st?|1)|(יד\s*שנייה|2nd?|2)|(יד\s*שלישית|3)|(יד\s*רביעית|4)/i
       Also Hebrew ordinals: ראשונה=1, שנייה=2, שלישית=3, רביעית=4
engine:/(\d\.?\d?)\s*(ליטר|liter|L\b)/i  or  /(\d{3,4})\s*(cc|סמ"ק)/i
```

**Listing title:** page `<title>` or the prominent heading — usually contains make/model.

**Seller:** seller name shown under listing.

---

## 4. Data Normalization & Value Scoring

### 4.1 Normalization

After collecting all listings from both sources:
- Parse km: remove commas, convert to integer → `kmInt`
- Parse year: integer → `yearInt`
- Parse hand: Hebrew ordinal or digit → integer `handInt`
- Parse price: remove commas/₪/spaces → integer `priceInt`
- Deduplicate: if same URL appears twice, keep once

### 4.2 Km/Year Score

```
currentYear = 2026
yearsOld = Math.max(1, currentYear - yearInt)
kmPerYear = Math.round(kmInt / yearsOld)
```

**Score label:**
| km/year | Label | Color |
|---|---|---|
| ≤ 10,000 | מצוין ⭐ | green |
| 10,001–15,000 | טוב ✓ | lime |
| 15,001–20,000 | ממוצע ~ | orange |
| > 20,000 | גבוה ⚠ | red |

**Sort order (default):** km/year ascending (lowest = best value first).

---

## 5. HTML Output

### 5.1 File Location

```
~/Documents/dev/AI/Car-Lookup/results/{make}-{model}-{YYYY-MM-DD-HHmm}.html
```

e.g., `results/Kia-Sportage-2026-09-01-1430.html`

### 5.2 Structure

Single self-contained HTML file (no external deps). Contains:

**Header section:**
- Title: "חיפוש: {make} {model} | {count} מודעות"
- Search params summary (price range, year, km, engine)
- Generation timestamp

**Filter bar (above table):**
- Source toggle: `[Yad2] [Facebook] [הכל]`
- Hand filter: `[יד 1] [יד 2] [יד 3+]`
- Score filter: `[מצוין] [טוב] [ממוצע] [גבוה]`
- Active filter count badge

**Sortable table columns:**
| # | מקור | שם/דגם | שנה | יד | ק"מ | ק"מ/שנה | ניקוד | מנוע | מחיר | קישור |
|---|---|---|---|---|---|---|---|---|---|---|

- Click any column header → sort ascending; click again → descending
- Currently sorted column shows ▲/▼ arrow
- Score column cells are color-coded by value label

**Row details (expandable):** clicking a row expands it to show seller name, location, and raw description text.

### 5.3 Auto-open

After writing the file, open it in the default browser:
```bash
open ~/Documents/dev/AI/Car-Lookup/results/{filename}.html
```

---

## 6. Skill Structure

### 6.1 Skill File Location

`~/.claude/skills/car-lookup.md`

This is a Claude Code skill — a markdown file Claude reads and follows step-by-step.

### 6.2 Skill Invocation Flow

```
/car-lookup {natural language query}
```

**Step order the skill instructs:**
1. Parse query → structured params
2. Resolve manufacturer/model IDs (table lookup or catalog API fetch)
3. Open Playwright browser
4. Scrape Yad2: build URL → paginate all pages → collect card data
5. Scrape Facebook: build URL → scroll to end → collect cards
6. Visit each listing (Yad2 + Facebook) → extract full detail data
7. Normalize + score all listings
8. Generate HTML file
9. Save to results/
10. Open in browser
11. Print summary: "Found {N} listings from Yad2 and {M} from Facebook. Saved to {path}."

### 6.3 Tool Usage

The skill uses these Claude Code tools:
- `mcp__playwright-extension__browser_navigate` — page navigation
- `mcp__playwright-extension__browser_evaluate` — JS extraction
- `mcp__playwright-extension__browser_scroll` — Facebook infinite scroll
- `mcp__playwright-extension__browser_wait_for` — wait for dynamic content
- `Write` — save HTML output file
- `Bash` — open file in browser (`open path`)

---

## 7. Error Handling

- **Listing 404/redirect:** skip, log as "could not fetch"
- **Missing km:** include listing but show "N/A" in km/year column; sort these to the bottom
- **Missing year:** skip the listing (can't compute score)
- **Facebook login wall:** if Facebook redirects to login, notify user to log in to Facebook in their browser first
- **Yad2 bot block (Radware):** retry once; if still blocked, skip that page and continue
- **Empty results:** inform user and suggest broadening price range or removing engine filter

---

## 8. Future Extensions (out of scope for v1)

- Additional sources: auto1.co.il, komo.co.il, yad1.co.il
- Price history tracking (save past runs, compare over time)
- Alert mode: re-run search daily, notify on new listings below a price threshold
- WhatsApp/email export of top 5 picks
