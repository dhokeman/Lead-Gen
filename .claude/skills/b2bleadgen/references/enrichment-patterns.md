# Email & Phone Enrichment Reference

## Domain-Based Email Patterns (India Fintech Standard)

For SEBI-registered boutique firms in India, the following patterns are standard (in order of priority):

| Pattern | Example | Confidence |
|---|---|---|
| `firstname@domain.com` | `sameer@trustplutus.com` | 🟡 High |
| `firstname.lastname@domain.com` | `sameer.kaul@trustplutus.com` | 🟡 High |
| `f.lastname@domain.com` | `s.kaul@trustplutus.com` | 🟠 Medium |
| `firstname@domain.in` | `sameer@mehtawealth.in` | 🟡 High |

### Domain Lookup Order
1. Company website `Contact Us` page → direct email
2. SEBI PMS/RIA disclosure document → Principal Officer email (search: `site:sebi.gov.in [company name]`)
3. MCA filing → Director email on record
4. RocketReach / ZoomInfo partial reveal → confirm first 1–2 chars, construct full
5. LinkedIn `Contact Info` section → some founders list emails publicly

---

## SEBI Disclosure Document Lookup

Many PMS and RIA firms publish SEBI-mandated disclosure documents with contact emails. Steps:
1. `web_search`: `"[Company Name]" SEBI disclosure document PDF 2024 OR 2025`
2. Look for `site:pmsbazaar.com/AMC/[company]` — these pages often list the principal officer email
3. Look for `"Principal Officer"` or `"Compliance Officer"` in document text

---

## Phone Enrichment via Clay

### Single Contact
```
Clay:find-and-enrich-contacts-at-company
  company: [Company Name]
  role: CEO / Founder / Managing Partner
```

### Batch (10+ contacts)
```
Clay:find-and-enrich-list-of-contacts
  contacts: [{name, company, linkedin_url}, ...]
```

### Fallback: Apollo Bulk Match
```
Apollo.io:apollo_people_bulk_match
  [{first_name, last_name, organization_name, linkedin_url}]
```

Phone output format: `+91-XXXXXXXXXX` (India standard)
If no phone found: `N/A` — never fabricate

---

## LinkedIn URL Construction

If LinkedIn URL not returned by Apollo, construct as:
`https://www.linkedin.com/in/[firstname-lastname]/`

Always verify by cross-referencing the name + company in web search before including.

---

## Source Category Taxonomy

| Category | Abbreviation | SEBI Registration Type |
|---|---|---|
| Independent Wealth Management | IWM | RIA (Investment Adviser) |
| Multi-Family Office | MFO | RIA + Portfolio Manager |
| Portfolio Management Services | PMS | Portfolio Manager |
| Asset Management Company | AMC | Mutual Fund / AIF Manager |
| Boutique Wealth Advisory | BWA | RIA / Non-registered advisory |

---

## Companies to Always Exclude (Hard Sector Blacklist)

These firm types must be **immediately rejected** — no exceptions, even if Apollo keyword tags match:

**🚫 Insurance Advisory**
- Insurance agents, brokers, LIC distributors, IRDAI-registered advisories
- Firms whose primary revenue is commission on life/health/general insurance policies
- Keywords to flag: "insurance", "IRDAI", "LIC distributor", "health cover", "term plan advisor"

**🚫 Real Estate**
- Property brokers, developers, real estate consultancies, land advisory firms
- Hospitality PMS (hotel/resort property management — NOT portfolio management)
- Keywords to flag: "real estate", "property", "sq. ft.", "hospitality", "hotel management", "RERA"

**🚫 Portfolio Management Apps / Retail Advisory**
- Consumer-facing wealth apps targeting retail/mass-market investors (Kuvera, Groww, INDmoney, Scripbox, etc.)
- Direct-to-consumer PMS services with no HNI/institutional focus
- Mutual fund distribution platforms without advisory/wealth management function
- Keywords to flag: "retail investors", "SIP calculator", "mutual fund distributor only", "mass market", "robo-advisor"

**🚫 Other Auto-Rejects**
- Lending-only NBFCs (no AUM or advisory function)
- Public sector banks and their subsidiaries
- Commodity-only brokers with no wealth management arm
- EdTech / FinEd platforms without direct AUM management
- Payroll, HR-tech, or accounting SaaS firms

> When in doubt: the firm must manage client portfolios (AUM) or provide fee-based investment advice (RIA) as its PRIMARY business. If neither → exclude.

## Digital Presence Verification Checklist

Before including any company, confirm:
- [ ] Website loads correctly (not parked, under construction, or 404)
- [ ] LinkedIn company page exists with: employee count listed, description filled, at least some recent activity
- [ ] Company is not dissolved / struck off (check MCA portal if uncertain)

If any check fails → reject the lead.
