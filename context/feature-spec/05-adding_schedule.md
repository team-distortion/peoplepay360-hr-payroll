# PeoplePay360 — Working Schedule (`/schedules`): Build Spec

Describes the `/schedules` route across its two connected states — **Working Schedule List** and **Working Schedule Form (one schedule)** — plus the underlying business rules that govern how schedules relate to Employees, Contracts, Attendance, and Payroll.

## Routes

```
/schedules            → Working Schedule List (name, type, weekly hours)
/schedules/:id        → Schedule Form (day/start/end/break grid, auto-computed weekly hours)
```

---

## 1. View 1 — Working Schedule List (`/schedules`)

### 1.1 Header row
- **Title**: "Working Schedules" — bold, left-aligned in the page's top band.
- **"+ New Schedule" button**: filled, brand-blue, positioned to the left of the title (button appears before the title in the reading order), `+` icon before the label. Action: navigates to `/schedules/:id` in **create mode** (empty form).

### 1.2 Tabs
- Two tabs beneath the header: **List** (active/underlined by default) and **Calendar**.
- **List** is the tab detailed in this section.
- **Calendar** is a second required view (not detailed in the reference) — scaffold it as a calendar/timeline visualization of schedules; exact layout is left to the agent since no visual spec was given.

### 1.3 Toolbar
Three controls in a row below the tabs:
- **Search input**: placeholder "Search schedules...". Filters rows live by Schedule Name (and likely Company).
- **"Filter" button**: opens filter controls (e.g. by Status, Company, Days/Week — exact filter fields left to the agent).
- **"Columns" button**: lets the user toggle which table columns are visible (a customizable-columns control), implying the table (§1.4) should be built with configurable column visibility rather than a fixed column set.

### 1.4 Table
Columns, left to right:

| Column | Content |
|---|---|
| **Schedule Name** | e.g. "40 Hours / Week", "Night Shift" |
| **Days / Week** | Integer count, e.g. 5 |
| **Hours / Week** | e.g. "40h", "37.5h" — should be **derived/computed** from the schedule's daily pattern (see §2.4), not independently entered here |
| **Company** | e.g. "My Company" |
| **Status** | Pill/badge: **Active** (green) or **Inactive** (red/muted) |

Per the business-rules note (§4), the list should also be able to surface a **calendar type** column (e.g. standard/rotating/shift-based) alongside these — include it as an optional/configurable column via the "Columns" control (§1.3) even though it isn't visible in the sample table.

**Sample data (scaffolding only — not fixed content):**
| Schedule Name | Days / Week | Hours / Week | Company | Status |
|---|---|---|---|---|
| 40 Hours / Week | 5 | 40h | My Company | Active |
| Night Shift | 5 | 40h | My Company | Active |
| Retail Weekend | 5 | 40h | My Company | Active |
| Flexible Hybrid | 5 | 37.5h | My Company | Active |
| Part-time 20h | 4 | 20h | My Company | Inactive |

### 1.5 Row selection & interaction
- Rows are clickable; the currently opened/selected schedule is highlighted (light blue background + solid left-edge accent bar), matching the row-highlight pattern used in the User Management table.
- Clicking a row navigates to `/schedules/:id` — the Form view (§2) — in **edit mode**, pre-filled with that schedule's data. This is the List → Form transition referenced by the flow arrow in the reference image.

### 1.6 Footer helper text
- "Select a schedule to open its Form view." — static instructional text, small, muted, matching the equivalent helper text pattern used in User Management.

---

## 2. View 2 — Schedule Form (`/schedules/:id`)

Opened by clicking a List row (edit mode) or "+ New Schedule" (create mode, empty).

### 2.1 Header
- **"← Back to list" link**: top-left, brand-blue text with a left-arrow icon. Navigates back to `/schedules` (§1).
- **Title**: the schedule's name, dynamically rendered (e.g. "40 Hours / Week"). In create mode, this would show a placeholder like "New Schedule" until a name is entered/saved.

### 2.2 Top field group (three-column row)
| Field | Notes |
|---|---|
| **Schedule Name** | Text input, e.g. "40 Hours / Week" |
| **Company** | Text/select input, e.g. "My Company" |
| **Days per Week** | Numeric input, e.g. "5" — should stay consistent with the number of active rows in the Weekly Schedule grid (§2.3); consider deriving this from the grid rather than treating it as independently editable, to avoid the two values disagreeing |
| **Hours per Week** | Numeric/text input, e.g. "40h" — this field visually exists in the top group, but per §2.4 the authoritative weekly-hours total is computed from the grid; treat this top field as either a read-only mirror of that computed value or remove the redundancy by only showing the computed total (§2.4) |
| **Timezone** | Text/select input, e.g. "Company timezone" — likely inherited from the Company by default, editable if the schedule needs to differ |

