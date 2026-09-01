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
| Hyundai | 37 | Tucson | 10546 |
| Hyundai | 37 | i35 | (fetch) |
| Hyundai | 37 | i25 | (fetch) |
| Toyota | 82 | Corolla | 10830 |
| Toyota | 82 | C-HR | (fetch) |
| Toyota | 82 | RAV4 | (fetch) |
| Mazda | 55 | CX-5 | 10609 |
| Mazda | 55 | Mazda3 | (fetch) |
| Skoda | 74 | Octavia | 10760 |
| Skoda | 74 | Kodiaq | (fetch) |

If the model_id is "(fetch)" or the make is not in the table, fetch it dynamically:

1. Use mcp__playwright-extension__browser_navigate to open: `https://www.yad2.co.il/vehicles/cars`
2. Use mcp__playwright-extension__browser_evaluate to run:

```js
async () => {
  const r = await fetch('https://gw.yad2.co.il/vehicles-cars-catalog/', {credentials:'include'});
  const d = await r.json();
  return JSON.stringify(d.data.manufacturer.map(m => ({id: m.id, en: m.engTitle, he: m.title})));
}
```

3. Find the manufacturer by matching make_en or make_he (case-insensitive substring) → get manufacturer_id
4. Run second fetch to get models:

```js
async () => {
  const r = await fetch(`https://gw.yad2.co.il/vehicles-cars-catalog/?manufacturer=${MANUFACTURER_ID}`, {credentials:'include'});
  const d = await r.json();
  return JSON.stringify(d.data.model.map(m => ({id: m.id, title: m.title})));
}
```

5. Find model by matching model_en or model_he → get model_id

## Step 3: Scrape Yad2

### 3a. Build the search URL

Construct this URL (omit engineval if no engine filter was specified):

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

This returns `lastPage`. If result is 0, there is only 1 page. Tell the user: "יד2: נמצאו {lastPage+1} עמודים."

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

Accumulate all cards in an array (deduplicate by href). Skip cards with empty href or href already collected.
Tell the user after each page: "יד2: עמוד {N}/{lastPage} — {count} מודעות עד כה."

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
  const sellerEl = document.querySelector('[class*="agency-name"], [class*="agencyName"]');
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

Parse the result into a listing object using this logic:

```
// From specs object (Hebrew keys):
year_val  = specs["שנה"]
km_val    = specs["ק״מ"] || specs['ק"מ']
hand_val  = specs["יד"]

