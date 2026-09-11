---
name: car-lookup
description: Help choose a suitable car in Israel, compare models against the buyer's needs, or search Yad2 and Facebook Marketplace listings and produce a local Hebrew comparison dashboard.
---

# Car Lookup

Start from the user's buying decision. Choose the appropriate mode below; a
specific listing query need not repeat a completed needs discussion. Paths
outside this skill are relative to the repository root containing `AGENTS.md`
and `template/results.html`. Keep conversation in the user's language.
When the task is to develop this platform, work on the workflow and tools first;
personal buying criteria belong to a later search session, not skill defaults.

## Understand the buyer

Read `buyer-profile.local.md` if it exists, and reuse answers in the conversation.
If the user has not chosen a car, ask a few high-impact questions at a time:

- Comfortable purchase budget, absolute ceiling, whether the ceiling includes
  initial costs, and city/search radius.
- Daily or annual driving, city/highway mix, passengers, child seats, boot needs,
  parking constraints, and any accessibility needs.
- Top priorities: reliability, running costs, safety equipment, comfort,
  performance, space, or driving position; models liked or excluded.

Follow up on transmission, ownership horizon, buying deadline, dealer or
ex-fleet preferences, and home/work charging only when relevant. Do not demand
a complete questionnaire before doing useful work.

Save confirmed answers in `buyer-profile.local.md`, with a last-updated date,
hard requirements, preferences, and unresolved questions. Label assumptions;
never turn examples or silence into confirmed preferences. Do not ask for an
exact home address or unnecessary personal details.

## Choose models

When the buyer is undecided, research a manageable shortlist against their
needs. For each candidate, specify relevant years, engine, transmission, and
local trim when known; show likely budget fit, reasons to consider it, main
tradeoffs, and what still needs checking.

Browse current sources before recommendations. Prefer manufacturer/importer
specifications, official recall information, and original safety-test reports
for technical claims; use dated local listings for asking-price ranges. Do not
transfer another market's engine, safety equipment, or test result to an Israeli
trim without evidence. Cite links and distinguish evidence from inference.

Assess suitability, ownership costs, condition/history, and price separately.
Do not invent precise fit scores or use low kilometres per year as a proxy for
reliability. Account for the user's priorities without silently choosing score
weights. Explain a first choice and alternatives; continue to listings when
the user's request and known constraints support it.

## Find and assess listings

Read [references/listings.md](references/listings.md) for source mechanics,
normalisation, and report format. Use available browser tools; there is no
dependency on a particular Claude MCP tool name. When using a browser-specific
skill, obey that browser's access rules.

1. Translate the request/profile into explicit filters. Keep a hard budget cap
   intact. Treat “around” as a target, and label any proposed range. Do not invent
   a maximum age, mileage ceiling, or engine filter when none was requested.
2. Search the relevant models and sources. Follow observed pagination rather
   than assuming a page-number scheme. Explain any access limitations. A blocked
   page is not evidence of zero matching cars.
3. Visit candidate detail pages and retain links, observation times, seller
   claims, missing fields, and conflicts. Check the user's constraints again
   after extraction, including Facebook results whose search filters may differ.
4. Exclude known violations from the matching shortlist. Keep plausible cars
   with unknown required fields marked `needs-check`; never call them confirmed
   matches. Unknown seller type is not automatically private.
5. Summarise the most relevant cars with reasons, tradeoffs, and targeted
   questions for the seller or an independent inspection. Drafting questions
   does not authorize sending them.
6. Save search data and coverage notes to `results/<descriptive-timestamp>.json`
   and render the HTML using `scripts/render-results.mjs`. Return a clickable
   local file link; open it when the environment supports it. Report exact
   filters, source counts, skipped/unavailable listings, and coverage limits.

If there are no verified results, report whether this means no matches, access
failure, or incomplete evidence. Save a report of the attempt; never substitute
synthetic listings. Suggest specific filter changes without applying a change
to a hard requirement unless the user has allowed it.