### 2.3 Weekly Schedule grid
- Section heading: **"Weekly Schedule"**.
- **"+ Add Day" button**: top-right of this section, adds a new day row to the grid (for schedules that don't run Monday–Friday, e.g. retail/weekend patterns).
- Table columns: **Day**, **Start Time**, **End Time**, **Break**, **Hours**, and a remove action (**×**) per row.
- Each row represents one working day:
  - **Day**: label (e.g. "Monday") — read-only label per row, since rows are added/removed via "+ Add Day" / "×" rather than typed.
  - **Start Time** / **End Time**: time inputs (e.g. "9:00 AM" / "6:00 PM").
  - **Break**: duration input, e.g. "1h" — optional per the business rules (§4); should accept "0h"/empty for no break.
  - **Hours**: computed per-row value (End − Start − Break), e.g. "8h" — should be **read-only/derived**, not independently entered, since it's a function of the other three fields on that row.
  - **×**: removes that day row from the schedule.
- **Sample rows**: Monday–Friday, each 9:00 AM–6:00 PM with a 1h break, yielding 8h/day.

### 2.4 Total Weekly Hours
- Displayed below the grid, right-aligned: **"Total Weekly Hours: 40h"**.
- Must be a **computed sum** of the Hours column across all day rows (§2.3) — this is the authoritative weekly-hours figure for the schedule, and should be what's referenced anywhere else in the app that needs "hours/week" for this schedule (including the List view's Hours/Week column, §1.4).

### 2.5 Footer note
- "Use this schedule as the employee/contract working pattern." — confirms this schedule record is meant to be **referenced by** Employee and/or Contract records (i.e. a Working Schedule is a reusable, assignable entity — not something re-entered per employee). See §4 for how this linkage should work.

---

## 3. Reference note box (build instructions, not rendered UI)

The following appeared as an annotated note in the source material — it documents required behavior/scope and must inform the implementation, but should **not** be rendered as literal on-page copy:

> **Working Schedule Note**
> - Required views: List and Form. The List is for finding/opening schedules; the Form defines one schedule.
> - A schedule should capture the weekly working pattern (days, working time, and total weekly hours). Breaks or variable shifts can be handled in your own way.
> - Employee/Contract can reference a Working Schedule. Attendance and Payroll may use it as the expected working time.

This confirms:
- List and Form are both mandatory (already covered above).
- The exact handling of breaks/variable shifts (e.g. split shifts, overnight shifts) is left to the agent's judgment — the grid in §2.3 is a reasonable baseline, but isn't a strict constraint on edge cases.
- **Downstream consumers** of a Working Schedule record: Employee, Contract, Attendance, and Payroll — see §4 for how these should connect.

---

## 4. Cross-Entity Business Rules (broader context, not specific to this page)

These rules come from a second reference note covering Employee & Contract behavior alongside Working Schedule, and should guide how `/schedules` integrates with the rest of the app (see the Employees dashboard and Contracts specs for those pages' own detailed UI):

**Employee & Contract**
- Employees must be viewable in both Kanban and List views (already covered in the Employees dashboard spec).
- Opening an employee should show their HR details and related records: **Contracts, Attendance, Time Off, and Allocations.**
  - Note: the Employees dashboard spec's Employee Profile page (§6.2) currently documents three smart buttons — Time Off, Contracts, Attendance. Per this rule, a fourth related-record type, **Allocations**, should also be surfaced there (as a smart button or equivalent) — flagging this so the agent reconciles the Employee Profile page to include Allocations alongside the other three.
- An employee can have multiple contracts over time (already reflected in the Contracts spec's sample data and §3.5 footer note).
- Payroll should use **the contract applicable to the selected payroll period** — i.e. payroll must resolve, per pay run, which of an employee's (possibly multiple, historical) contracts was active during that specific period, rather than always using "the current" contract.

**Working Schedule**
- Working Schedules need List and Form views (this document, §1–§2). Clicking a row opens that schedule.
- The List should surface: **name, calendar type, days/week, hours/week, company, and status** — see §1.4's note about including calendar type as a configurable column.
- The Form defines the weekly pattern (day, start/end time, optional break, and hours per day); **weekly hours should be derived from the schedule** (§2.4) rather than manually entered.
- A schedule can be **assigned to an Employee/Contract** and used by Attendance and Payroll as the expected working time.
  - Practically: the Employee Profile page (Work Information tab, per the Employees dashboard spec §6.4) already has a "Working Schedule" field (e.g. "40 Hours / Week") — that field should be a reference/link to a record from this `/schedules` list, not free text, so changes to a shared schedule (e.g. adjusting "40 Hours / Week") propagate to every employee/contract assigned to it.
  - Similarly, the Contracts Detail page (per the Contracts spec §4.2) has its own "Working Schedule" field — same rule applies there.
- Shift patterns, flexible-time schedules, and other rule variations are left open to the implementer — no strict format is mandated beyond the day/start/end/break/hours grid baseline in §2.3.