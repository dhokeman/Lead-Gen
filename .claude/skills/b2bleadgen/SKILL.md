---
name: b2bleadgen
description: >
  B2B Lead Generation for IPV. Finds Indian IWM, AMC, MFO, PMS, and Boutique
  Wealth Advisory firms via Apollo, Google Search, Google Maps, LinkedIn, SEBI
  registries, and company websites. Identifies senior decision-makers (Founder,
  CEO, MD, CIO, Managing Partner), enriches email addresses via Apollo first then
  Clay (no phone number searching), deduplicates against all prior leads CSVs in the
  repo AND an uploaded CRM CSV, outputs a clean leads CSV, and automatically
  enrolls every lead into the "IPV Ultra – B2B Wealth Manager Partnership
  Outreach" Apollo sequence via jai.chachani@ipventures.in — no user approval
  required at any step.
  ALWAYS trigger on: /b2bleadgen, "find new B2B leads", "give me X leads",
  "don't overlap with previous", "Bangalore/Mumbai/Delhi leads", "add phone
  numbers", "wealth management leads for IPV", "MFO/PMS/IWM leads India",
  "enrich contacts", "generate more leads", "filter to city", or any request
  to find, screen, or enrich Indian financial services partner contacts.
---

# /b2bleadgen — IPV B2B Lead Generation Skill

## Overview

This skill automates the full B2B lead generation pipeline for **Inflection Point Ventures (IPV)**. It discovers net-new Indian financial services partners across IWM, AMC, MFO, PMS, and Boutique Wealth Advisory categories using **six parallel discovery sources**, enriches phone numbers via Apollo then Clay, and outputs a clean deduplicated CSV — then auto-enrolls every lead into the fixed Apollo sequence.

**Phone number searching is disabled.** Do not attempt to find or retrieve phone numbers via Apollo, Clay, or any other source at any point.

---

## Target Criteria

### Company Gate
- **Categories**: Independent Wealth Management (IWM), Asset Management Companies (AMCs), Multi-Family Offices (MFOs), Boutique Wealth Advisory
- Preferred size: **1–500 employees** (boutique to mid-sized firms)

**Mandatory Digital Presence (non-negotiable):**
- Must have a **functional website** (loads correctly, not under construction or parked)
- Must have an **active LinkedIn company page** with updated posts, employee count, and company description
- If either is missing or stale → **auto-reject**, do not include

**Hard Exclusion Categories — reject any lead from these sectors immediately:**
- 🚫 **Insurance Advisory**: Agents, brokers, insurance consultancies, LIC distributors, or any firm whose primary revenue is insurance commissions
- 🚫 **Real Estate**: Property brokers, developers, real estate advisory firms, property management companies, or hospitality PMS (hotel/resort management)
- 🚫 **Portfolio Management Apps / Retail Advisory**: Consumer-facing wealth apps (e.g., Kuvera, Groww, INDmoney), direct-to-retail PMS services with no HNI/institutional focus, or mass-market financial planning platforms
- 🚫 **Lending-only NBFCs**: Firms with no advisory or AUM function
- 🚫 **Large public sector banks or retail broking chains**
- 🚫 **EdTech / FinEd platforms** with no direct AUM management

### Seniority Gate
Only include contacts with these titles:
- Founder, Co-Founder
- Managing Partner
- CEO / Chief Executive Officer
- Managing Director
- CIO / Chief Investment Officer
- Chief Business Officer
- VP – Investment Products
- Principal / Principal Officer
- Wealth Manager (senior, HNI-focused)

---

## 5-Step Workflow

### Step 1 — Deduplication (Blacklist Extraction)

**This step is mandatory on every run — even when no CRM CSV is uploaded.**

#### 1a — Scan all previously generated leads CSVs in the repo
Run this every time before any discovery:
```bash
python3 - <<'EOF'
import glob, pandas as pd, json

blacklist_companies, blacklist_names = set(), set()

for f in glob.glob("leads_output_*.csv") + glob.glob("leads_*.csv"):
    try:
        df = pd.read_csv(f, encoding='latin1')
        if "Company / Firm" in df.columns:
            blacklist_companies.update(df["Company / Firm"].dropna().str.lower().str.strip())
        if "Partner Name" in df.columns:
            blacklist_names.update(df["Partner Name"].dropna().str.lower().str.strip())
    except Exception as e:
        print(f"Warning: could not read {f}: {e}")

print(json.dumps({"companies": sorted(blacklist_companies), "names": sorted(blacklist_names)}))
EOF
```
Any name or company found → added to the **master blacklist** immediately.

