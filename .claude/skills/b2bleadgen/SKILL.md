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

### Step 0 — Repo Blacklist Auto-Load (MANDATORY, runs every time)

**Before any discovery, always load the full historical blacklist from the repository.** Do not skip this step even if the user says nothing about duplicates.

1. Use `mcp__github__get_file_contents` to list the root of `ipvcore26-svg/lead-gen` (default branch + feature branch `claude/zealous-newton-9b49w`).
2. Find every file matching `leads_*.csv` in the repo root.
3. For each file found, fetch its contents and extract:
   - All values in the `"Partner Name"` column → lowercase, stripped → add to `repo_blacklist_names[]`
   - All values in the `"Company / Firm"` column → lowercase, stripped → add to `repo_blacklist_companies[]`
4. Merge with any names/companies generated **earlier in this conversation session** into a single **master blacklist**.
5. Log the blacklist size before proceeding: e.g. `"Blacklist loaded: 12 names, 10 companies from repo + session."`

> ⛔ This step is non-optional. If the GitHub tool call fails, warn the user and halt — do not proceed with discovery until the blacklist is confirmed.

---

### Step 1 — User-Provided CRM Deduplication (if applicable)
If the user also uploads or references a CRM/tracker CSV file:
1. Read it using `bash_tool` with `python3` and `pandas` (use `encoding='latin1'` for robustness; try `header=3` if default columns are unnamed)
2. Extract **all unique company names** from `"Company / Firm"` column → lowercase, stripped
3. Extract **all unique partner names** from `"Partner Name"` column → lowercase, stripped
4. Merge into the **master blacklist** (additive — do not replace Step 0 entries)

> ⚠️ Never output a lead whose company OR person already exists in the master blacklist. Check both fields independently.

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

---

### Step 6 — Apollo Sequence Enrollment (MANDATORY, runs after every batch)

After saving leads to the repo CSV, enroll every new lead into an Apollo sequence. Do not skip this step and do not terminate before completing it.

#### 6a — Identify the Sequence
1. Call `Apollo.io:apollo_emailer_campaigns_search` with `q_name: "IPV Ultra – B2B Wealth Manager Partnership Outreach"` to retrieve the sequence ID.
2. Always use this sequence. Do not prompt the user to choose a sequence.
3. Record the sequence `id` (24-char hex).

#### 6b — Get Sender Email Account
1. Call `Apollo.io:apollo_email_accounts_index` to retrieve email accounts.
2. Always use the account matching `Jai.chechani@ipventures.in`. Do not prompt the user to choose.
3. Record the `id` of that account as `send_email_from_email_account_id`.

#### 6c — Ensure Contacts Exist in Apollo
For each lead in the current batch:
1. Call `Apollo.io:apollo_contacts_search` with `q_keywords: "<Partner Name> <Company / Firm>"` to check if the contact already exists.
2. If found → record their Apollo `id`.
3. If not found → call `Apollo.io:apollo_contacts_bulk_create` (preferred) or `Apollo.io:apollo_contacts_create` with `run_dedupe: true` to create the contact. Fields to populate:
   - `first_name`, `last_name` (split from Partner Name)
   - `title` (Designation)
   - `organization_name` (Company / Firm)
   - `email` (strip emoji quality flag before passing)
   - `direct_phone` (if not N/A)
   - `website_url` (Company Website)
   - `present_raw_address` (City + ", India")
4. Record the returned Apollo `id` for each contact.

#### 6d — Enroll Contacts (no approval needed)
Call `Apollo.io:apollo_emailer_campaigns_add_contact_ids` immediately — full permission is granted, no confirmation prompt required:
- `id` and `emailer_campaign_id` — both set to the sequence ID from 6a
- `contact_ids` — array of real Apollo contact IDs from 6c (24-char hex strings only; never use placeholders)
- `send_email_from_email_account_id` — from 6b
- `status: "active"`

#### 6e — Report and Terminate
After the API call returns, report:
- How many contacts were successfully enrolled
- Any contacts that failed (and why, if the API gives a reason)

Then terminate. Do not proceed to any further discovery.

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
6. **Pre-output blacklist gate (non-negotiable)**: Immediately before writing each row to the final CSV, check BOTH `Partner Name` AND `Company / Firm` against the master blacklist (Step 0 + Step 1 + session). If either field matches → silently drop the row and continue to the next candidate. Never output a duplicate row.
7. **Append new leads to session blacklist**: After outputting, add every `Partner Name` and `Company / Firm` from the batch to `session_blacklist_names[]` and `session_blacklist_companies[]` so subsequent requests in the same session are also deduplicated.
8. **After output, append to repo CSV**: Save the new leads by appending rows to the relevant `leads_*.csv` file in the repo (or create a new dated file) and commit. This ensures the next session's Step 0 load picks them up automatically.
9. ~~Professional Tenure Bar~~ — **REMOVED**: Do not filter based on years of experience
10. ~~Education Bar~~ — **REMOVED**: Do not filter based on degree type or institution tier

---

## Conversation Memory

Track the following across the full session:
- `session_blacklist_companies[]` — seeded from repo CSV (Step 0) at session start, then grows with every generated batch
- `session_blacklist_names[]` — seeded from repo CSV (Step 0) at session start, then grows with every generated batch
- `city_filter` — last user-specified city (persist until changed)
- `total_leads_generated` — running count

**The session blacklist is always active** — do not wait for the user to say "no overlap". It applies automatically on every run.

When the user says "give me more" or "don't overlap", confirm the current blacklist size to the user (e.g. "Excluding 14 previously seen names and 12 companies") before running discovery.

---

## Connector Dependencies

| Tool | Purpose |
|---|---|
| `Apollo.io:apollo_mixed_people_api_search` | Primary contact discovery |
| `Apollo.io:apollo_contacts_search` | Check if contact already exists in Apollo DB |
| `Apollo.io:apollo_contacts_bulk_create` | Create new contacts in Apollo DB (preferred) |
| `Apollo.io:apollo_contacts_create` | Create single contact in Apollo DB (fallback) |
| `Apollo.io:apollo_people_bulk_match` | Bulk phone/email enrichment |
| `Apollo.io:apollo_emailer_campaigns_search` | Find target sequence by name/ID |
| `Apollo.io:apollo_email_accounts_index` | Get valid sender email account IDs |
| `Apollo.io:apollo_emailer_campaigns_add_contact_ids` | Enroll contacts into sequence |
| `Clay:find-and-enrich-contacts-at-company` | Phone number enrichment |
| `Clay:find-and-enrich-list-of-contacts` | Batch contact enrichment |
| `Vibe Prospecting:fetch-entities` | Company-level discovery |
| `web_search` | Email verification, LinkedIn cross-check |

> Read `references/enrichment-patterns.md` for domain-based email construction patterns and SEBI filing lookup instructions.

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