// Fallback: parse from page title
// Title format: "קיה ספורטז' שנת 2021 יד ראשונה 118,000 ק״מ | יד2"
yearM = title.match(/שנת?\s*(20\d\d)/)
kmM   = title.match(/([\d,]+)\s*(ק"מ|ק״מ|קילומטר)/)
handM = title.match(/יד\s*(ראשונה|שנייה|שלישית|רביעית|[1-9])/)
handMap = {ראשונה:1, שנייה:2, שלישית:3, רביעית:4}

// Extract engine from infoText: "1.6 (136 כ״ס)"
engineM = infoText.match(/(\d\.\d)\s*\(/)

// Build final object:
{
  source: 'yad2',
  href: card.href,
  model: infoText.split(/\d{4}/)[0].trim(),
  year:  parseInt(year_val || yearM?.[1]),
  km:    parseInt((km_val || kmM?.[1] || '').replace(/,/g, '')),
  hand:  parseInt(hand_val || handMap[handM?.[1]] || handM?.[1]),
  price: parseInt(price || card.priceRaw),
  engine: engineM?.[1] || engine || '',
  seller: seller || (card.isDealer ? 'עסקי' : 'פרטי'),
  location: location,
  description: '',
  isDealer: card.isDealer
}
```

Skip listings where year is NaN or missing.
Tell the user progress: "יד2: מבקר מודעה {i}/{total}..."

After visiting all listings, you have a `yad2Listings` array.

## Step 4: Scrape Facebook Marketplace

### 4a. Build the search URL

```
https://www.facebook.com/marketplace/search/?query={ENCODED_QUERY}&minPrice={price_min}&maxPrice={price_max}&category_id=vehicles
```

Where ENCODED_QUERY = encodeURIComponent(make_he + ' ' + model_he)

Example: `https://www.facebook.com/marketplace/search/?query=%D7%A7%D7%99%D7%94%20%D7%A1%D7%A4%D7%95%D7%A8%D7%98%D7%96&minPrice=51000&maxPrice=69000&category_id=vehicles`

If navigating to Facebook results in a login page (URL contains "login" or page title contains "Log in"), stop Facebook scraping and tell the user: "יש להתחבר לפייסבוק בדפדפן תחילה. ממשיך עם תוצאות יד2 בלבד."

### 4b. Scroll to load all results

Navigate to the Facebook search URL. Then run this scroll loop repeatedly:

```js
async () => {
  const before = document.querySelectorAll('a[href*="/marketplace/item/"]').length;
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise(r => setTimeout(r, 2500));
  const after = document.querySelectorAll('a[href*="/marketplace/item/"]').length;
  return JSON.stringify({before, after, increased: after > before});
}
```

Keep calling this until `increased` is false for 2 consecutive attempts. Tell the user: "פייסבוק: טוען עוד תוצאות... ({count} עד כה)"

### 4c. Collect all listing links

After scrolling is complete, run:

```js
() => {
  const links = Array.from(document.querySelectorAll('a[href*="/marketplace/item/"]'));
  const unique = [...new Map(links.map(a => [a.href.split('?')[0], a])).values()];
  return JSON.stringify(unique.map(a => {
    const card = a.closest('[class]') || a.parentElement;
    const allSpans = Array.from(card?.querySelectorAll('span') || []);
    const priceEl = allSpans.find(s => s.textContent.includes('₪'));
    const locSpans = allSpans.filter(s => !s.textContent.includes('₪') && s.textContent.trim().length > 2);
    const locEl = locSpans[1];
    return {
      href: a.href.split('?')[0],
      priceRaw: priceEl?.textContent?.replace(/[^\d]/g, '') || '',
      location: locEl?.textContent?.trim() || ''
    };
  }));
}
```

Tell the user: "פייסבוק: נמצאו {count} מודעות."

### 4d. Visit each Facebook listing for detailed data

For each href, navigate to it, then run:

```js
() => {
  const title = document.title
    .replace(/\(\d+\)\s*/, '')
    .replace('Marketplace - ‪', '')
    .replace('Marketplace - ', '')
    .replace('‬', '')
    .replace(' | Facebook', '')
    .trim();
  const spans = Array.from(document.querySelectorAll('span, div'))
    .filter(el => el.children.length === 0 && el.textContent.trim().length > 30)
    .sort((a, b) => b.textContent.length - a.textContent.length);
  const description = spans.slice(0, 5).map(s => s.textContent.trim()).join(' ');
  const priceEls = Array.from(document.querySelectorAll('span'))
    .filter(s => s.textContent.match(/^₪[\d,]+$/));
  const price = priceEls[0]?.textContent?.replace(/[^\d]/g, '') || '';
  const sellerEl = document.querySelector('a[href*="/profile/"], a[href*="/user/"]');
  return JSON.stringify({
    title,
    description: description.substring(0, 500),
    price,
    seller: sellerEl?.textContent?.trim() || ''
  });
}
```

Parse the description to extract structured fields:

```
text = description + ' ' + title

// km: "108,000 קילומטר" or "108000 ק\"מ" or "108,000 ק״מ"
kmM = text.match(/([\d,]+)\s*(קילומטר|ק"מ|ק״מ|km)/i)
km  = kmM ? parseInt(kmM[1].replace(/,/g, '')) : null

// year: "שנת 2021" or standalone year 2010-2026
yearM = text.match(/שנת?\s*(20[12]\d)/) || text.match(/\b(20(?:1[0-9]|2[0-6]))\b/)
year  = yearM ? parseInt(yearM[1]) : null

// hand: Hebrew ordinal or digit
handMap = {ראשונה:1, שנייה:2, שלישית:3, רביעית:4, חמישית:5}
handM = text.match(/יד\s*(ראשונה|שנייה|שלישית|רביעית|חמישית|[1-9])/i)
hand  = handM ? (handMap[handM[1]] || parseInt(handM[1])) : null

// engine: "1.6 ליטר" or "2000 סמ\"ק" or "1.6L"
engineM = text.match(/(\d\.\d)\s*(ליטר|liter|L\b)/i) || text.match(/(\d{3,4})\s*(סמ"ק|cc)/i)
engine  = engineM ? engineM[1] : null

// Build final object:
{
  source: 'facebook',
  href: card.href,
  model: title,
  year: year,
  km: km,
  hand: hand,
  price: parseInt(price || card.priceRaw) || null,
  engine: engine,
  seller: seller,
  location: card.location,
  description: description.substring(0, 300),
  isDealer: false
}
```

Skip listings where both year and km are null (no useful data).
Tell the user progress: "פייסבוק: מבקר מודעה {i}/{total}..."

After visiting all listings, you have a `facebookListings` array.

## Step 5: Normalize and Score All Listings

Combine yad2Listings and facebookListings into `allListings`.

For each listing apply:

1. **Deduplicate** by href — if same href appears twice, keep first
2. **Skip** listings where year is null/NaN
3. **Keep** listings with null price — set price to null and the HTML template will display "—". Only skip if year is null/NaN.
4. **Compute kmPerYear:**
   - currentYear = current calendar year (e.g., 2026)
   - yearsOld = Math.max(1, currentYear - listing.year)
   - listing.kmPerYear = listing.km ? Math.round(listing.km / yearsOld) : null
5. **Sort** allListings by kmPerYear ascending (null values go to end)

Score category (used in HTML):
- kmPerYear ≤ 10000 → "excellent"
- 10001–15000 → "good"
- 15001–20000 → "average"
- > 20000 → "high"
- null → "na"

## Step 6: Generate the HTML Output File

### 6a. Build the data JSON

```
listingsJson = JSON.stringify(allListings).replace(/</g, '\\u003c')

metaJson = JSON.stringify({
  make: make_he,
  model: model_he,
  priceMin: price_min,
  priceMax: price_max,
  yearMin: year_min,
  yearMax: year_max,
  kmMax: km_max,
  engine: engine_cc_min ? (engine_cc_min/1000) + 'L' : null,
  generatedAt: <current date/time in Hebrew locale format>
})
```

### 6b. Read and fill the template

Read the file at `/Users/israelz/Documents/dev/AI/Car-Lookup/template/results.html`.

Replace the literal string `__DATA__` with listingsJson.
Replace the literal string `__META__` with metaJson.

### 6c. Write the output file

```
make_slug  = make_en.toLowerCase().replace(/\s+/g, '-')
model_slug = model_en.toLowerCase().replace(/\s+/g, '-')
timestamp  = current datetime as YYYY-MM-DD-HHmm (e.g., 2026-09-01-1430)
filename   = make_slug + '-' + model_slug + '-' + timestamp + '.html'
outputPath = /Users/israelz/Documents/dev/AI/Car-Lookup/results/ + filename
```

Use the Write tool to write the filled HTML content to outputPath.

### 6d. Open in browser and report

Run via Bash:
```bash
open "/Users/israelz/Documents/dev/AI/Car-Lookup/results/{filename}"
```

Tell the user:
```
נמצאו {allListings.length} מודעות: {yad2Count} מיד2 ו-{fbCount} מפייסבוק.
קובץ נשמר ונפתח: results/{filename}
```

## Edge Cases

- **No results found:** If allListings is empty after Step 5, do NOT generate an HTML file. Tell the user: "לא נמצאו מודעות תואמות. נסה להרחיב את טווח המחיר או להסיר את סינון נפח המנוע." and list the exact search params that were used (price range, year range, engine filter, km max).
- **Yad2 listing 404 / redirect:** Skip and continue. Count skipped listings; report at end.
- **Yad2 bot block ("Verifying your browser"):** Wait 5 seconds, navigate to the URL once more. If still blocked, skip that page and continue.
- **Missing km on Facebook:** Include listing with km=null, kmPerYear=null — sorted to bottom of table.
- **Facebook login wall:** If URL contains "login" or page title contains "Log in" / "כניסה", skip all Facebook scraping and inform user.
- **Price discrepancy (multiple prices on page):** Use the number > 10000 that appears most prominently (first large price element).
- **Engine filter on Facebook:** Facebook URL does not support engine cc filtering. Accept all Facebook results regardless of engine; the user can filter by engine in the HTML table if engine is parsed from description.
