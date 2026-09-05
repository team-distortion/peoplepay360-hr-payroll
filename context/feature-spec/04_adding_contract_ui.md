# PeoplePay360 — Contracts (`/contracts`): Build Spec

Describes the `/contracts` route across its two connected states — **Contracts List** and **Contract Detail (form view of one contract)** — plus every entry point that should land a user on this route from elsewhere in the app.

---

## 1. Navigation Bar

Same persistent top bar used across the app (see the Employees dashboard spec, §1):

`HR | Employees ▼ | Contracts ▼ | Attendance | Time Off ▼ | Payroll | [notification dot]`

On this route, **Contracts ▼** is the active/highlighted nav item (shown in the brand-blue accent color), the same way "Employees ▼" is highlighted on the `/employees` route.

---

## 2. Entry Points Into `/contracts`

This route must be reachable from multiple places, and should always land on the **List view (§3)** first:

1. **"Employees ▼" nav dropdown → "Contracts" menu item** (defined in the Employees dashboard spec, §1.1): navigates to `/contracts` showing the **full, unfiltered** contract list.
2. **"Contracts ▼" nav item itself** (its own dropdown, if it has sub-items, or a direct link if not): same destination as above — the full, unfiltered list.
3. **Smart button "Contracts N" on the Employee Profile page** (defined in the Employees dashboard spec, §6.2/§6.6): navigates to `/contracts` **pre-filtered to just that employee** — the arrow labeled "Open related contracts" pointing into this page's navbar in the reference represents exactly this hand-off from the Employee Profile page into this List view.
   - When arriving via this route, the List view should visibly indicate it's filtered (e.g. an active filter chip showing the employee's name) rather than silently showing a subset with no indication.
4. Any other place in the app that references "Contracts" as an action/button/link should route here the same way — this page is the single Contracts destination, not one of several duplicate contract screens.

---

## 3. View 1 — Contracts List

### 3.1 Page header
- **Title**: "Contracts".
- **Subtitle**: "List view of employee contracts".

### 3.2 Toolbar
- **"NEW" button**: small, filled, brand-blue, label "NEW" (uppercase) — opens the Contract Detail view (§4) in create mode (empty fields).
- **Search input**: placeholder "Search contracts..." — filters rows live by Contract ID, Employee name, or Status.

### 3.3 Table
Columns, left to right:

| Column | Content |
|---|---|
| **Contract** | Contract ID/reference (e.g. `CON/2026/0042`) |
| **Employee** | Linked employee's name |
| **Start** | Contract start date |
| **End** | Contract end date, or an em-dash `—` for contracts with no end date (i.e. still active/open-ended) |
| **Wage / Month** | Monthly wage amount, currency-formatted (e.g. `₹85,000`) |
| **Status** | Status label, colored text: **Running** in green, **Expired** in red (support additional states — e.g. "Upcoming", "Terminated" — with their own distinct colors as needed) |

**Sample data (scaffolding only — not fixed content):**
| Contract | Employee | Start | End | Wage / Month | Status |
|---|---|---|---|---|---|
| CON/2026/0042 | Aarav Mehta | 01-Jan-26 | — | ₹85,000 | Running |
| CON/2025/0018 | Aarav Mehta | 01-Jul-25 | 31-Dec-25 | ₹78,000 | Expired |
| CON/2026/0031 | Sara Khan | 01-Jan-26 | — | ₹95,000 | Running |

Note that one employee (Aarav Mehta) can have multiple contract rows over time — this is intentional; see §3.5.

### 3.4 Row interaction
- Rows are clickable. Clicking any row navigates from **this list (Page 1) to the Contract Detail view (Page 2, §4)** for that specific contract — this is the page-1-to-page-2 transition.

