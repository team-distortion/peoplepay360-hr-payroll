# PeoplePay360 — Frontend Build Spec

A complete solution for integrated HR and payroll operations management.

## Product Summary

PeoplePay360 is an HR + payroll platform. Core capabilities the frontend must support (even if only the auth screen is being built first):

- Manages employee profiles
- Tracks daily attendance
- Processes accurate payroll

This document specifies the **HR Portal sign-in screen** in enough visual and behavioral detail to implement without a reference image.

---

## 1. Page Layout

- Full-viewport background, light neutral (white or very light gray, e.g. `#F9FAFB`).
- Content is a single **centered card** — not full-bleed — roughly `440–460px` wide, vertically centered in the viewport with generous top/bottom margin so it reads as a focused, single-task screen.
- No visible page header, nav bar, or footer outside the card. This is a standalone auth screen.

---

## 2. Card Container

| Property | Spec |
|---|---|
| Background | White (`#FFFFFF`) |
| Border radius | Large, ~16–20px, all corners |
| Border | 1px, very light gray (`#E5E7EB`) |
| Shadow | Soft, diffuse drop shadow (e.g. `0 4px 24px rgba(0,0,0,0.06)`) to lift it off the page background |
| Overflow | `hidden` so the header band's corners clip to the card radius |

### 2.1 Header band (top of card)

- Sits at the very top of the card, spans full card width.
- Background: pale blue-gray tint (e.g. `#F3F5F9` / `#F6F9FC`), visually distinct from the white body below it.
- Bottom border: 1px hairline, same light gray as the card border.
- Contains only a small label: **"HR Portal"**
  - Left-aligned, small font size (~13–14px), medium weight, muted gray text (`#6B7280`).
  - Padding: ~16px horizontal, ~12px vertical.

---

## 3. Card Body

Padding: generous, ~32px horizontal and vertical, so form elements never touch the card edges.

### 3.1 Heading block

- **"Welcome back"**
  - Large, bold, dark near-black text (`#111827` or similar), ~22–24px.
  - This is the primary heading of the screen.
- **"Sign in to continue to your workspace"**
  - Directly below the heading, smaller (~13–14px), regular weight, muted gray (`#6B7280`).
  - Establishes the subtext/description pattern: heading + one-line gray subtext underneath every major heading.

Vertical gap between heading block and the form below: ~24–32px.

### 3.2 Form fields

Two stacked fields, each following the same pattern:

**Label**
- Small (~12–13px), medium weight, gray (`#6B7280`), positioned directly above its input with a small ~6px gap.
- Field 1 label: **"Work Email"**
- Field 2 label: **"Password"**

**Input**
- Full width of the card body.
- Height: ~44–48px.
- Border: 1px solid light gray (`#D1D5DB`).
- Border radius: ~8px (moderate rounding — not pill-shaped, not sharp).
- Background: white.
- Padding: ~12px horizontal.
- Placeholder text: light gray, lower visual weight than entered text.
  - Field 1 placeholder: `name@company.com`
  - Field 2: password type input (masked/dot characters), no visible placeholder needed beyond a generic one.
- Focus state (implement even though not visible in the static reference): border color shifts to the brand blue accent, optionally with a subtle blue focus ring/glow.
- Vertical gap between the two field groups: ~16–20px.

**Forgot password link**
- Positioned at the top-right edge of the Password field's label row (right-aligned, same line as "Password" label or just above the input).
- Text: **"Forgot password?"**
- Small (~12–13px), brand blue accent color, no underline by default; underline or darken on hover.

### 3.3 Primary action button

- **"Sign In"**
- Full width of the card body.
- Height: ~44–48px, matching the input fields.
- Background: solid brand blue (e.g. `#2563EB` / a strong medium blue — not navy, not indigo-violet).
- Text: white, bold/semibold, centered, ~14–15px.
- Border radius: ~8px, matching the inputs (consistent radius language across inputs and button).
- Hover state: slightly darker blue.
- Disabled state (e.g. while fields are empty or a request is in flight): reduced opacity, non-interactive cursor.
- Margin above button (gap from the last input): ~24px.

### 3.4 Divider

- A subtle horizontal hairline rule below the button, full width of the card body, same light gray as other borders (`#E5E7EB`).
- Separates the actionable form area from the informational footnotes below.

### 3.5 Footnotes

Two centered lines of muted, small gray text below the divider, in descending order of size/emphasis:

1. **"Accounts are created by an administrator."**
   - Centered, small (~12–13px), muted gray, medium-ish weight — slightly more prominent than line 2.
   - Communicates there is no self-serve sign-up on this screen.
2. **"After sign-in, show only the modules and actions allowed by the user's assigned role."**
   - Centered, smaller (~11–12px), lighter/more muted gray, possibly italic.
   - This line is a **behavioral spec, not just copy**: it documents that the product implements role-based access control (RBAC) — once authenticated, the app must conditionally render modules/nav items/actions based on the signed-in user's role. Treat this as a functional requirement for whatever screen follows sign-in, not merely as UI text.

---

## 4. Typography

- Use a clean system sans-serif (e.g. `Inter`, `-apple-system`, `Segoe UI`, or equivalent) for all UI text — the handwritten/marker font seen in the left-hand notes panel of the source sketch is a **wireframe annotation style only** and must not be used in the built product.
- Establish a consistent type scale:
  - Heading ("Welcome back"): ~22–24px, bold
  - Section label ("HR Portal", field labels): ~12–14px, medium
  - Body/input text: ~14–15px, regular
  - Footnotes: ~11–13px, regular/light

---

## 5. Color Palette

| Token | Approx. value | Usage |
|---|---|---|
| `bg-page` | `#F9FAFB` | Page background behind the card |
| `bg-card` | `#FFFFFF` | Card body |
| `bg-header-band` | `#F3F5F9` | "HR Portal" header strip |
| `border-default` | `#E5E7EB` | Card border, divider, header band border |
| `border-input` | `#D1D5DB` | Input borders |
| `text-primary` | `#111827` | Headings |
| `text-secondary` | `#6B7280` | Subtext, labels, footnotes |
| `accent-primary` | `#2563EB` | Button background, links, focus ring |
| `accent-primary-hover` | Darker shade of accent | Button/link hover |

---

## 6. Interaction / State Notes for the Agent

- Both inputs are required; disable or visually flag the Sign In button until both have values (exact validation rules are a backend/product decision, not shown in the reference — implement standard email + non-empty password checks as a placeholder).
- "Forgot password?" should route to a password-reset flow (not specified further here — stub the route).
- There is no "Sign up" / "Create account" affordance anywhere on this screen — this is intentional per the footnote; do not add one.
- On successful sign-in, the resulting app shell must vary its visible modules/nav/actions by the authenticated user's role — build the post-login layout with that constraint in mind (e.g. a role-to-permissions mapping driving conditional rendering), even though the specific roles/modules aren't defined in this spec.

---

## 7. Out of Scope for This Spec

The left-hand notes in the source sketch (project title, description, and the "Manages employee profiles / Tracks daily attendance / Processes accurate payroll" bullet list) are **planning annotations**, not UI to be rendered — they describe the product's overall scope, not elements on the sign-in screen itself. They're included above only as product-level context.