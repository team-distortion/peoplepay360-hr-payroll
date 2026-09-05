# Payroll Module — UI Specification

This document is a self-contained spec for building the Payroll UI. It describes every
route, screen, field, table, state, and flow needed. No reference images are required —
this file is the single source of truth.

---

## 0. Global Conventions

### 0.1 App shell / top nav
Every payroll screen sits inside the standard app shell with a top navigation bar
containing these menu items, left to right: **Employees**, **Contracts**, **Attendance**,
**Time Off**, **Payroll**. Each of these (except the current section) is a dropdown
trigger (chevron indicator). The active section is visually highlighted.

### 0.2 Payroll dropdown menu
Hovering/clicking **Payroll** in the top nav opens a vertical menu with these items, in
this order:
1. Dashboard
2. Payruns
3. Payslips
4. Structures
5. Rules

Each item is a full-width rounded button. The current page's item is highlighted
(blue border/background); others are neutral gray outline buttons.

### 0.3 Status badge conventions
Use a consistent colored pill/badge component across all list and detail screens:

| Status     | Color   | Used for            |
|------------|---------|----------------------|
| Draft      | gray    | Payrun / Payslip     |
| Validated  | blue    | Payrun                |
| Done       | green   | Payslip               |
| Paid       | green   | Payrun / Payslip      |

### 0.4 Warning indicator convention
Rows that have data issues show an inline warning chip/text in an orange/amber color,
e.g. `2 warnings`, `Alt missing`, `Duplicate`. A row with no issues shows a dash `—` in
the Warning column. Warnings must be visibly resolved (or at least visible) before a
payrun can be marked as finalized/paid — surface them prominently, don't hide them in a
tooltip only.

### 0.5 Currency & number formatting
All monetary values are formatted with a `$` prefix and thousands separators, e.g.
`$4,500.00`. Amount fields in the salary computation table may be large payroll totals
(e.g. `950,000`) — keep right-aligned in tables.

