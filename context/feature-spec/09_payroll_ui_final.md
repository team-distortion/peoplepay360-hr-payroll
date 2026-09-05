# PeoplePay360 — Payroll Dashboard (`/dashboard`): Build Spec

Describes the Payroll Dashboard — the reporting surface that aggregates live data from Employees, Contracts, Attendance, Time Off, and Payroll into KPI cards, charts, and summary panels — plus the **complete application route map** for the whole platform, so this document can also serve as the routing reference tying together every module spec'd so far.

---

## 0. Complete Application Route Map

This supersedes the smaller route fragments listed in each individual module spec — treat this as the authoritative list.

```
/                              → Landing (redirects to /login or /dashboard)
/login                         → Auth page

/dashboard                     → Payroll Dashboard: KPIs, salary/attendance charts, alerts

/employees                     → Employee list (Kanban + List views)
/employees/:id                 → Employee form (the hub) — smart buttons to Contracts, Attendance, Time Off, Allocations

/contracts                     → Global contract list (dates, wage, active status)
/contracts/:id                 → Contract form (duration, department, position, wage, Salary Structure)

/schedules                     → Working schedule list (name, type, weekly hours)
/schedules/:id                 → Schedule form (day/start/end/break grid, auto-computed weekly hours)

/attendance                    → Global attendance list (check-in/out, worked hours, status)
/attendance/:id                → Attendance form (manual correction, restricted to authorized users)

/time-off/requests             → Time off request list (employee, type, dates, status)
/time-off/requests/:id         → Request form (approve/refuse workflow)
/time-off/allocations          → Allocation list (balances: taken/remaining/validity)
/time-off/allocations/:id      → Allocation form
/time-off/types                → Time off type config (units, approval rules, payroll integration)
/time-off/types/:id            → Type form

/payroll/structures            → Salary Structure list (rule count, employees, active status)
/payroll/structures/:id        → Structure form (manage included rules + sequence)
/payroll/rules                 → Salary rule list (name, code, category, sequence)
/payroll/rules/:id             → Rule form (fixed / percentage / formula computation)

/payroll/payruns               → Payrun list (historical + in-progress batches)
/payroll/payruns/new           → 2-step wizard: Step 1 scope+period → Step 2 employee selection
/payroll/payruns/:id           → Payrun processing screen: Compute, Validate, Mark Paid, Send Payslips
/payroll/payslips              → Global payslip list
/payroll/payslips/:id          → Payslip detail: rule breakdown (Basic/Allowance/Deduction/Gross/Net), Print PDF

/admin/users                   → User management (Admin role)
/admin/roles                   → Role & permission assignment
```