### 3.5 Footer note
- "Useful note: retain contract history, but make the active Running contract obvious because payroll depends on it." — build instruction: do not delete/hide expired contracts (they're historical records), but the **Running** status must be visually unambiguous (strong color, e.g. green) since payroll calculations depend on identifying the currently active contract per employee.

---

## 4. View 2 — Contract Detail (form view of one contract)

Opened by clicking a row in the List view, or via "NEW" (create mode, empty fields). Same navbar as §1 persists, with "Contracts ▼" still the active nav item.

### 4.1 Page header
- **Title**: "Contract / CON/2026/0042" — breadcrumb-style: `Contract / <contract ID>`, dynamic per record. In create mode, this would read "Contract / New Contract" or similar until saved.
- **Subtitle**: "Form view of one contract".

### 4.2 Fields (two-column layout)

| Left column                       | Right column                              |
| -----------------------------------| -------------------------------------------|
| Employee (e.g. "Aarav Mehta")     | Department (e.g. "Finance")               |
| Start Date (e.g. "01-Jan-2026")   | Job Position (e.g. "Payroll Specialist")  |
| End Date (e.g. "—" if open-ended) | Wage / Month (e.g. "₹85,000")             |
| Status (e.g. "Running")           | Working Schedule (e.g. "40 Hours / Week") |

- Each field follows the same label-above-value pattern used throughout the app (sign-in, user management, employee profile specs).
- Employee, Department, Job Position, and Working Schedule appear to be **pulled from the linked employee record** rather than independently entered here — the agent should treat Employee as the driving relational field (a select/link to an existing employee, similar to the Employee field in the User Management spec §5.1) and auto-populate Department/Job Position/Working Schedule from that employee's record where applicable, while still allowing Wage/Month, Start Date, End Date, and Status to be set per-contract.

### 4.3 Salary Structure / Notes panel
- A bordered box below the field grid, containing:
  - **Heading**: "Salary Structure / Notes".
  - **Line 1**: "Structure Type: Employee Salary" — labels which salary structure this contract uses.
  - **Line 2**: "This running contract is the source for payroll calculation in the active period." — descriptive note explaining the contract's role in payroll; likely a dynamic/computed note rather than free text, since its content depends on the contract's Status (e.g. it should probably only appear or read this way for **Running** contracts).

### 4.4 Footer note
- "Useful note: for the problem statement, one employee should not have multiple Running contracts for the same period." — this is a **validation/business-rule instruction**, not rendered UI copy: when saving a contract with Status = "Running", the agent must check that the same employee doesn't already have another "Running" contract with an overlapping date range, and block save (or warn) if so.

---

## 5. Page Flow Summary

```
Employees ▼ → Contracts (nav dropdown)  ──┐
Contracts ▼ (nav item)                    ├──► /contracts  (List view, §3 — unfiltered)
Employee Profile "Contracts N" smart btn ─┘        (filtered to one employee when entered this way)
                                                        │
                                            click a row │
                                                        ▼
                                          /contracts/:id (Contract Detail, §4)

"NEW" on List view ──► Contract Detail (create mode, empty)
```

---

## 6. Motion Notes (consistent with the rest of the app)

Keep durations in the ~100–250ms range, standard ease-in/ease-out, no bounce — matching the Employees dashboard spec.

| Element | Animation |
|---|---|
| **List → Detail navigation** | Cross-fade between the two pages (~200ms), or a shared-element-style carry-over of the clicked row's Contract ID/Employee name into the Detail header, if supported. |
| **Table rows (hover)** | Subtle background tint fade-in, ~100ms. |
| **Status text** | No animation by default; cross-fade color/label over ~200ms on a live status change (e.g. a contract expiring). |
| **NEW button (hover/press)** | Slight background darken on hover (~100ms); scale to ~0.97 on press. |
| **Filtered-list entry (arriving from an employee's smart button)** | The active filter chip should fade/slide in (~150ms) alongside the table, so it's clear the view arrived pre-filtered rather than the filter being silently applied. |
| **Salary Structure / Notes panel** | If its content changes based on Status, cross-fade the text (~150ms) rather than an instant swap. |