### 0.6 Tables — shared behavior
- Sticky header row.
- Each row is clickable (navigates to the record's detail route) except when a checkbox
  column is present for multi-select (see Payrun wizard step 2).
- Empty state: centered icon + "No records found" + (if filters are active) a "Clear
  filters" link.
- Search input filters by name/employee (client or server side, debounced).

---

## 1. `/payroll/structures` — Salary Structure List

**Purpose:** List all salary structures (templates that bundle an ordered set of salary
rules applied to employees, e.g. "Regular Salary", "Sales Salary", "Contractor").

**Header:** Title "Salary Structures" + small "Flow view" label + primary button **New**
(top of toolbar) → opens/navigates to `/payroll/structures/new` (or a blank `:id` form).

**Toolbar:** Search input ("Search structures…").

**Table columns:**
| Column          | Example |
|-----------------|---------|
| Structure Name  | "Regular Salary" |
| Rules           | count of salary rules included, e.g. "12 rules" |
| Employees       | count of employees currently assigned this structure, e.g. "6 employees" |
| Active          | "Active" / "Inactive" text (green / gray) |

Row click → `/payroll/structures/:id`.

Footnote under the table: *"Structures group salary rules; rules define the ordered
salary computation used by a payslip. Both require List and Form views."* And: *"The
Salary Structure selected on a Payrun determines which set of salary rules will compute
pay."*

---

## 2. `/payroll/structures/:id` — Structure Form

**Purpose:** View/manage a single salary structure: its name, active state, and the
ordered list of salary rules that make it up.

**Header:** Title `Salary Structure / {Structure Name}` (e.g. "Salary Structure /
Regular Salary") + subtitle "Form view with its salary rules."

**Summary fields:**
| Field          | Example         |
|----------------|-----------------|
| Structure Name | "Regular Salary"|
| Active         | "True" / "False"|

**"Salary Rules" table** — the rules included in this structure, in evaluation order:
| Column    | Example                                                    |
|-----------|-------------------------------------------------------------|
| Rule Name | "Basic Salary", "House Rent Allowance", "Standard Allowance", "Performance Bonus", "Leave Travel Allowance", "Fixed Allowance", "Gross Salary", "Loan Fund", "Provident Fund", "Professional Tax", "Alt Salary" |
| Code      | "BASIC", "HRA", "STD", "PERF", "LTA", "FIX", "GROSS", "LF", "PF", "PT", "ALT" |
| Category  | Basic / Allowance / Allowance / Allowance / Allowance / Allowance / Gross / Deduction / Deduction / Deduction / Net |
| Sequence  | ascending numbers, e.g. `10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110` (gapped, to allow inserting rules later without renumbering everything) |

- Row click → `/payroll/rules/:id` for that rule.
- Editing: allow adding an existing rule (searchable picker from `/payroll/rules`) and
  reordering rows (drag handle or editable Sequence number) — rules are evaluated in
  ascending sequence order, so a rule that depends on another (e.g. "Gross Salary"
  summing Basic + Allowances) must have a higher sequence number than what it depends on.

**Footer actions:** **Save**, **Discard**, and (only when the structure has 0 employees
assigned) **Delete**.

Useful note shown on this screen: *"Rule order matters — keep sequence visible to
participants to help them understand the calculation. Rules created here are just for
reference."* Also note the cross-reference: a Payrun's **Salary Structure** field (see
`/payroll/payruns/:id`) is populated from the structures configured here — *"Configured
structure is selected when a Payrun is created."*

---

## 3. `/payroll/rules` — Salary Rule List

**Purpose:** List all individual salary rules (the computation building blocks used by
structures), e.g. "Basic Salary", "House Rent Allowance", "Performance Bonus".

**Header:** Title "Salary Rules" + subtitle "List view" + primary button **New** →
`/payroll/rules/new`.

**Toolbar:** Search input ("Search salary rules…") + a **Structure** filter dropdown
(e.g. "Regular Salary") to scope the list to one structure's rules.

**Table columns:**
| Column    | Example |
|-----------|---------|
| Rule Name | "Basic Salary", "House Rent Allowance", "Standard Allowance", "Performance Bonus", "Leave Travel Allowance", "Fixed Allowance", "Gross Salary" |
| Code      | "BASIC", "HRA", "STD", "BONUS", "LTA", "FIX", "GROSS" |
| Category  | Basic / Allowance / Allowance / Allowance / Allowance / Allowance / Gross (colored tag) |
| Structure | "Regular Salary" (the structure this rule instance belongs to) |
| Sequence  | "1, 10, 20, 30, 40, 50, 60" (evaluation order within its structure) |

Row click → `/payroll/rules/:id`.

Footnote under the table: *"List view should expose name, code, category, structure and
sequence — the fields needed to understand a payroll rule quickly."*

---

## 4. `/payroll/rules/:id` — Rule Form

**Purpose:** Define how a single salary rule computes its amount.

**Header:** small record ID chip at top (e.g. `#317`) + title "Salary Rule /
{Rule Name}" (e.g. "Salary Rule / Basic Salary") + subtitle "Form view".

**Fields (two-column layout):**
| Left column                          | Right column                        |
|---------------------------------------|---------------------------------------|
| Rule Name: "Basic Salary"             | Salary Structure: "Regular Salary"    |
| Code: "BASIC01"                       | Computation: "Percentage of Wage"     |
| Category: "Basic"                     | Sort By: "1"                          |
| Sequence: "1"                         |                                        |

- **Category** — select: `Basic`, `Allowance`, `Deduction`, `Gross`, `Net`.
- **Computation** — select: `Fixed Amount`, `Percentage of Wage`, `Python Code`. This
  choice determines which panel is shown in the "Computation options" section below.
- **Sequence** / **Sort By** — numeric evaluation-order fields (Sequence = order within
  the parent Structure; Sort By = display ordering elsewhere, e.g. in the rules list).

**"Computation options from the source" section** — a 3-column panel showing all three
computation modes side by side (or as tabs), with the mode matching the **Computation**
field above highlighted/active:

1. **Fixed Amount**
   - `Amount` — number input, flat value applied every payrun regardless of wage.
2. **Percentage of Wage**
   - `Percentage` — number input (%), e.g. `10%`, computed against the employee's wage
     (or a referenced base rule).
3. **Python Code**
   - `Python Code` — monospace code text area for a Python expression that computes the
     result, referencing other rule codes via a `categories` dict, e.g.:
     ```
     result = categories['BASIC']
     ```
   - Show this example expression as inline placeholder/help text.

Footnote under this section: *"A Salary Rule needs a clear computation method and
category because these drive the final payslip."*

**Footer actions:** **Save**, **Discard**, and (if unused by any structure) **Delete**.

---

## 5. `/payroll/payruns` — Payrun List

**Purpose:** Historical + in-progress payroll batches, one per pay period.

**Header:** Title "Payruns" + subtitle "Payroll view for payroll periods." + primary
button **New** (top left of toolbar, blue) → opens the New Payrun wizard at
`/payroll/payruns/new`.

**Toolbar:** Search input ("Search payruns…") + Year filter dropdown (e.g. `2026`).

**List/table — one row per payrun (grouped/sorted by period, most recent first):**
Each row/card shows:
| Field          | Example |
|----------------|---------|
| Period name    | "January 2026" |
| Date range     | "01-Jan-2026 – 31-Jan-2026" |
| Employee count | "42 employees" |
| Status         | Draft / Validated / Paid badge |
| Warnings       | e.g. "1 warning", "2 warnings", "4x warnings" (amber text), or omitted if none |
| Open action    | chevron/arrow icon button on the right, navigates to `/payroll/payruns/:id` |

Row click (anywhere) also navigates to `/payroll/payruns/:id`.

---

## 6. `/payroll/payruns/new` — New Payrun Wizard (2 steps)

This is a modal/wizard flow. **The Payrun record must NOT be created until the end of
Step 2** (after employee selection) — Step 1's "Continue" only collects scope, it does
not persist anything yet.

### Step 1 — Scope & Period
Modal titled **"New Pay Run"** with a close (✕) icon top right.

Fields:
- **Pay Structure** — select dropdown, e.g. "United States: Regular Pay" (sourced from
  `/payroll/structures`).
- **Period** — two date inputs side by side (start date, end date) defining the pay
  period range.

Actions:
- **Continue** (primary button, bottom left) — validates the fields, then advances to
  Step 2. Does **not** create the payrun.
- **Discard** (text link, next to Continue) — cancels and closes the wizard, discarding
  the scope selection.

### Step 2 — Employee Selection
Modal titled **"Select Employee Records"**, with a small confirmation line above it
(outside or inside the modal): *"The Payrun is created only after employee selection."*
Close (✕) icon top right.

Contents:
- **Search employees…** input at the top, with a live count on the right, e.g. `1–22 /
  22` (showing current visible range / total eligible employees).
- **Table** with a leading checkbox column (`✓` header = select-all) plus columns:
  | Column        | Example        |
  |---------------|----------------|
  | Employee      | "Anita Oliver" |
  | Working Hours | "40 hours/week"|
  | Start Date    | "Jan 1"        |
  | Wage          | "$4,500.00"    |
  - Only employees eligible for the chosen Pay Structure/Period appear in this list.
  - User may select **one or more** employees via checkboxes (individually or via
    select-all).

Actions (bottom):
- **Create payrun** (primary button) — enabled only when ≥1 employee is selected.
  Creates the Payrun record containing **only the selected employees**, generates a
  payslip per selected employee, closes the modal, and navigates to
  `/payroll/payruns/:id` for the newly created payrun.
- **Back** (secondary button) — returns to Step 1, preserving the previously entered
  scope/period so the user can edit it.

---

## 7. `/payroll/payruns/:id` — Payrun Processing Screen

**Purpose:** Open a single Payrun to compute and manage all its payslips together.

**Header:** Title `Payrun / {Period Name}` (e.g. "Payrun / February 2026") + subtitle
"Open one Payrun to compute and manage its payslips."

**Action bar (top right / top of card):**
- **Compute** (secondary button) — runs/re-runs salary computation for every payslip in
  this payrun.
- **Validate** (secondary button) — transitions payrun status from Draft → Validated
  once computation is confirmed correct. Should be disabled/warned against if unresolved
  warnings exist.
- **Mark Paid** (secondary button) — transitions payrun status to Paid.
- **Send Payslips** (primary/purple button, visually distinct, right-aligned) — emails
  or otherwise distributes the PDF payslip to every employee in the payrun. Should be
  disabled until status is at least Validated.

**Summary fields (form-style, read-only unless Draft):**
| Field           | Example              |
|-----------------|-----------------------|
| Name            | "February 2026"       |
| Salary Structure| "Regular Salary"       |
| Period          | "01-Feb – 28-Feb"      |
| Status          | Draft / Validated / Paid badge |

**"Payslips in this Payrun" table** — one row per employee included in this payrun. Note
that Period and Structure are already fixed for the whole payrun (shown in the summary
fields above), so this table replaces them with a per-employee **Worked** days column
instead:
| Column     | Example                          |
|------------|-----------------------------------|
| Employee   | "Aarav Mehta"                     |
| Warning    | "—", "Alt missing", "Duplicate" (amber) |
| Worked     | "22" (worked days in the period)  |
| Basic      | "$950,000"                        |
| Gross      | "$950,000"                        |
| Alt (Net)  | "$950,000"                        |
| Status     | Draft / Done / Paid badge          |
| PDF        | link/icon button to download that payslip's PDF |

Row click navigates to `/payroll/payslips/:id` for that employee's payslip in this
payrun.

Footnote under the table: *"Warnings such as missing account data or duplicate payslips
should be visible before payroll is finalized."* Surface these warnings inline in the
table (amber text in the Warning column), not hidden behind a click.

---

## 8. `/payroll/payslips` — Global Payslip List

**Purpose:** Browse/search payslips across all payruns (not scoped to one payrun).

**Header:** Title "Payslips" + subtitle "List view of employee payslips." + **New**
button (top left of toolbar).

**Toolbar:** Search input ("Search payslips…") + **Period filter** dropdown (e.g. "Feb
2026") to narrow to a specific pay period/payrun.

**Table columns:**
| Column     | Example                          |
|------------|------------------------------------|
| Employee   | "Aarav Mehta"                     |
| Warning    | "—", "Alt missing", "Duplicate" (amber) |
| Period     | "01-Feb – 28-Feb"                 |
| Basic      | "$950,000"                        |
| Gross      | "$950,000"                        |
| Alt (Net)  | "$950,000"                        |
| Structure  | "Regular"                          |
| Status     | Draft / Done / Paid badge          |

Row click → `/payroll/payslips/:id`.

Footnote under the table: *"Selecting any payslip opens the detailed salary computation
and PDF action for that employee."*

---

## 9. `/payroll/payslips/:id` — Payslip Detail

**Purpose:** Detailed salary computation for one employee, one period.

**Header:** Title `Payslip / {Employee Name} / {Period Name}` (e.g. "Payslip / Aarav
Mehta / February 2026") + subtitle "Detailed salary computation for one employee."

**Action bar (top right):**
- **Compute** (secondary button) — recompute this payslip's rule breakdown.
- **Mark Paid** (secondary button) — marks this individual payslip as paid.
- **Print Payslip** (primary button) — generates a PDF of this payslip. Note: this PDF
  is the same one that can be bulk-sent from the parent Payrun's **Send Payslips**
  action.

**Summary fields (form-style, two-column layout):**
| Left column          | Right column        |
|-----------------------|----------------------|
| Employee: "Aarav Mehta" | Period: "01-Feb – 28-Feb" |
| Salary Structure: "Regular Salary" | Status: "Done" (badge) |
| Pay Run: "February 2026" | Worked Days: "22" |

**"Salary Computation" table** — one row per salary rule applied, in structure sequence
order:
| Column   | Example         |
|----------|-----------------|
| Rule     | "Basic Salary", "House Rent Allowance", "Standard Allowance", "Gross Salary", "Provident Fund", "Professional Tax", "Alt Salary" |
| Category | Basic / Allowance / Allowance / Gross / Deduction / Deduction / Net (colored tag) |
| Amount   | "$950,000.00" for earnings; negative/parenthesized for deductions e.g. "-$9,500.00" |
| Code     | "BASIC", "HRA", "STD", "GROSS", "PF", "PT", "ALT" |

The final **"Alt Salary" (Net)** row represents the employee's net take-home pay — this
is the same value shown as "Alt" in the Payrun and global Payslip list tables.

Deduction rows should be visually distinguished (e.g. red/negative amount) from
earning rows.

Footnote under the table: *"The Print action generates the employee payslip as a PDF;
that PDF can also be sent from the parent Payrun."*

---

## 10. Cross-cutting data relationships (for implementers)

- A **Structure** has many **Rules** (ordered, many-to-many via an ordered join —
  sequence is per-structure).
- A **Rule** belongs to a **Category** and has exactly one **Computation** mode (`Fixed
  Amount` / `Percentage of Wage` / `Python Code`) with mode-specific fields.
- A **Payrun** has: one Pay Structure, one Period (start/end date), a Status (Draft →
  Validated → Paid), and many **Payslips** (one per selected employee, created together
  at Payrun-creation time).
- A **Payslip** belongs to exactly one Payrun and one Employee, has its own Status
  (Draft → Done → Paid) independent granularity from the parent Payrun's status, may
  carry Warnings (e.g. "Alt missing" = missing bank/payment account data; "Duplicate" =
  possible duplicate payslip for that employee/period), and has a **Salary Computation**
  breakdown: one line per Rule from the Structure, each with its computed Amount.
- **Warnings** are computed at Compute/Validate time and must remain visible in every
  list (Payrun list, Payrun's payslip table, global Payslip list) until resolved.

---

## 11. Route summary

| Route | Screen |
|---|---|
| `/payroll/structures` | Salary Structure list |
| `/payroll/structures/:id` | Structure form (rules + sequence) |
| `/payroll/rules` | Salary rule list |
| `/payroll/rules/:id` | Rule form (Fixed Amount / Percentage of Wage / Python Code) |
| `/payroll/payruns` | Payrun list |
| `/payroll/payruns/new` | 2-step new payrun wizard |
| `/payroll/payruns/:id` | Payrun processing screen |
| `/payroll/payslips` | Global payslip list |
| `/payroll/payslips/:id` | Payslip detail |