**Cross-references** (already spec'd in detail elsewhere — not repeated here):
- `/login` — see the HR Portal sign-in README.
- `/employees`, `/employees/:id` — see the Employees Dashboard README.
- `/contracts`, `/contracts/:id` — see the Contracts README.
- `/schedules`, `/schedules/:id` — see the Working Schedule README.
- `/attendance`, `/attendance/:id` — see the Attendance README.
- `/time-off/*` — see the Time Off Module README.
- `/admin/users` — see the User Management README (admin-only gate).
- `/admin/roles` — not yet detailed elsewhere; scaffold as a role-to-permission matrix editor consistent with the five roles in §6.
- `/payroll/structures`, `/payroll/rules`, `/payroll/payruns*`, `/payroll/payslips*` — **not yet detailed in any spec**; only referenced here as routing context/data sources feeding this dashboard. They'll need their own build spec later, informed by the PDF's sections A5, A6, B5–B8.

This document details **only** `/dashboard`.

---

## 1. Page Header

- **Title**: "Payroll Dashboard".
- **Subtitle**: "Dashboard should help payroll/HR users understand payments, staffing impact, leave patterns, and attendance quality for the selected period." — states the dashboard's purpose directly; treat this as a mission statement for what the page must communicate, not just descriptive copy.

---

## 2. Filter Bar

Four filter controls in a row directly below the header, each with a label above it:

| Field | Example value | Behavior |
|---|---|---|
| **Period** | "Sep 2026" | Selects the payroll period/month the dashboard reflects — likely a month picker |
| **Department** | "All Departments" | Dropdown; "All Departments" is the default/unfiltered state |
| **Employee Type** | "All Types" | Dropdown (e.g. full-time/contract/part-time); "All Types" is default |
| **Company** | "OXP Pvt Ltd" | Dropdown, for multi-company setups |

**Behavior**: every card, chart, and table on the page (§3–§5) must react to these four filters together — changing any one should recompute all downstream data, not just a subset of widgets. Treat this as a single shared filter state passed to every panel, not four independent controls.

---

## 3. KPI Card Row (5 cards)

Each card: small muted label at top, a large bold headline value, and a smaller colored (typically green) trend/context line beneath.

| Card | Value | Context line |
|---|---|---|
| **Total Net Salary Paid** | ₹18.4L | "+8.5% vs previous month" |
| **Payslips Generated** | 148 | "142 paid, 6 pending" |
| **Avg Salary / Employee** | ₹12,432 | "Based on current payrun" |
| **Approved Time Off Days** | 34 Days | "Across selected period" |
| **Attendance Health** | 94% | "Present / reviewed records" |

- All five sit in one row of equal-width cards.
- Context lines are shown in green here (positive/neutral framing) — the color should be conditional in a real implementation (e.g. red for a negative trend on Total Net Salary Paid), not hardcoded green.
- Per the PDF (B9): these should be **live metrics derived from actual system records** — Total Net Salary Paid and Payslips Generated come from Payslips/Payruns; Avg Salary/Employee from Payslips ÷ headcount; Approved Time Off Days from Time Off Requests; Attendance Health from Attendance records — not static placeholder numbers.

---

## 4. Middle Row — 3 Panels

### 4.1 Salary Cost by Department
- Source line: "Source: Payslips + Employee Department".
- **Bar chart**, one bar per department, value label above each bar.
- Sample data: HR ₹110k, Sales ₹150k, Support ₹90k, Finance ₹130k, IT ₹170k.
- Bars styled in a light accent color (soft blue), rounded top corners, consistent with the app's card/button radius language.

### 4.2 Monthly Net Salary Trend
- Source line: "Source: historical Payslips / Payruns".
- **Line chart**, x-axis = months (e.g. Apr–Sep), y-axis = net salary total.
- At least one data point is annotated directly on the chart with its value (e.g. "15.0L" near a peak) — support optional point callouts, not just axis labels.

### 4.3 Payslip Status & Payroll Alerts
- Source line: "Source: Payrun + Payslip validation".
- **Status split**: a single horizontal stacked bar showing proportional segments for four statuses — **Paid** (green, largest share), **Done** (blue), **Pending** (yellow), **Warning** (red/pink) — with a color-keyed legend listed below the bar.
- **Current alerts**: a list of specific, actionable warnings, each with a colored (red) bullet, e.g.:
  - "2 employees missing bank account"
  - "1 duplicate payslip warning"
  - "4 drafts still not validated"
  - "3 contracts expiring this month"
- Per the PDF (B9): these alerts should surface **payroll statuses, missing required information, duplicate payslips, and contract attention items** — i.e. this panel is meant to be an actionable pre-finalization checklist for payroll staff, not passive reporting. Each alert item should ideally be clickable, deep-linking to the specific record needing attention (e.g. the employee missing a bank account, the contract expiring soon).

---

## 5. Bottom Row — 4 Panels

### 5.1 Attendance Overview
- Source line: "Source: Attendance".
- Small bar chart with value labels above each bar: **Present** (94), **Late** (18), **Absent** (9), and a fourth bar for **Overtime**.
- A text callout block alongside the bars with three stats:
  - "Missing check-outs: 5"
  - "Manual attendance edits: 7"
  - "Attendance coverage: 94%"
- Per the PDF (B9): this overview should track "Present, Late, Absent, Overtime, missing check-outs, manual edits, and attendance coverage" — all seven data points belong together here, matching what's shown.

### 5.2 Time Off Overview
- Source line: "Source: Time Off Requests + Allocations".
- **Table**, columns: **Type**, **Approved Days**, **Pending**, **Remaining Balance**.
- Sample data:

  | Type | Approved Days | Pending | Remaining Balance |
  |---|---|---|---|
  | Paid Time Off | 24 | 3 | 118 Days |
  | Sick Leave | 6 | 1 | N/A |
  | Comp Off | 4 | 2 | 11 Days |

- "N/A" for Sick Leave's Remaining Balance reflects that this leave type doesn't require allocation (consistent with the Time Off Types spec — Sick Leave has "Allocation: No"), so there's no balance to track; the table must handle this null case gracefully rather than showing "0" or breaking.

### 5.3 Department Overview
- Source line: "Source: Employee + Contract + Payslip totals".
- **Table**, columns: **Department**, **Headcount**, **Monthly Salary**.
- Sample data:

  | Department | Headcount | Monthly Salary |
  |---|---|---|
  | IT | 18 | ₹4.2L |
  | Sales | 22 | ₹5.7L |
  | HR | 8 | ₹1.9L |
  | Support | 14 | ₹3.1L |

### 5.4 Models to Aggregate
- Heading: "Models to Aggregate".
- Subtext: "This is the actual challenge behind the dashboard." — this is a build note about engineering difficulty, not user-facing copy; **do not render this panel as literal on-page UI** in the final product — it documents the data-integration requirement behind the whole page.
- Bullet list (data sources this dashboard must join across):
  - Employees / Departments → headcount, ownership, grouping
  - Contracts → wage, schedule, active employees
  - Payruns / Payslips → salary totals, paid vs pending, trend data
  - Attendance → presence, absences, late entries, overtime
  - Time Off Requests / Allocations → leave taken and leave balances

  This confirms every panel above (§3–§5.3) is a live join across five source modules — the dashboard is not itself a data store; it's a real-time aggregation layer. Per the PDF: "The Payroll Dashboard must reflect real-time, live data generated from HR and payroll operations instead of relying on static charts."

---

## 6. Access Notes

Per the PDF's role definitions, this dashboard is a **Reporting** capability tied to Payroll access:
- **Employee** role: no access.
- **HR Manager**: no payroll access, so likely no access to this dashboard (or a reduced, non-payroll HR-only view if one is added later — not specified here).
- **HR Payroll User** and **HR Payroll Manager**: full access, consistent with their Payrun/Payslip permissions.
- **Admin**: full access.

Gate this route similarly to the "ADMIN ONLY" pattern used on `/admin/users`, but scoped to the Payroll-capable roles rather than Admin alone.

---

## 7. Animation & Motion Spec

Consistent with the rest of the app: ~100–250ms durations, ease-in/ease-out, no bounce — but a dashboard also benefits from a few load-in specific patterns since it's a data-dense page.

| Element | Animation |
|---|---|
| **Filter bar (Period/Department/Employee Type/Company)** | Dropdown open/close: fade + slight slide (~150ms), matching the nav dropdown pattern. On any filter change, the whole panel area below should soft-fade (~150ms fade-out → refresh data → ~200ms fade-in) rather than an abrupt re-render, so it reads as "updating," not "reloading." |
| **KPI cards (on page load or filter change)** | Numeric values count up from 0 (or from the previous value, on a filter change) to the new value over ~400–600ms with an ease-out curve — this is the single most impactful animation on the page since these are the first thing a user reads. Context lines (e.g. "+8.5%...") fade in ~100ms after the number finishes. |
| **KPI cards (stagger on load)** | The 5 cards animate in with a slight left-to-right stagger (~40ms delay between each), each fading + sliding up ~8px over ~200ms. |
| **Bar charts (Salary Cost by Department, Attendance Overview)** | Bars grow upward from 0 to their final height (~300–400ms ease-out), staggered slightly left to right (~30–50ms between bars) on load or filter change. Value labels fade in just as their bar finishes growing. |
| **Line chart (Monthly Net Salary Trend)** | Line draws in left-to-right (stroke-dashoffset animation or equivalent, ~500–600ms ease-out) on load; the annotated point callout (e.g. "15.0L") fades in after the line reaches it. |
| **Status split (stacked bar)** | Each segment (Paid/Done/Pending/Warning) grows in from the left edge in sequence (~200ms each, back-to-back) rather than all segments appearing at once — reinforces that it's a proportional breakdown being built up. |
| **Current alerts list** | Items fade + slide in from the right slightly, staggered (~50ms between items, ~150ms each) — treat new/newly-appearing alerts (e.g. after a filter change reveals a new warning) the same way, so users notice new items rather than a silent list change. |
| **Tables (Time Off Overview, Department Overview)** | Rows fade in with a slight stagger (~30–40ms per row, ~150ms each) on load; row hover gets a subtle background tint fade (~100ms), consistent with every other table in the app. |
| **Panel hover (any card/chart container)** | Very subtle shadow deepen on hover (~150ms) to reinforce these are distinct, individually-scoped data panels — avoid any lift/translate here, since these are dense information panels, not clickable action cards like Employee/Kanban cards. |
| **Alert item click-through (deep link to source record)** | Standard cross-fade page transition (~200ms), consistent with navigation elsewhere in the app. |

General rule for the agent: because this page's entire job is helping someone quickly read a lot of numbers, motion should be used to (a) draw attention to what just changed after a filter update, and (b) make first-load feel like data is "arriving," not to be decorative — keep everything quick, and never animate the same element twice in a row without a state change triggering it.