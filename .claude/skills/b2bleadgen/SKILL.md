---
name: b2bleadgen
description: >
  B2B Lead Generation for IPV. Finds Indian IWM, AMC, MFO, PMS, and Boutique
  Wealth Advisory firms, identifies senior decision-makers (Founder, CEO, MD,
  CIO, Managing Partner), enriches emails and phone numbers via Apollo and Clay,
  deduplicates against an uploaded CRM CSV, and outputs a clean leads CSV.
  ALWAYS trigger on: /b2bleadgen, "find new B2B leads", "give me X leads",
  "don't overlap with previous", "Bangalore/Mumbai/Delhi leads", "add phone
  numbers", "wealth management leads for IPV", "MFO/PMS/IWM leads India",
  "enrich contacts", "generate more leads", "filter to city", or any request
  to find, screen, or enrich Indian financial services partner contacts.
---

# /b2bleadgen — IPV B2B Lead Generation Skill

## Overview

This skill automates the full B2B lead generation pipeline for **Inflection Point Ventures (IPV)**. It finds net-new Indian financial services partners across IWM, AMC, MFO, PMS, and Boutique Wealth Advisory categories, enriches contact data (email + phone), and outputs a clean, deduplicated CSV.

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

**MANDATORY — always run this step before any search, even if the user provides no CSV.**

1. **Always** read `leads_2026-05-22.csv` from the repo root using `python3` (`encoding='utf-8'`). Extract:
   - All unique **company names** from the `"Company / Firm"` column → lowercase, stripped
   - All unique **partner names** from the `"Partner Name"` column → lowercase, stripped
2. If the user also uploads a separate CSV tracker file, additionally read it (`encoding='latin1'`; try `header=3` if default columns are unnamed) and extract company names from `"Company / Firm"` and partner names from `"Partner Name"`.
3. Also blacklist any companies or names from **previously generated leads in this conversation**.
4. Merge all three sources into the **master blacklist** — no lead from this session may match any entry.

> ⚠️ Never output a lead whose company OR person already exists in the blacklist. Check both.
> ⚠️ The `leads_2026-05-22.csv` check is non-negotiable — run it on every invocation.

---

### Step 2 — Company & Contact Discovery

Run **multiple Apollo searches** (pages 1–5+) using `Apollo.io:apollo_mixed_people_api_search` with these parameters:

```
person_locations: ["<City>, <State>, India"]  ← inject user-specified city
person_seniorities: ["c_suite", "founder", "owner", "partner"]
person_titles: [Founder, Managing Partner, CEO, Managing Director, CIO, Co-Founder, Principal]
q_organization_keyword_tags: ["wealth management", "portfolio management", "investment advisory", "family office", "asset management", "PMS", "AIF", "SEBI registered", "HNI", "UHNI"]
organization_num_employees_ranges: ["1,10", "11,50", "51,200", "201,500"]
contact_email_status: ["verified", "likely to engage"]
per_page: 25
```

Run at least **4 Apollo pages** per city. For large targets (50+ leads), run pages 1–6 across both keyword sets.

Also run `Vibe Prospecting:fetch-entities` when available for additional company discovery:
```
entity_type: prospects
filters: company_country_code=IN, has_email=true, has_website=true, linkedin_category=[investment management, financial services, funds and trusts]
```

**Filtering rules after each Apollo pull:**
- Remove any person whose `organization.name` matches the blacklist (case-insensitive)
- **Hard reject** any company in the exclusion categories: Insurance Advisory, Real Estate, Portfolio Management Apps / Retail Advisory, lending NBFCs, EdTech
- If company description mentions "insurance", "property", "real estate", "broker", "hospitality", "hotel PMS", "retail investors", "mutual fund distributor only" → reject
- Remove anyone with a generic title not matching the Seniority Gate
- Remove duplicates within the current batch (same person from multiple pages)
- Spot-check LinkedIn company page: if page has <50 followers, no posts in 12+ months, or no employee listed → reject

---

### Step 3 — Phone Number Enrichment (Clay)

For each confirmed clean lead, run `Clay:find-and-enrich-contacts-at-company` or `Clay:find-and-enrich-list-of-contacts` to retrieve:
- Direct mobile / office phone number
- Verify email if not already confirmed

If Clay returns no phone, mark the phone field as `N/A` — never fabricate.

For bulk batches (50+ leads), use `Apollo.io:apollo_people_bulk_match` or `Clay:run_subroutine` for batch phone enrichment.

---

### Step 4 — Email Enrichment & Verification

For each lead:
1. **Priority**: Use email directly returned by Apollo if `contact_email_status = verified`
2. **Secondary**: Pattern-match from company domain (e.g., `firstname@companydomain.com`)
   - Cross-check domain via company website
   - Signal sources: ZoomInfo, RocketReach, ContactOut, MCA filings, SEBI disclosures
3. **Reject**: `info@`, `contact@`, `admin@`, `support@`, or any generic inbox
4. **Flag emails**: 🟢 Verified (SEBI/MCA/ZoomInfo confirmed) | 🟡 Pattern-matched (domain confirmed) | 🟠 Inferred (domain only)

---

### Step 5 — Output

Format all confirmed leads as a CSV block with **exactly these headers**:

```
Partner Name, Designation, Company / Firm, Email, Phone, LinkedIn, Company Website, Source Category, City
```

After the CSV:
- Add a **Quality Legend** (🟢/🟡/🟠 email signals)
- Add a **Coverage Summary** by Source Category count
- Add a short **IPV Fit Note** for 3–5 standout leads

Then immediately proceed to **Step 6** without waiting for the user.

---

### Step 6 — Persist to Master File & Enroll in Apollo Sequence

Run both sub-steps automatically after every successful lead generation batch:

