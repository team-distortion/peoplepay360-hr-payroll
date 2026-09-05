# PeoplePay360 — Time Off Module: Build Spec

Describes the full Time Off module: **Dashboard**, **Time Off Requests**, **Time Off Types**, and **Allocations** — each with a List and Form view where applicable — plus the "Time Off ▼" navbar dropdown, cross-entity business rules, and motion.

## Routes

```
/time-off/requests             → Time off request list (employee, type, dates, status)
/time-off/requests/:id         → Request form (approve/refuse workflow)
/time-off/allocations          → Allocation list (balances: taken/remaining/validity)
/time-off/allocations/:id      → Allocation form
/time-off/types                → Time off type config (units, approval rules, payroll integration)
/time-off/types/:id            → Type form
```

A `Dashboard` entry also exists in the nav dropdown (§1) but has no route listed above and no visual reference — scaffold it as a summary landing page (e.g. pending-approval counts, team balance overview) at the agent's discretion; it is **not** detailed further in this document.

---

## 1. Navigation: "Time Off ▼" Dropdown

Opens beneath the "Time Off ▼" nav item (part of the persistent navbar defined in the Employees dashboard spec), containing four stacked items:

1. **Dashboard** (shown as the active/filled item by default in the reference)
2. **Time offs** — routes to `/time-off/requests` (§2)
3. **Time off Types** — routes to `/time-off/types` (§4)
4. **Allocations** — routes to `/time-off/allocations` (§3)

Only one item is shown active/filled at a time, matching the current sub-route — same pattern as the "Employees ▼" dropdown.

---

## 2. Time Off Requests

### 2.1 List (`/time-off/requests`)

**Header**
- Title: "Time Off Requests".
- Subtitle: "List view opened from Time Off ▼ → Requests" — confirms the breadcrumb-style subtitle pattern used across the app should state which dropdown path led here.

**Toolbar**
- **"NEW" button**: filled brand-blue, uppercase — opens the Request form (§2.2) in create mode.
- **Search input**: placeholder "Search requests...".
- **"My Team" filter button**: outlined pill, toggles the list between "all requests" and "requests from people I manage" — this is the primary scoping control for managers reviewing their team's leave.

**Table**
| Column | Content |
|---|---|
| **Employee** | Requester's name |
| **Type** | Leave type (e.g. "Paid Time Off", "Sick Leave", "Comp Off") — must match a record from Time Off Types (§4) |
| **Start** | Start date |
| **End** | End date |
| **Duration** | e.g. "3 Days", "1 Day" |
| **Status** | Colored text: **Approved** (green), **To Approve** (orange/amber); support additional states as needed (e.g. "Refused", "Cancelled") |
| **Row actions** | Inline **Approve** (filled blue, small) / **Refuse** (outlined, small) buttons directly in each row, so a reviewer can act without opening the full form |

**Sample data (scaffolding only):**
| Employee | Type | Start | End | Duration | Status |
|---|---|---|---|---|---|
| Aarav Mehta | Paid Time Off | 12-Sep | 14-Sep | 3 Days | Approved |
| Sara Khan | Sick Leave | 18-Sep | 18-Sep | 1 Day | Approved |
| John Dsouza | Comp Off | 27-Sep | 27-Sep | 1 Day | To Approve |

- Row click (anywhere other than the inline Approve/Refuse buttons) navigates to `/time-off/requests/:id` (§2.2).
- Clicking inline Approve/Refuse should update the row's Status in place without necessarily navigating away — a fast-path alternative to opening the full form.

**Footer note**
- "Useful note: request status should show the approval lifecycle clearly." — build instruction: statuses must visually communicate where a request sits in its lifecycle (pending → approved/refused), not just a flat label — color coding (green/orange/red) is the primary mechanism, per the sample data.

### 2.2 Form (`/time-off/requests/:id`)

Opened by clicking a List row, or via "NEW" (create mode, empty).

**Header**
- Title: "Time Off Request / Aarav Mehta" — breadcrumb: `Time Off Request / <employee name>`.
- Subtitle: "Form view of one request".

**Top actions**
- **Approve** (filled blue) / **Refuse** (outlined) buttons — same pair as the List row actions, now at full form scale. This is the request's approval workflow entry point.

**Fields (two-column layout)**
| Left column | Right column |
|---|---|
| Employee (e.g. "Aarav Mehta") | Duration (e.g. "3 Days") |
| Time Off Type (e.g. "Paid Time Off") | Status (e.g. "Approved") |
| Start Date (e.g. "12-Sep-2026") | Approver (e.g. "Sara Khan") |
| End Date (e.g. "14-Sep-2026") | Allocation Used (e.g. "Paid Time Off 2026") |

- **Time Off Type** should be a reference to a record from §4 (Time Off Types), not free text — it determines whether Allocation Used is applicable (see §5).
- **Allocation Used** should only be meaningfully populated when the selected Time Off Type "Requires Allocation" (§4.2) — for a type that doesn't require allocation (e.g. Sick Leave in the sample data), this field should be empty/hidden rather than showing a misleading value.

