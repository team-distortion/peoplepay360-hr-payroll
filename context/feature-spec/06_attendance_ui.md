# PeoplePay360 — Attendance: Build Spec

Describes the Attendance feature across three connected pieces — the **Attendance List**, the **Attendance Detail (form view of one record)**, and the **Attendance Widget** (a global quick check-in/check-out popup) — plus every entry point and the underlying business rules.

## Routes

```
/attendance                    → Global attendance list (check-in/out, worked hours, status)
/attendance/:id                → Attendance form (manual correction, restricted to authorized users)
```

The Attendance Widget (§3) is not a route — it's a popup accessible from anywhere in the app via the navbar icon (§3.1).

---

## 1. Entry Points

Attendance records can be reached from more than one place, and the destination differs slightly depending on where the user came from:

1. **"Attendance" nav item** (top navbar, plain link — no dropdown, consistent with the navbar defined in the Employees dashboard spec): navigates to `/attendance` showing the **full, unfiltered** list (§2).
2. **Smart button "Attendance N" on the Employee Profile page** (Employees dashboard spec, §6.2): navigates to `/attendance` **pre-filtered to just that employee** — per the business rules (§4), when opened this way, **only that employee's attendance should be shown**, not the global list with a filter applied on top; treat "opened from an employee" as its own filtered entry state, not an afterthought.
3. **Attendance icon in the navbar (top-right, red circular icon)**: does **not** navigate anywhere — it opens the **Attendance Widget** popup (§3) in place, over whatever page the user is currently on.
4. **Clicking a row in the List view** navigates to `/attendance/:id`, the Detail form (§2.4).

---

## 2. Attendance List (`/attendance`)

### 2.1 Page header
- **Title**: "Attendance".
- **Subtitle**: "List view of employee attendance records".

### 2.2 Toolbar
- **"NEW" button**: small, filled, brand-blue, uppercase label — opens the Detail form (§2.5) in create mode, for manually adding an attendance record.
- **Search input**: placeholder "Search attendance...".
- **Filter chips**, shown as small outlined pill buttons next to the search input (not a dropdown menu — these render as active/removable filter tags):
  - **"Today"** — filters the list to the current date.
  - **"Employee: Aarav"** — an employee-scoped filter chip; this is the visual state the list should be in when arrived at via the Employee Profile smart button (§1, entry point 2) — i.e. these chips double as both quick-filter controls and the visible indicator of an active filter, however it was applied.

### 2.3 Table
Columns, left to right:

| Column | Content |
|---|---|
| **Employee** | Name |
| **Check In** | Time, e.g. "09:05"; an em-dash `—` if the employee has not checked in (absent) |
| **Check Out** | Time, e.g. "18:10"; an em-dash `—` if not checked out or absent |
| **Worked Hours** | Decimal hours, e.g. "9.08"; "0.00" for an absent employee |
| **Status** | Colored text/pill: **Present** (green), **Absent** (red) — support additional states (e.g. "Late", "On Leave") with their own distinct colors as needed |

**Sample data (scaffolding only — not fixed content):**
| Employee | Check In | Check Out | Worked Hours | Status |
|---|---|---|---|---|
| Aarav Mehta | 09:05 | 18:10 | 9.08 | Present |
| Sara Khan | 09:15 | 18:02 | 8.78 | Present |
| John Dsouza | 09:32 | 17:58 | 8.43 | Present |
| Neha Patel | — | — | 0.00 | Absent |

### 2.4 Row interaction
- Clicking a row navigates to `/attendance/:id` (§2.5) for that specific record. Labeled "Open selected attendance record" in the reference flow.

### 2.5 Footer note
- "Useful note: list view should help users review raw check-in / check-out data and identify missing punches quickly." — build instruction: make missing/incomplete punches (e.g. a Check In with no Check Out) visually easy to scan for, since that's this view's core job — not just a passive data table.

---

## 3. Attendance Detail (`/attendance/:id`)

