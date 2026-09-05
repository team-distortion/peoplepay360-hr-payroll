# PeoplePay360 — Employees Dashboard (`/employees`): Build Spec

Describes the `/employees` route across its three connected states — **Kanban view**, **List view**, and the **Employee Profile page** opened from either — plus the top navigation bar and the interaction/animation behavior needed to build it without the reference image.

---

## 1. Navigation Bar

Persistent top bar across the app (not specific to this page), containing, left to right:

| Item | Type | Notes |
|---|---|---|
| **HR** | Static label/logo mark | Leftmost item, identifies the app/section |
| **Employees ▼** | Dropdown trigger | Currently active section — see §1.1 for dropdown contents |
| **Contracts ▼** | Dropdown trigger | Sibling nav item, own submenu (not detailed here) |
| **Attendance** | Plain link | No dropdown |
| **Time Off ▼** | Dropdown trigger | Sibling nav item, own submenu (not detailed here) |
| **Payroll** | Plain link | No dropdown |
| Notification/status dot | Small red indicator | Right-aligned, likely an alerts/notifications badge |

This exact navbar persists unchanged across all three states described below (Kanban, List, Profile) — only the content beneath it changes.

### 1.1 "Employees ▼" dropdown menu

Opens a dropdown panel directly beneath the nav item, containing four stacked items: **Employees** (active/filled, since it's the current section), **Contracts**, **Departments**, **Working Schedule**. Only one item is shown "active" at a time, matching the current sub-route.

---

## 2. Shared Toolbar (Kanban + List views)

Both list-style views share the same toolbar layout below the page header:

### 2.1 "NEW" button
- Small, filled, brand-blue button, left-aligned, label "NEW" (uppercase).
- Action: opens the Employee Profile page (§5) in **create mode** — same page/component as edit mode, just empty.

### 2.2 Search input
- Placeholder: **"Search employees..."**.
- Filters the visible employee cards/rows live by name (and likely role/department).

### 2.3 View toggle: "Kanban" / "List"
- Segmented control, right-aligned, two options: **Kanban** and **List**.
- Exactly one is selected/highlighted at a time, matching the current view.
- Switching re-renders the same underlying employee data as either the card grid (§4) or the table (§5... wait, see §5 for List, §6 for Profile — renumbered below).

---

## 3. View 1 — Kanban Board (default view)

### 3.1 Page header
- **Title**: "Employees".
- **Subtitle**: "Default view: Kanban" — small, muted gray. Indicates this view is a remembered/default preference, not hardcoded.

### 3.2 Card grid
Responsive grid of employee cards (two per row in the reference; should reflow on narrower viewports).

**Card anatomy:**
- **Avatar**: circular badge with initials (e.g. "AM", "SK"), light-tinted background, top-left of card.
- **Name**: bold, primary text.
- **Job title**: directly under the name, smaller, muted gray.
- **Department**: below the name/title block, smaller muted text.
- **Status**: bottom line, colored dot + label (e.g. green dot + "Active"); must support other states (inactive/on-leave) with distinct dot color/label.

**Sample data (scaffolding only):**
| Name | Title | Department | Status |
|---|---|---|---|
| Aarav Mehta | Payroll Specialist | Finance | Active |
| Sara Khan | HR Officer | HR | Active |
| John Dsouza | Developer | Engineering | Active |
| Neha Patel | Recruiter | HR | Active |

### 3.3 Card interaction
- Clicking anywhere on a card opens the Employee Profile page (§6) in edit mode for that employee.

### 3.4 Footer note
- "Useful note: Kanban is good for browsing; clicking a card should open the same Employee Form used everywhere else." — build instruction, not rendered UI copy. Reinforces: one shared profile/edit component, not a page-specific one.

---

## 4. View 2 — List View

### 4.1 Page header
- **Title**: "Employees" (same title as Kanban).
- **Subtitle**: "List view for sort, filter and bulk scanning" — changes per active view; confirms the subtitle is view-dependent, not static.

### 4.2 Table
Standard data table, columns left to right:

| Column | Content |
|---|---|
| **Employee** | Full name |
| **Work Email** | Email address |
| **Job Position** | Role/title |
| **Department** | Department name |
| **Status** | Status label (e.g. "Active"), styled as colored text rather than the dot+pill used in Kanban — keep the table's status cell lightweight (colored text, e.g. green for Active) rather than reusing the Kanban pill component. |

**Sample data (scaffolding only):**
| Employee | Work Email | Job Position | Department | Status |
|---|---|---|---|---|
| Aarav Mehta | aarav@oxp.com | Payroll Specialist | Finance | Active |
| Sara Khan | sara@oxp.com | HR Officer | HR | Active |
| John Dsouza | john@oxp.com | Developer | Engineering | Active |
| Neha Patel | neha@oxp.com | Recruiter | HR | Active |

### 4.3 Row interaction
- Rows are clickable; clicking a row opens the Employee Profile page (§6) in edit mode — identical destination to clicking a Kanban card.
- Per the subtitle, this view should support sorting (click column header to sort), filtering, and is intended as the primary surface for bulk operations (exact bulk-action UI not shown in reference — the agent should add a row-selection checkbox column plus a bulk-action bar as a reasonable default when this need arises).

### 4.4 Footer note
- "Useful note: the list view is the main entry point for opening a specific employee record quickly." — build instruction; confirms List (not Kanban) is the expected fast-path for finding one specific employee, so search + sort should be prioritized/optimized for this view.

---

## 5. Shared behavior: Kanban ↔ List

- Both views render from the same employee dataset — switching the toggle must not lose the current search/filter state.
- Both funnel into the exact same destination when an employee is opened (§6) — there is only one Employee Profile component in the app, entered from either view.

---

## 6. View 3 — Employee Profile Page

Opened by clicking a Kanban card or a List row (edit mode, pre-filled), or the "NEW" button (create mode, empty). Same navbar as §1 persists at the top.

### 6.1 Page header
- **Title**: "Employee / Aarav Mehta" — breadcrumb-style: `Employee / <employee name>`, dynamic per record. In create mode this would read just "Employee / New Employee" or similar until saved.
- **Subtitle**: "Main employee form with related HR actions" — static description of the page's purpose.

### 6.2 Action row (below header)
- **EDIT button**: outlined button, left-aligned, label "EDIT". Toggles the Work/Private Information fields (§6.4) between read-only display and editable inputs.
- **Smart buttons** (right-aligned, small pill-style buttons, each showing a count):
  - **"Time Off 3"**
  - **"Contracts 2"**
  - **"Attendance 14"**
  - Each button's number reflects the count of related records for *this* employee (e.g. 3 time-off requests, 2 contracts, 14 attendance entries).
  - Clicking a smart button navigates to that related section (e.g. Contracts) **pre-filtered to just this employee** — this is the mechanism referenced by the footer note (§6.6) and by the partial "Open related contracts →" flow arrow shown beneath the mockup, which depicts this profile page as the hub that fans out to an employee-scoped Contracts view.

### 6.3 Identity block
- **Avatar**: larger circular initials badge (e.g. "AM"), left of the name block.
- **Name**: large, bold — "Aarav Mehta".
- **Title • Department line**: "Payroll Specialist • Finance" — job title and department joined with a bullet separator.
- **Contact line**: "aarav@oxp.com | +91 98765 43210" — email and phone joined with a pipe separator.

### 6.4 Tabs: "Work Information" / "Private Information"
- Two tabs directly below the identity block; **Work Information** is the default/active tab (underlined/colored to indicate selection).
- **Work Information** tab fields (two-column layout):

  | Left column | Right column |
  |---|---|
  | Department (e.g. "Finance") | Job Position (e.g. "Payroll Specialist") |
  | Manager (e.g. "Sara Khan") | Work Location (e.g. "Mumbai") |
  | Working Schedule (e.g. "40 Hours / Week") | Status (e.g. "Active") |
  | Company (e.g. "OXP Pvt Ltd") | Work Email (e.g. "aarav@oxp.com") |

  Each field is a labeled input (label above, value/input below), matching the label-over-input pattern used elsewhere in the app (see the sign-in and user-management specs).

- **Private Information** tab: not detailed in the reference — the agent should scaffold it as a second field set covering personal/non-work data (e.g. personal address, emergency contact, date of birth, personal email/phone) consistent with the same two-column, label-over-input layout as Work Information.

### 6.5 Read-only vs. Edit state
- By default, fields display as read-only text (not visibly bordered inputs) — pressing "EDIT" switches the same fields into editable input boxes (bordered, focusable), and should reveal Save/Cancel actions in place of (or alongside) the EDIT button while in edit mode.

### 6.6 Footer note
- "Useful note: smart buttons should open related Contracts, Attendance and Time Off records filtered for the current employee." — build instruction confirming §6.2's smart-button behavior: navigation must carry an employee-id filter into the destination view, not just link to the unfiltered section.

---

## 7. Navigation Flow Summary

```
Kanban card click ─┐
                    ├──► Employee Profile Page ──► (smart button) ──► Contracts / Attendance / Time Off
List row click ─────┘         (edit mode)              filtered to this employee

"NEW" button (Kanban or List) ──► Employee Profile Page (create mode, empty)
```

All three entry points (Kanban card, List row, NEW button) converge on the single Employee Profile component — never a separate modal or duplicate form per entry point.

---

## 8. Animation & Motion Spec

Regular, understated motion throughout — nothing flashy, consistent easing across the whole app. Keep all durations in the ~100–250ms range with standard ease-in/ease-out curves; avoid bouncy/spring effects.

| Element | Animation |
|---|---|
| **Employees ▼ dropdown** | Fade + slight downward slide on open (~150–200ms ease-out); reverse (fade + slide up, ~120ms ease-in) on close. Chevron rotates 180° in sync. |
| **Nav links (hover)** | Underline or color transition on hover, ~120ms ease. |
| **NEW button (hover/press)** | Slight background darken on hover (~100ms); scale to ~0.97 on press. |
| **Search input (focus)** | Border color transition to accent + subtle focus-ring fade-in, ~150ms. |
| **Kanban / List toggle** | Sliding "pill" background transitions between segment positions (~200ms ease-in-out) rather than an abrupt swap. |
| **View switch (Kanban ↔ List)** | Cross-fade between the two layouts (~200ms) instead of an instant layout jump; page subtitle text cross-fades along with it. |
| **Employee cards (hover)** | Subtle lift: ~2px upward translate + soft shadow increase, ~150ms ease-out; reverse on mouse-leave. |
| **Employee cards (on load)** | Light staggered fade/slide-in (~40–60ms stagger per card, ~200ms each) when the board first renders or after filtering. |
| **List rows (hover)** | Subtle background tint fade-in, ~100ms. |
| **List → Profile / Kanban → Profile navigation** | Shared-element-style transition: the clicked card/row's name and avatar should smoothly carry over into the Profile header position (~250ms ease-in-out) rather than a hard page cut, if the framework supports it; otherwise a simple cross-fade (~200ms) is an acceptable fallback. |
| **Smart buttons (hover/press)** | Slight lift or background tint on hover (~100ms); scale to ~0.97 on press. |
| **Tab switch (Work ↔ Private Information)** | Underline indicator slides to the newly active tab (~200ms ease-in-out); field content cross-fades (~150ms) rather than popping. |
| **EDIT toggle (read-only → editable)** | Field backgrounds/borders fade in (~150ms) as they become editable inputs; Save/Cancel actions fade+slide in from the right, ~150ms. |
| **Status dot/text** | No animation by default; on a live status change, cross-fade color/label over ~200ms rather than an instant swap. |

General rule for the agent: motion should communicate *where things came from and where they're going* (dropdown origin, view-toggle direction, card→profile continuity) — never animation for its own sake.