#### 6a — Append to Master Leads File
Append all net-new leads (not duplicates) to `leads_2026-05-22.csv` in the repo root using `python3`:
```python
import csv

new_leads = [...]  # list of dicts with the 9 standard headers

headers = ['Partner Name','Designation','Company / Firm','Email','Phone','LinkedIn','Company Website','Source Category','City']

with open('leads_2026-05-22.csv', 'a', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=headers)
    writer.writerows(new_leads)
```
Then `git add leads_2026-05-22.csv && git commit -m "Add N enriched leads – <date>"` and push to the current branch.

#### 6b — Enroll in Apollo Sequence
For every net-new lead that has a verified email:
1. Call `Apollo.io:apollo_emailer_campaigns_search` to find the active IPV campaign (search keyword: `"IPV"` or `"B2B Wealth"`).
2. Call `Apollo.io:apollo_emailer_campaigns_add_contact_ids` with the Apollo contact ID(s) from the enrichment step.
3. If no Apollo contact ID is available, skip sequence enrollment for that lead and note it in the output summary.
4. Report a per-lead enrollment status: ✅ Enrolled / ⚠️ No ID / ❌ Error.

> ⚠️ Never enroll a lead that was skipped as a duplicate — blacklist check in Step 1 is the gate.
> ⚠️ If `apollo_emailer_campaigns_add_contact_ids` fails for a lead, log the error and continue — do not abort the batch.

---

## Location Targeting

When the user specifies a city, inject it into Apollo's `person_locations` param:

| User Request | Apollo Param |
|---|---|
| Bangalore / Bengaluru | `["Bangalore, Karnataka, India", "Bengaluru, Karnataka, India"]` |
| Mumbai | `["Mumbai, Maharashtra, India"]` |
| Delhi / NCR | `["New Delhi, Delhi, India", "Gurugram, Haryana, India", "Noida, Uttar Pradesh, India"]` |
| Chennai | `["Chennai, Tamil Nadu, India"]` |
| Hyderabad | `["Hyderabad, Telangana, India"]` |
| Pan-India | omit `person_locations` |

---

## Batch Size Guidelines

| Requested Leads | Apollo Pages | Clay Enrichment |
|---|---|---|
| 1–15 | 1–2 pages | Single-call enrichment |
| 16–50 | 3–5 pages | Batch enrichment |
| 51–110 | 5–8 pages across 2 keyword sets | Bulk match via Clay/Apollo |
| 110+ | Suggest splitting into city batches | Bulk with rate-limit awareness |

> For 100+ leads, run **two separate Apollo searches** — one with `wealth management` tags, one with `PMS/AIF/SEBI` tags — then merge and deduplicate.

---

## Quality Control Rules

1. **Hard sector exclusions**: Never output a lead from Insurance Advisory, Real Estate, Portfolio Management Apps/Retail Advisory, hospitality, logistics, or lending-only NBFCs — even if title matches
2. **Never fabricate** phone numbers, emails, or LinkedIn URLs — mark as `N/A` if not found
3. **Mandatory digital presence check**: Verify every company has (a) a functional website and (b) an active LinkedIn company page before including — no exceptions
4. **Cap per-company leads** at 2 contacts maximum (to avoid over-indexing one firm)
5. **Reject** leads with seniority below the gate (e.g., Analysts, Associates, Relationship Managers)
6. **Blacklist check is mandatory** — run it before outputting even a single row
7. ~~Professional Tenure Bar~~ — **REMOVED**: Do not filter based on years of experience
8. ~~Education Bar~~ — **REMOVED**: Do not filter based on degree type or institution tier

---

## Conversation Memory

Track the following across the full session:
- `session_blacklist_companies[]` — grows with every generated batch
- `session_blacklist_names[]` — grows with every generated batch
- `city_filter` — last user-specified city (persist until changed)
- `total_leads_generated` — running count

When the user says "give me more" or "don't overlap", automatically apply the full session blacklist without asking.

---

## Connector Dependencies

| Tool | Purpose |
|---|---|
| `Apollo.io:apollo_mixed_people_api_search` | Primary contact discovery |
| `Apollo.io:apollo_contacts_search` | Supplemental search |
| `Apollo.io:apollo_people_match` | Single-contact full enrichment (email + phone) |
| `Apollo.io:apollo_people_bulk_match` | Bulk phone/email enrichment |
| `Apollo.io:apollo_emailer_campaigns_search` | Find active IPV Apollo sequences |
| `Apollo.io:apollo_emailer_campaigns_add_contact_ids` | Enroll leads into sequence (Step 6b) |
| `Clay:find-and-enrich-contacts-at-company` | Phone number enrichment |
| `Clay:find-and-enrich-list-of-contacts` | Batch contact enrichment |
| `Vibe Prospecting:fetch-entities` | Company-level discovery |
| `web_search` | Email verification, LinkedIn cross-check |

> Read `references/enrichment-patterns.md` for domain-based email construction patterns and SEBI filing lookup instructions.
> **Master dedup file**: `leads_2026-05-22.csv` in repo root — always read in Step 1, always append in Step 6a.

---

## Output Format (exact CSV headers)

```csv
Partner Name,Designation,Company / Firm,Email,Phone,LinkedIn,Company Website,Source Category,City
```

Always output inside a fenced code block. No trailing commas. No empty rows.

---

## Example Trigger Phrases

- `/b2bleadgen`
- `Give me 50 Bangalore leads, no overlap with existing CSV`
- `Find 10 MFO leads in Chennai with phone numbers`
- `Generate new wealth management leads for IPV`
- `Find me 110 leads specific to Bangalore using Apollo and Clay`
- `Give me 5 more leads, don't repeat previous ones`
- `Add phone numbers to these leads using Clay`