#### 1b — Scan uploaded CRM tracker (if provided)
If the user uploads a CRM tracker CSV:
1. Read with `python3` + `pandas` (`encoding='latin1'`; try `header=3` if columns are unnamed)
2. Extract all unique values from `"Company / Firm"` and `"Partner Name"` → lowercase, stripped
3. Merge into the master blacklist

#### 1c — Session memory blacklist
Blacklist any company or person from **leads generated earlier in this conversation**, even if not yet saved to a CSV.

> ⚠️ Never output a lead whose company OR person already exists in the master blacklist. Check both fields before including any row.

---

### Step 2 — Multi-Source Company & Contact Discovery

Run **all six sources in parallel** for every batch. Collect raw company names and LinkedIn URLs into a **discovery pool**, then apply the filtering rules once across the full pool.

---

#### Source A — Apollo Database (primary)

Use `Apollo.io:apollo_mixed_people_api_search`:

```
person_locations: ["<City>, <State>, India"]
person_seniorities: ["c_suite", "founder", "owner", "partner"]
person_titles: ["Founder", "Managing Partner", "CEO", "Managing Director", "CIO", "Co-Founder", "Principal"]
q_organization_keyword_tags: ["wealth management", "portfolio management", "investment advisory", "family office", "asset management", "PMS", "AIF", "SEBI registered", "HNI", "UHNI"]
organization_num_employees_ranges: ["1,10", "11,50", "51,200", "201,500"]
per_page: 25
```

Run at least **4 pages** per city. For 50+ leads, run pages 1–6 across two keyword sets.

---

#### Source B — Google Search

Use `WebSearch` to run the following queries (substitute `<city>` with the target city):

1. `"wealth management" OR "family office" OR "investment advisory" "<city>" site:linkedin.com/company`
2. `SEBI registered investment advisor "<city>" (Founder OR CEO OR "Managing Director")`
3. `"PMS" OR "AIF" OR "multi-family office" "<city>" wealth firm`
4. `"IWM" OR "independent wealth manager" "<city>" India`
5. `"boutique wealth" OR "private wealth" "<city>" India`

Extract all **company names** and **LinkedIn company URLs** from results → add to discovery pool.

---

#### Source C — Google Maps

Use `WebSearch` with map-intent queries to surface locally registered offices:

1. `wealth management firms in <city> India site:maps.google.com`
2. `"family office" in <city> India Google Maps`
3. `"investment advisory" firms near <city> India`
4. `portfolio management services <city> India`

Also try direct maps search: `https://www.google.com/maps/search/wealth+management+<city>+India` via `WebFetch`.

Extract business names, addresses, and websites → add company names to discovery pool.

---

#### Source D — LinkedIn Company Search

Use `WebSearch` with LinkedIn-specific queries:

1. `site:linkedin.com/company "wealth management" "<city>" India employees`
2. `site:linkedin.com/company "family office" India "<city>"`
3. `site:linkedin.com/company "portfolio management" OR "investment advisory" "<city>"`

Then use `WebFetch` on top LinkedIn company page URLs to extract:
- Company name
- Employee count (reject if <5 or >500)
- Description (apply sector exclusion check)
- Website URL

Add qualifying company names and LinkedIn URLs to discovery pool.

---

#### Source E — SEBI & Industry Registries

Use `WebFetch` to pull SEBI and industry listing pages:

1. **SEBI Registered Investment Advisors list**: `https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=13` — extract firm names in the target city
2. **SEBI PMS providers list**: `https://www.sebi.gov.in/sebiweb/other/OtherAction.do?doRecognisedFpi=yes&intmId=47` — extract firm names
3. **AMFI registered distributors/advisors**: `https://www.amfiindia.com/research-information/other-data/distributor-wise-data` — filter by city
4. **NSE/BSE member search**: WebSearch for `NSE member wealth advisory "<city>"` to surface registered brokers with advisory arms

Extract firm names from all sources → add to discovery pool.

---

#### Source F — Company Websites & Directories

Use `WebSearch` + `WebFetch` on industry aggregator sites:

1. `WebSearch`: `top IWM firms India "<city>" 2024 OR 2025`
2. `WebSearch`: `"multi-family office" India list "<city>"`
3. `WebFetch` on result pages from platforms like Tracxn, Crunchbase, or financial media (Economic Times Wealth, Mint) to extract firm names
4. `WebFetch` on any firm website found to verify: active site, wealth/HNI focus, team page (confirm senior leadership)

---

#### Discovery Pool Filtering (apply after all 6 sources)

