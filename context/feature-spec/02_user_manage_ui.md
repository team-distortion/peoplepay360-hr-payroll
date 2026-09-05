# PeoplePay360 — User Management: Build Spec

Admin-only screen for managing user accounts, their linked employee records, work email, assigned role, and active/inactive status. This document describes every element and behavior needed to build the page without the reference image.

---

## 1. Page-Level Structure

Three regions, top to bottom / left to right:

1. **Page header bar** — title + access-level badge.
2. **Toolbar** — new-user action, search, role filter.
3. **Main content** — two-column split:
   - Left (wider): **user table** + helper text + footnote.
   - Right (narrower, fixed-width panel): **Create / Edit User form**.

The right-side panel is always visible (not a modal) — it's a persistent side panel that reflects either "create new" state or "edit selected row" state.

---

## 2. Page Header Bar

- Full-width band at the top of the page, visually separated from the content below (light background tint, rounded container).
- Contains:
  - **Title**: "User Management" — large, bold text, left-aligned.
  - **Badge**: "ADMIN ONLY" — small pill/rounded-rect badge immediately to the right of the title, outlined style (not filled), brand-blue text and border.
    - Functional meaning: this page must only be reachable/rendered for users whose role includes admin-level access — the badge is a visual flag of a route-level permission gate, not decorative.

---

## 3. Toolbar (below header, above table)

Three controls in a horizontal row:

### 3.1 "+ New User" button
- Primary/filled button, brand blue background, white text, left-aligned, icon (`+`) before the label.
- Action: opens/resets the right-side panel into **create mode** — clears any selected row and empties the form fields.

### 3.2 Search input
- Text input, placeholder: **"Search users, employees or email..."**.
- Filters the table rows live (or on submit) by matching against User name, Employee name, and Work Email columns.

### 3.3 Role Filter control
- Button/dropdown labeled **"Role Filter"**.
- Opens a filter (dropdown or panel) to filter the table by one or more of the available roles (see §5.3 for the role list).

---

## 4. User Table

Columns, left to right:

| Column | Content |
|---|---|
| **User** | Display name of the account holder |
| **Employee** | Linked employee record's name (may differ from User in real data, though shown identical in the sample rows) |
| **Work Email** | Email address tied to the account |
| **Role** | Current assigned role label (e.g. "Payroll User", "Time Off Admin", "Time Off User", "Payroll Admin") |
| **Status** | A status pill (e.g. "Active") — outlined badge style |

### 4.1 Row behavior
- Rows are clickable/selectable.
- The currently selected row is visually highlighted (light blue background fill + a solid colored left-edge accent bar) — this reflects **which user's data is currently loaded into the right-side edit panel**.
- Clicking a different row swaps the right panel into **edit mode** for that user, pre-filling the form with that user's data.

### 4.2 Status pill
- Small outlined rounded pill inside the Status column, text e.g. "Active" (should also support an inactive/disabled state, styled distinctly — e.g. muted gray — even though only "Active" appears in the sample data).

### 4.3 Helper text (below table)
- **"Select a user to edit access, or create a new user."**
- Static instructional text, small, muted.

### 4.4 Footnote (bottom of left column)
- **"User accounts are separate from Employee records, but should be linked to an employee for access and ownership."**
- Functional note: a User account is a distinct entity from an Employee record. The form must support associating a user account with an employee (see §5.1) rather than assuming they're the same object, even when their display names coincide.

---

## 5. Right Panel — Create / Edit User

A card-style panel, visually distinct from the table area, containing:

### 5.0 Panel header
- Small label above the panel title: **"Open on New User"** (or dynamically: "Editing: <user name>" when a row is selected — the sample only shows the "new user" state's label, but the panel must support both).
- Panel title: **"Create / Edit User"** — bold, medium-large text.

### 5.1 Employee field
- Label: **"Employee *"** (required — asterisk denotes required field).
- Control: a select/combobox input, placeholder **"Select employee"**.
- Behavior: this is how a user account gets linked to an existing employee record (per the footnote in §4.4) — it should be a searchable dropdown sourced from existing employee records, not a free-text field.

### 5.2 Work Email field
- Label: **"Work Email *"** (required).
- Control: text input, placeholder **"employee@company.com"**.
- Should validate as an email format.

### 5.3 Roles field (required, single-select)
- Label: **"Roles *"**.
- Control: a vertical list of radio buttons (single-select, not checkboxes — only one role can be active at a time per the round radio indicators):
  1. Employee
  2. Hr Manager
  3. Hr Payroll User
  4. Hr Payroll Admin
  5. Admin
- One option is selected by default/on load when editing (shown as a filled radio dot in the reference).
- This list should stay consistent with whatever role values populate the table's **Role** column and the toolbar's **Role Filter** — treat it as the single source of truth for available roles.

### 5.4 Account Status field
- Label: **"Account Status"** (not marked required).
- Control: a toggle-like pill button, e.g. **"Active"** — clicking should switch between Active/Inactive states. Style it consistent with the Status pill used in the table (§4.2) so the same state reads identically in both places.

### 5.5 Submit button
- Full-width button at the bottom of the panel, label: **"Create User / Save Access"**.
- Filled, brand-blue background, white bold text.
- Label should be dynamic in real implementation: "Create User" when in create mode, "Save Access" (or similar) when editing an existing user — the mockup shows a combined label covering both states.
- Action: validates required fields (Employee, Work Email, Roles), then creates a new user account or updates the selected one, linking it to the chosen Employee record with the selected Role and Account Status.

---

## 6. State Summary (for the agent)

The page has exactly two modes for the right panel, driven by table interaction:

| Mode | Trigger | Panel state |
|---|---|---|
| **Create** | Clicking "+ New User", or no row selected | Empty form, no row highlighted in table, submit button reads "Create User" |
| **Edit** | Clicking a table row | Form pre-filled with that user's Employee, Work Email, Role, and Account Status; that row highlighted; submit button reads "Save Access" |

---

## 7. Access Control Note

This entire page is gated behind admin permissions (per the "ADMIN ONLY" badge in §2). Ensure routing/rendering logic checks the authenticated user's role before mounting this page — consistent with the role-based visibility requirement noted in the sign-in spec (modules/actions shown depend on assigned role).