**Reason panel**
- Bordered box below the fields, heading implied by content: free-text reason, e.g. "Family vacation".

**Footer note**
- "Useful note: if the selected type requires allocation, the request should clearly show which balance was consumed." — reinforces the Allocation Used field's conditional importance (§5).

---

## 3. Allocations

### 3.1 List (`/time-off/allocations`)

**Header**
- Title: "Allocations".
- Subtitle: "List view opened from Time Off ▼ → Allocations".

**Toolbar**
- **"NEW" button**: filled brand-blue — opens the Allocation form (§3.2) in create mode.
- **Search input**: placeholder "Search allocations...".

**Table**
| Column | Content |
|---|---|
| **Employee** | Name |
| **Type** | Leave type (references Time Off Types, §4) |
| **Allocated** | Total days/hours granted, e.g. "20 days" |
| **Taken** | Amount consumed by approved requests, e.g. "8 days" |
| **Remaining** | Allocated − Taken, e.g. "12 days" — should be **computed**, not independently entered |
| **Status** | Colored text: **Approved** (green), **To Approve** (orange) |

**Sample data (scaffolding only):**
| Employee | Type | Allocated | Taken | Remaining | Status |
|---|---|---|---|---|---|
| Aarav Mehta | Paid Time Off | 20 days | 8 days | 12 days | Approved |
| Sara Khan | Paid Time Off | 18 days | 4 days | 14 days | Approved |
| Neha Patel | Comp Off | 2 days | 1 day | 1 day | To Approve |

- Row click navigates to `/time-off/allocations/:id` (§3.2), labeled "Open selected allocation" in the reference flow.