For every company name collected across all sources:
- **Blacklist check**: reject if company name matches master blacklist (case-insensitive, stripped)
- **Sector check**: reject if description/website mentions insurance, real estate, hospitality, retail-only, or lending
- **Size check**: reject if LinkedIn shows >500 or <5 employees
- **Digital presence check**: must have a working website AND active LinkedIn page
- **Dedup within pool**: collapse duplicate company names from different sources into one entry, noting all source origins

---

### Step 3 — Contact Enrichment (Apollo → Clay)

For every company in the filtered discovery pool, enrich to find senior contacts and phone numbers. **Do not search for email addresses at any point in this step.**

#### 3a — Find contacts via Apollo (for non-Apollo source companies)

For companies discovered via Sources B–F (not already surfaced with contacts by Apollo in Step 2), run `Apollo.io:apollo_mixed_people_api_search` filtered by organisation name to find senior contacts matching the Seniority Gate.

#### 3b — Enrich every contact via Apollo people match

For each identified contact (from all sources), call `Apollo.io:apollo_people_match` using the Apollo person ID or name + organization to retrieve:
- Full name (unmasked)
- Title
- Work email address (`email` field, `email_status` field)
- LinkedIn URL
- City

**Do not request, read, or store any phone number fields.** Ignore `phone_numbers`, `sanitized_phone`, `direct_dial_status` in the response entirely.

Store the `person.contact.id` (24-char hex) from each result — required for Step 5 enrollment.
Store the `person.email` and `person.email_status` for the output CSV.

#### 3c — Clay email enrichment (for contacts with no Apollo email)

For any contact where Apollo returned no email (or `email_status` is `unavailable`), call `Clay:find-and-enrich-contacts-at-company` or `Clay:find-and-enrich-list-of-contacts` to retrieve:
- Work email address only

**Do not request or use phone fields from Clay responses.**

If Clay also returns no email → mark email as `N/A`. Never fabricate.

For bulk batches (50+ contacts), use `Apollo.io:apollo_people_bulk_match` or `Clay:run_subroutine` for batch email enrichment.

---

### Step 4 — Output

Apply final quality checks, then format all confirmed leads as a CSV.

**Final checks before output:**
- Re-run blacklist check on every row (company name + person name)
- Cap at **2 contacts per company**
- Reject any title below the Seniority Gate
- Confirm phone is present or marked `N/A`

**CSV headers (exact):**
```
Partner Name,Designation,Company / Firm,Email,LinkedIn,Company Website,Discovery Source,Source Category,City
```

> Email is populated from Apollo `person.email` (Step 3b) or Clay fallback (Step 3c). Mark as `N/A` if neither returns one — never fabricate.
> Discovery Source records which of the 6 sources first surfaced this company (e.g., "Apollo", "Google Search", "LinkedIn", "SEBI Registry", "Google Maps", "Web Directory").
> Phone column is intentionally omitted — phone numbers are not searched for.

Output inside a fenced code block. No trailing commas. No empty rows.

After the CSV:
- Add a **Coverage Summary** by Source Category count and by Discovery Source count
- Add a short **IPV Fit Note** for 3–5 standout leads

---

### Step 5 — Apollo Sequence Enrollment (Mandatory, Fully Automatic)

**Every confirmed lead must be enrolled immediately after Step 4. Do not skip. Do not ask the user for approval.**

**Fixed configuration (never change without explicit instruction):**
- **Sequence**: `IPV Ultra – B2B Wealth Manager Partnership Outreach`
- **Sender**: `jai.chachani@ipventures.in`

#### 5a — Resolve the sequence ID
Call `Apollo.io:apollo_emailer_campaigns_search` with `q_name = "IPV Ultra"`.
Select the result matching `IPV Ultra – B2B Wealth Manager Partnership Outreach` exactly. Store its `id` as `TARGET_SEQUENCE_ID`.

#### 5b — Resolve the sender account ID
Call `Apollo.io:apollo_email_accounts_index`.
Select the account whose email matches `jai.chachani@ipventures.in`. Store its `id` as `SENDER_ACCOUNT_ID`.

#### 5c — Enroll immediately
Call `Apollo.io:apollo_emailer_campaigns_add_contact_ids` with:
- `id` = `TARGET_SEQUENCE_ID`
- `emailer_campaign_id` = `TARGET_SEQUENCE_ID`
- `contact_ids` = list of `person.contact.id` values collected in Step 3b during Apollo enrichment (exact 24-char hex from this session only — never use placeholders or IDs from memory)
- `send_email_from_email_account_id` = `SENDER_ACCOUNT_ID`
- `status` = `"active"`

#### 5d — Report result
```
✅ Enrolled N contacts into "IPV Ultra – B2B Wealth Manager Partnership Outreach" via jai.chachani@ipventures.in
   Failed: <name> — <reason>   (only if any failed)
```

---

## Location Targeting