Opened by clicking a List row, or via "NEW" (create mode). Same navbar persists, "Attendance" remains the active nav item.

### 3.1 Access restriction
- Per the route spec, this form should be **restricted to authorized users** for manual corrections — i.e. viewing may be broader, but editing/correcting a record (via EDIT, §3.3) should be gated the same way the User Management page is gated to admins.

### 3.2 Page header
- **Title**: "Attendance / Aarav Mehta / 02-Sep-2026" — breadcrumb-style: `Attendance / <employee name> / <date>`, dynamic per record.
- **Subtitle**: "Form view of one attendance record".

### 3.3 EDIT button
- Outlined button, top-left, label "EDIT". Toggles the fields below between read-only display and editable inputs, same pattern as the Employee Profile page.

### 3.4 Fields (two-column layout)

| Left column                          | Right column                |
| --------------------------------------| -----------------------------|
| Employee (e.g. "Aarav Mehta")        | Department (e.g. "Finance") |
| Check In (e.g. "02-Sep-2026 09:05")  | Manager (e.g. "Sara Khan")  |
| Check Out (e.g. "02-Sep-2026 18:10") | Status (e.g. "Present")     |
| Worked Hours (e.g. "9.08")           | Overtime (e.g. "0.50 hrs")  |

- Employee, Department, and Manager appear to be pulled from the linked employee record (consistent with how Contracts pulls Department/Job Position from Employee — see the Contracts spec §4.2).
- **Worked Hours** should be system-computed from Check In/Check Out (minus any break rules, if applicable) rather than freely typed, matching the "system-generated" language in §3.5.
- **Overtime** should likewise be a computed value (worked hours beyond the employee's expected schedule — see the Working Schedule spec §4 on schedules defining "expected working time").

### 3.5 Notes panel
- Bordered box below the fields: "System-generated from check in/out or manually corrected by an authorized user."
- Confirms this record's values are normally auto-populated by the Widget's Check In/Check Out actions (§4), with manual editing as an authorized-only exception path (§3.1/§3.3).

### 3.6 Footer note
- "Useful note: worked hours and overtime should be easy to read because they may later influence payroll or reporting." — build instruction: give Worked Hours/Overtime strong visual weight (not small/muted text), since Payroll and reporting features will depend on these values (consistent with the Working Schedule spec's note that Attendance/Payroll may use a schedule as expected working time).

---

## 4. Attendance Widget (global quick check-in/check-out popup)

### 4.1 Trigger
- A circular icon in the top-right of the navbar (near the notification dot), styled with a clock/timer glyph.
- Clicking this icon opens the **Attendance Widget** as a popup anchored to the icon, layered over the current page (not a route change).
- A colored status indicator dot sits beside the icon:
  - **Gray/neutral** (or red, per the reference's icon ring color) when there's no active session.
  - **Green** once the user has successfully checked in (see §4.5).

### 4.2 Popup header
- Title: "Attendance Widget" (small, top-left of the popup).
- The same status dot from §4.1 is mirrored inside the popup header (green when checked in).

### 4.3 Greeting block
- "Welcome back" — small muted line.
- "User Name!" — large, bold — the authenticated user's name, dynamically rendered.

### 4.4 Session/time block
- A row showing the current check-in time, an em-dash, "Now", and the live elapsed duration, e.g. **"9:48 AM — Now 6h56"** — this elapsed value should update live/continuously while the popup is open (or at least on each open), not be a static snapshot.
- A second row: **"Today  6h56"** — the total worked time for the current day, which should equal the live elapsed duration while a session is active, and freeze once checked out.

### 4.5 Primary action button
- Full-width button at the bottom of the popup.
- Label is **conditional**, not fixed:
  - **"Check In"** — shown when there is no active session.
  - **"Check Out"** — shown when the user is already checked in (as in the reference, where the button reads "Check Out").
- Clicking it performs the corresponding action, updates the status indicator (§4.1/§4.2) accordingly, and updates/creates the underlying attendance record (feeding into §2's list and §3's detail record for that employee/date).

### 4.6 Caption
- Below the widget: "Employees can mark attendance from the quick widget and review records from the Attendance module." — confirms the Widget (fast check-in/out) and the List/Detail pages (review/audit) are two intentionally separate surfaces for two different jobs.

### 4.7 Behavior notes (from the "Attendance Quick Action Note")
These are build instructions, not rendered UI copy:
- Clicking the attendance icon should open the popup (§4.1).
- If there is no active session, show **Check In**.
- If the user is already checked in, show **Check Out**.
- The popup should display elapsed time till now (§4.4).
- After a successful Check In, the status indicator changes to green (§4.1/§4.2).

---

## 5. Cross-Cutting Business Rules ("Attendances" note)

- Attendance can be accessed **globally** (`/attendance`, unfiltered) **or from an individual employee** (filtered, per §1 entry point 2).
- Each record stores: check-in, check-out, worked hours, and attendance status.
- When opened from an employee, **only that employee's attendance should be shown** — reiterates §1/§2.2: this isn't just a convenience filter, it's the expected scoped view.
- Attendance data should be structured so it's **usable later for reporting/dashboard insights** — i.e. don't model worked hours/status as display-only strings; keep them as structured, queryable values (numeric hours, enumerated status) so future reporting features can aggregate across employees/dates without reparsing text.

---

## 6. Animation & Motion Spec

Smooth, purposeful motion throughout — consistent with the rest of the app's ~100–250ms, ease-in/ease-out, no-bounce motion language (see the Employees dashboard and Contracts specs).

| Element | Animation |
|---|---|
| **Attendance icon (navbar, idle)** | Subtle scale/opacity pulse on hover (~100ms) to invite interaction; no idle animation when untouched. |
| **Status indicator dot (color change)** | Cross-fade from neutral/red to green over ~250ms when Check In succeeds (not an instant color snap) — this is the moment the app should feel most "alive," so give it a soft glow/pulse once on the transition (single pulse, not looping). |
| **Attendance Widget (open)** | Popup scales up from ~0.95 to 1.0 while fading in (~200ms ease-out), anchored to the navbar icon (grows from that point, not from the center of the screen). |
| **Attendance Widget (close)** | Reverse of open: fade + scale down to ~0.95 (~150ms ease-in), whether closed by clicking outside, the icon again, or after a successful action. |
| **Elapsed time counter ("6h56")** | If live-updating while the popup is open, digits should tick over with a quick cross-fade/roll (~150ms) each time the value changes, rather than jumping abruptly. |
| **Check In / Check Out button (label swap)** | When the button's label/action changes state (e.g. right after a successful Check In), cross-fade the label text (~150ms) rather than an instant text swap; button color may also shift subtly (e.g. slightly different blue shade) in sync. |
| **Check In / Check Out button (hover/press)** | Background darken on hover (~100ms); scale to ~0.97 on press. |
| **Filter chips ("Today", "Employee: Aarav")** | Fade + slight slide-in (~150ms) when a filter becomes active (e.g. arriving from the Employee Profile smart button); fade-out when removed. |
| **List rows (hover)** | Subtle background tint fade-in, ~100ms. |
| **List → Detail navigation** | Cross-fade between pages (~200ms), or shared-element-style carry-over of the employee name/date into the Detail header, consistent with the Contracts and Employees specs. |
| **EDIT toggle (read-only → editable)** | Field borders/backgrounds fade in as they become editable (~150ms); consistent with the Employee Profile page's EDIT behavior. |
| **Status/Overtime values (Detail page)** | If recalculated after a manual correction, cross-fade the new value in (~200ms) rather than an abrupt refresh, since §3.6 calls out these values as needing to read clearly and trustworthily. |

General rule for the agent: every transition here should reinforce *state* (checked-in vs. not, filtered vs. global, editable vs. read-only) rather than being decorative — the Attendance Widget in particular is a frequently-used, high-frequency interaction, so keep its animations quick and unobtrusive rather than showy.