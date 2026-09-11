# Car Lookup

Help the user find a car that suits their life and budget in Israel. This repo is
an assistant workflow plus a standalone Hebrew results dashboard, not a web app.

## Start here

- For car selection, model comparisons, or listing searches, read
  `.agents/skills/car-lookup/SKILL.md` and follow the relevant mode.
- Read `buyer-profile.local.md` if present. Record confirmed preferences there
  as the conversation develops, separating requirements, preferences, and open
  questions. It is ignored by Git.
- During platform development, keep personal search inputs out of the reusable
  skill. Gather or update a buyer profile when conducting a car-selection or
  listing-search session; do not start a live car search just to test the platform.
- Examples in documentation are not the user's requirements.
- Follow the user's conversation language; the dashboard uses Hebrew and RTL.

## Repository map

- `.agents/skills/car-lookup/`: canonical skill and source-specific guidance.
- `.claude/skills/car-lookup.md`: compatibility entry pointing to that skill.
- `template/results.html`: self-contained dashboard with JSON placeholders.
- `scripts/render-results.mjs`: render a saved search into the dashboard.
- `results/`: local search data, reports, and generated HTML; ignored by Git.
- `docs/superpowers/`: historical Claude v1 design and plan, not current
  instructions or an unfinished implementation checklist.

## Working conventions

Use repository-relative paths. No framework, package installation, or build
step is needed; the renderer uses Node.js built-ins. Keep the HTML offline and
self-contained. Check changed JavaScript with Node and smoke-test dashboard
changes with representative data in a browser. Synthetic data must be labelled
as test data and must never be presented as actual listings.

Verify current prices, availability, local specifications, and model-specific
recommendations with live sources. Keep seller claims distinct from verified
facts. Mileage per year is a descriptive metric, not a condition or value score.
Searching and preparing reports does not authorize contacting sellers.