When the user specifies a city, inject it into all discovery sources:

| User Request | Apollo `person_locations` | Search query city term |
|---|---|---|
| Bangalore / Bengaluru | `["Bangalore, Karnataka, India", "Bengaluru, Karnataka, India"]` | `"Bangalore" OR "Bengaluru"` |
| Mumbai | `["Mumbai, Maharashtra, India"]` | `"Mumbai"` |
| Delhi / NCR | `["New Delhi, Delhi, India", "Gurugram, Haryana, India", "Noida, Uttar Pradesh, India"]` | `"Delhi" OR "Gurugram" OR "Noida"` |
| Chennai | `["Chennai, Tamil Nadu, India"]` | `"Chennai"` |
| Hyderabad | `["Hyderabad, Telangana, India"]` | `"Hyderabad"` |
| Pan-India | omit `person_locations` | omit city term |

---

## Batch Size Guidelines

| Requested Leads | Apollo Pages | Non-Apollo Sources | Enrichment |
|---|---|---|---|
| 1–15 | 1–2 pages | Run all 6 sources, light scrape | Single apollo_people_match per contact |
| 16–50 | 3–5 pages | Full scrape all 6 sources | Batch Apollo then Clay |
| 51–110 | 5–8 pages × 2 keyword sets | Full scrape + SEBI/AMFI full list | Bulk match via apollo_people_bulk_match + Clay |
| 110+ | Split into city batches | Split source scraping by city | Bulk with rate-limit awareness |

---

## Quality Control Rules

1. **Hard sector exclusions**: Never output a lead from Insurance Advisory, Real Estate, Portfolio Management Apps/Retail Advisory, hospitality, or lending-only NBFCs — regardless of title
2. **No phone number searching**: Do not attempt to find, request, or store phone numbers via Apollo, Clay, or any other source at any step
3. **Never fabricate** email addresses or LinkedIn URLs — mark as `N/A` if not found
4. **Mandatory digital presence check**: Every company must have a functional website AND active LinkedIn page — no exceptions
5. **Cap per-company leads** at 2 contacts maximum
6. **Reject** leads with seniority below the gate (Analysts, Associates, Relationship Managers)
7. **Blacklist check is mandatory** — run before outputting even a single row
8. **Discovery Source must be recorded** for every lead — never leave that column blank

---

## Conversation Memory

Track across the full session:
- `session_blacklist_companies[]` — grows with every generated batch
- `session_blacklist_names[]` — grows with every generated batch
- `city_filter` — last user-specified city (persist until changed)
- `total_leads_generated` — running count
- `discovery_pool[]` — company names gathered this session (avoid re-scraping same source twice)

When the user says "give me more" or "don't overlap", automatically apply the full session blacklist without asking.

---

## Connector Dependencies

| Tool | Purpose |
|---|---|
| `Apollo.io:apollo_mixed_people_api_search` | Source A discovery + Source B–F contact lookup by org |
| `Apollo.io:apollo_people_match` | Per-contact enrichment (name, phone, LinkedIn) |
| `Apollo.io:apollo_people_bulk_match` | Bulk enrichment for 50+ contacts |
| `Apollo.io:apollo_emailer_campaigns_search` | Resolve sequence ID (Step 5) |
| `Apollo.io:apollo_email_accounts_index` | Resolve sender account ID (Step 5) |
| `Apollo.io:apollo_emailer_campaigns_add_contact_ids` | Enroll contacts into sequence (Step 5) |
| `Clay:find-and-enrich-contacts-at-company` | Email enrichment fallback (Step 3c) |
| `Clay:find-and-enrich-list-of-contacts` | Batch email enrichment fallback |
| `Clay:run_subroutine` | Bulk Clay email enrichment |
| `WebSearch` | Google Search (Source B), Google Maps (Source C), LinkedIn (Source D), directories (Source F) |
| `WebFetch` | Fetch LinkedIn company pages, SEBI/AMFI registry pages, company websites (Sources D, E, F) |

---

## Output Format (exact CSV headers)

```csv
Partner Name,Designation,Company / Firm,Email,LinkedIn,Company Website,Discovery Source,Source Category,City
```

Always output inside a fenced code block. No trailing commas. No empty rows. Phone column intentionally absent.

---

## Example Trigger Phrases

- `/b2bleadgen`
- `Give me 50 Bangalore leads, no overlap with existing CSV`
- `Find 10 MFO leads in Chennai with phone numbers`
- `Generate new wealth management leads for IPV`
- `Find me 110 leads specific to Bangalore using Apollo and Clay`
- `Give me 5 more leads, don't repeat previous ones`
- `Add phone numbers to these leads using Clay`