**Footer note**
- "Useful note: the list should expose the balance math at a glance — Allocated, Taken and Remaining." — build instruction: keep all three numbers visible side by side in the table (don't collapse to just "Remaining"), since the point of this list is auditing the math, not just the end result.

### 3.2 Form (`/time-off/allocations/:id`)

**Header**
- Title: "Allocation / Aarav Mehta" — breadcrumb: `Allocation / <employee name>`.
- Subtitle: "Form view of one allocation record".

**Top actions**
- **Approve** / **Refuse** buttons, same pattern as Requests (§2.2) — allocations go through their own approval step before they create usable balance (see §5).

**Fields (two-column layout)**
| Left column | Right column |
|---|---|
| Employee (e.g. "Aarav Mehta") | Taken (e.g. "8 Days") |
| Time Off Type (e.g. "Paid Time Off") | Remaining (e.g. "12 Days") |
| Allocated (e.g. "20 Days") | Approver (e.g. "Sara Khan") |
| Status (e.g. "Approved") | Validity (e.g. "2026 Annual Balance") |

- **Taken** and **Remaining** should be computed/derived (Taken = sum of approved requests against this allocation; Remaining = Allocated − Taken), consistent with §3.1.
- **Validity** describes the policy period this allocation applies to (e.g. a calendar-year balance) — relevant for balances that reset or expire.

**Description panel**
- Bordered box: e.g. "Annual leave balance granted at start of policy year."

**Footer note**
- "Useful note: approved allocation is what creates available leave balance for the employee." — key business rule: an allocation contributes **zero** balance until its own Status is Approved — see §5.

---

## 4. Time Off Types

### 4.1 List (`/time-off/types`)

**Header**
- Title: "Time Off Types".
- Subtitle: "List view opened from Time Off ▼ → Time Off Types".

**Toolbar**
- **"NEW" button**: filled brand-blue — opens the Type form (§4.2) in create mode.
- **Search input**: placeholder "Search time off types...".

**Table**
| Column | Content |
|---|---|
| **Type** | Name, e.g. "Paid Time Off" |
| **Unit** | "Days" or "Hours" — determines how Allocated/Taken/Remaining (§3) and Duration (§2) are measured for this type |
| **Allocation** | "Required" or "No" — whether requests of this type must draw from an Allocation record |
| **Approval** | Role responsible for approving requests/allocations of this type, e.g. "Manager", "Officer" |
| **Status** | "Active" (or an inactive/retired state, styled distinctly) |

**Sample data (scaffolding only):**
| Type | Unit | Allocation | Approval | Status |
|---|---|---|---|---|
| Paid Time Off | Days | Required | Manager | Active |
| Sick Leave | Days | No | Manager | Active |
| Comp Off | Hours | Required | Officer | Active |

- Row click navigates to `/time-off/types/:id` (§4.2), labeled "Open selected type" in the reference flow.

**Footer note**
- "Useful note: this list defines policy rules, not employee transactions." — important distinction: unlike Requests (§2) and Allocations (§3), which are per-employee transactional records, this list is **configuration** shared across the whole org — editing a row here changes behavior for every future request/allocation of that type, not a single employee's record.

### 4.2 Form (`/time-off/types/:id`)

**Header**
- Title: "Time Off Type / Paid Time Off" — breadcrumb: `Time Off Type / <type name>`.
- Subtitle: "Form view of one time off type".

**Top action**
- **"EDIT" button** (outlined) — not Approve/Refuse, since this is configuration, not an approvable transaction. Toggles fields between read-only and editable, matching the Employee Profile / Attendance Detail EDIT pattern.

**Fields (two-column layout)**
| Left column | Right column |
|---|---|
| Type Name (e.g. "Paid Time Off") | Approval (e.g. "Manager") |
| Unit (e.g. "Days") | Payroll / Work Entry (e.g. "Leave Work Entry") |
| Requires Allocation (e.g. "Yes") | Display Color (e.g. "Blue") |
| Active (e.g. "True") | *(no paired field — single field on its own row)* |

- **Requires Allocation** (Yes/No) is the field that determines whether Requests of this type need an Allocation Used value (§2.2) and whether Allocations of this type even get created (§3) — this is the single source of truth referenced throughout §5.
- **Payroll / Work Entry** indicates how this leave type integrates with payroll (e.g. as a specific "Leave Work Entry" line item) — relevant context for whatever Payroll module consumes this data.
- **Display Color** is the color used to render this type's Status/Type badges/tags elsewhere in the app (e.g. Requests and Allocations lists) — should be a color picker or preset swatch selector, not free text, in the actual implementation.

**Configuration Notes panel**
- Bordered box: e.g. "Standard annual leave. Balance comes from approved allocations."

**Footer note**
- "Useful note: Time Off Type drives approval behavior and whether a request needs an allocation." — reiterates: this record is the upstream config driving §2 and §3's behavior, not a passive label.

---

## 5. Cross-Entity Business Rules ("Time Off" note)

- **Requests should support a simple approval flow** — the Approve/Refuse pair used consistently in §2.1 (row actions) and §2.2 (form) is the mechanism; keep it simple rather than a multi-stage workflow unless specified elsewhere.
- **For leave types that require allocation, approved leave should reduce the employee's available balance.** Concretely: when a Request (§2) of a type with "Requires Allocation: Yes" is approved, the linked Allocation's **Taken** should increase (and **Remaining** decrease) by the request's Duration — this is the live link between §2 and §3.
- **Time Off Types should define how each leave type behaves** (§4) — Unit, Allocation requirement, Approval role, Payroll integration, and Display Color all flow downstream from the Type record into every Request and Allocation of that type. The exact policies/validations beyond this (e.g. blackout dates, minimum notice, carryover rules) are explicitly **open to interpretation** — not specified in the reference, so don't over-build validation logic beyond what's described here.
- **An Allocation must itself be Approved before it creates usable balance** (§3.2 footer note) — a "To Approve" allocation (e.g. Neha Patel's Comp Off in the sample data) should not yet count toward that employee's available leave until approved.

---

## 6. Animation & Motion Spec

Consistent with the rest of the app: durations in the ~100–250ms range, standard ease-in/ease-out, no bounce/spring — smooth and purposeful, never decorative.

| Element | Animation |
|---|---|
| **"Time Off ▼" dropdown** | Fade + slight downward slide on open (~150–200ms ease-out); reverse on close (~120ms ease-in); chevron rotates 180° in sync — matching the "Employees ▼" dropdown spec. |
| **"My Team" filter toggle** | Background/label cross-fades between "My Team" and "All" states (~150ms) rather than an instant swap. |
| **Table rows (hover)** | Subtle background tint fade-in, ~100ms, across Requests, Allocations, and Types lists. |
| **Inline Approve/Refuse buttons (row-level)** | Background darken on hover (~100ms); scale to ~0.97 on press. On successful action, the row's Status text/color cross-fades to its new value (~200ms) and the row briefly highlights (soft green/red flash fading over ~400ms) to confirm the action landed. |
| **Status badges (To Approve → Approved/Refused)** | Color and label cross-fade together (~200ms) whenever status changes, everywhere it appears (list rows and form headers alike) — never an instant color snap. |
| **List → Form navigation** (Requests, Allocations, Types) | Cross-fade between pages (~200ms), or shared-element-style carry-over of the row's name/type into the form header, consistent with the Employees/Contracts/Attendance specs. |
| **Approve / Refuse buttons (form-level)** | Background darken on hover (~100ms); scale to ~0.97 on press; after the action resolves, cross-fade the button area into a confirmed state (e.g. buttons replaced or disabled) over ~200ms rather than an abrupt UI change. |
| **Remaining / Taken values (Allocations)** | When Taken/Remaining update as a result of a request being approved elsewhere, cross-fade the new numbers in (~200ms) — treat balance changes as something the user should be able to visually notice, not silently reload. |
| **EDIT toggle (Time Off Type form)** | Field borders/backgrounds fade in as they become editable (~150ms), matching the Employee Profile / Attendance Detail EDIT pattern. |
| **Display Color swatch (Type form)** | If implemented as a color picker, the selected swatch should scale slightly (~1.05x) and show a soft ring on selection (~100ms), rather than an instant border snap. |
| **New row insertion (after "NEW" + save)** | The newly created row should fade + slide in at the top of its list (~200ms) rather than appearing abruptly, so the user has clear feedback that creation succeeded. |

General rule for the agent: because this module is approval-heavy, motion should mainly serve to **confirm state changes** (an approval landed, a balance updated, a dropdown opened) — keep it quick and quiet everywhere else.