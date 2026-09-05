# UI Context — 

*Compiled from visual inspection of the public marketing site. Exact hex values and CSS variable names are Stripe's internal implementation detail and aren't exposed publicly — the values below are close approximations based on Stripe's published brand palette and observed rendering.*

## Theme

Light-first, high-contrast. The visual language is an airy, editorial "financial infrastructure" site — white/near-white backgrounds, black display type, and a single vivid indigo-violet accent used sparingly for interactive elements, links, and gradient flourishes. Dark sections (e.g. footer, occasional full-bleed panels) are used as contrast blocks, not a persistent dark mode.

| Role              | Approx. Value       | Notes                                    |
| -------------------| ---------------------| ------------------------------------------|
| Page background   | `#FFFFFF`           | Primary canvas                           |
| Secondary surface | `#F6F9FC`           | Pale blue-grey, used for section bands   |
| Dark surface      | `#0A2540`           | Deep navy, used in contrast/footer bands |
| Primary text      | `#0A2540`           | Near-black navy, not pure black          |
| Secondary text    | `#425466`           | Slate grey for body copy                 |
| Muted text        | `#697386`           | Captions, metadata                       |
| Divider / border  | `#E3E8EE`           | Hairline borders on cards and tables     |
| Brand accent      | `#635BFF`           | Signature Stripe indigo-violet           |
| Accent gradient   | `#635BFF → #00D4FF` | Used in hero waves and illustrations     |
| Success           | `#3ECF8E`           | Positive states in product UI mockups    |
| Error             | `#DF1B41`           | Form validation, negative states         |
| Warning           | `#FFA940`           | Rare, used sparingly                     |

No true dark mode — the site does not offer a theme toggle.

## Typography

| Role          | Font                         | Notes                                  |
| ------------- | ----------------------------- | --------------------------------------- |
| Display / headings | Custom Stripe sans (proprietary, falls back to system sans-serif) | Tight tracking, large scale (60–80px on hero) |
| Body / UI     | Same custom sans, regular weight | High readability at small sizes |
| Code / mono   | Monospace (used in API/code snippets throughout Developers sections) | Syntax-highlighted, dark code blocks embedded in light page |

Headlines favor italic emphasis on key phrases (e.g. hero copy mixes upright and italic in the same sentence for emphasis).

## Border Radius

Radius is moderate and consistent rather than steeply tiered — Stripe favors soft, rounded rectangles across nearly all surfaces.

| Context              | Approx. Radius |
| --------------------- | -------------- |
| Buttons / pills       | Fully rounded (pill shape) |
| Inline badges / tags  | ~6–8px |
| Cards / bento panels  | ~16–24px |
| Modals / large media  | ~24px |

## Layout Patterns

- **Hero**: Full-bleed, centered headline with mixed upright/italic type, a single primary CTA button, and an animated gradient "wave" graphic beneath the fold.
- **Logo strip**: Auto-scrolling marquee of customer/news logos directly under the hero.
- **Bento grid**: Product capabilities ("Enable any billing model," "Embed payments," etc.) are shown as an asymmetric grid of cards of varying sizes — some with embedded product-UI screenshots, some text-only.
- **Stat bands**: Full-width sections with large numerals (e.g. "135+", "US$1.9tn") paired with short descriptive labels, usually 3–4 per row.
- **Case-study accordion**: Vertically stacked, expandable customer stories (Hertz, URBN, Instacart, Le Monde) — each reveals a metrics panel and a themed photo when active.
- **Quote carousel**: Rotating customer testimonials with attribution (name, title, company) and a "Read the story" link.
- **Three-column feature blocks**: Recurring pattern for grouping related links/guides under a subheading (e.g. "Get to market faster / Grow new lines of revenue / Manage platform risk").
- **News/content grid**: Card-based "What's happening" section, doubling as a swipeable carousel on mobile.
- **Footer**: Dense, multi-column sitemap on a dark navy band, organized by Products, Solutions, Developers, Resources, Company, Support.

## Component Library

No visible third-party UI kit branding — components read as a bespoke design system (buttons, pills, bento cards, accordions, marquees, carousels) built specifically for stripe.com, distinct from the Stripe Dashboard's own product UI (which appears embedded as illustrative screenshots within cards).

## Iconography & Imagery

- Minimal line icons, used sparingly compared to photography and product-UI screenshots.
- Heavy use of real photography (offices, storefronts, delivery scenes) art-directed so a physical detail in the shot (a window frame, a crosswalk, a delivery bag) subtly echoes Stripe's parallelogram logo mark.
- Product screenshots (dashboard panels, billing meters, checkout UI) are embedded directly into bento cards rather than abstracted into icons.

## Motion

- Subtle gradient "wave" animation in the hero.
- Auto-scrolling logo marquee.
- Accordion expand/collapse on customer stories.
- Horizontal swipe/carousel behavior on stat and news sections at narrow viewports.

## Custom Components

*Not observed on the live site — added here as a project-specific interaction pattern for bento/feature cards.*

### `GradientCard`

A card with a localized gradient **border**: a thin (1px) gradient ring that tracks the cursor around the card's edge — no glow, no fill, just color on the border itself. (An earlier version used a radial glow fill instead; that approach was reverted in favor of this thinner border treatment.)

```jsx
import { useRef } from "react";

/**
 * Card with a localized gradient border.
 *
 * A thin (1px) gradient ring tracks the cursor around the card's edge —
 * no glow, no fill, just color on the border itself.
 *
 * Drop this into components/ui/ and use it like a normal card:
 *   <GradientCard>...</GradientCard>
 */
export default function GradientCard({ children, className = "", ...props }) {
  const ref = useRef(null);

  function handleMouseMove(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
    el.style.setProperty("--border-opacity", "1");
  }

  function handleMouseLeave() {
    ref.current?.style.setProperty("--border-opacity", "0");
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`gradient-border-card relative rounded-2xl bg-surface border border-default ${className}`}
      {...props}
    >
      <div className="relative">{children}</div>

      {/* Move this <style> block to your global stylesheet (e.g. globals.css)
          if GradientCard is used more than once per page — a <style> tag
          per instance works but duplicates the rule. */}
      <style>{`
        .gradient-border-card {
          --x: 50%;
          --y: 50%;
          --border-opacity: 0;
        }
        .gradient-border-card::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px; /* border thickness — keep this minimal */
          background: radial-gradient(
            220px circle at var(--x) var(--y),
            var(--accent-primary),
            var(--accent-ai) 60%,
            transparent 80%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          opacity: var(--border-opacity);
          transition: opacity 300ms ease;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
```

Notes:
- The gradient lives on a `::before` pseudo-element sized with `padding: 1px` and masked with the `content-box`/`border-box` exclude trick, so only a 1px ring is visible — not a filled glow.
- `--x`/`--y` are set imperatively via `el.style.setProperty` in `mousemove` rather than React state, avoiding a re-render on every pointer move.
- Uses `--accent-primary` and `--accent-ai` for the ring's two gradient stops; swap either for a single flat color if a two-tone ring isn't wanted.
- If cards are built on `shadcn`'s `Card` component, keep that as the base and layer the `::before` rule plus the `onMouseMove`/`onMouseLeave` handlers onto it rather than replacing it.

### `StripeBarChart` / `StripeLineChart`

Chart primitives built to match the site's palette and card language: near-white surfaces, navy ink, a single indigo-violet accent (`#635BFF`) reserved for the active/hovered data point, and the `#635BFF → #00D4FF` gradient applied to line strokes rather than used as decoration. Both share a `ChartShell` wrapper so they sit inside the same rounded, hairline-bordered surface as the bento cards above.

```jsx
import { useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * Stripe-styled chart primitives.
 *
 * Palette and type follow the Stripe marketing-site tokens: near-white
 * surfaces, navy ink, a single indigo-violet accent (#635BFF), and a
 * two-tone gradient (#635BFF -> #00D4FF) reserved for the active/hovered
 * data point rather than the whole series.
 *
 * Drop into components/ui/ and use like:
 *   <StripeBarChart data={data} dataKey="value" xKey="label" />
 *   <StripeLineChart data={data} dataKey="value" xKey="label" />
 */

const tokens = {
  bg: "#FFFFFF",
  surface: "#F6F9FC",
  navy: "#0A2540",
  slate: "#425466",
  muted: "#697386",
  border: "#E3E8EE",
  accent: "#635BFF",
  accentSoft: "#EDECFF",
  gradientEnd: "#00D4FF",
};

function ChartShell({ title, subtitle, children }) {
  return (
    <div
      style={{
        background: tokens.bg,
        border: `1px solid ${tokens.border}`,
        borderRadius: 20,
        padding: "24px 24px 12px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: 16 }}>
          {title && (
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: tokens.navy,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{ fontSize: 13, color: tokens.muted, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function StripeTooltip({ active, payload, label, valueFormatter }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div
      style={{
        background: tokens.navy,
        color: "#FFFFFF",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        boxShadow: "0 8px 24px rgba(10,37,64,0.18)",
      }}
    >
      <div style={{ color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontWeight: 600 }}>
        {valueFormatter ? valueFormatter(value) : value}
      </div>
    </div>
  );
}

export function StripeBarChart({
  data,
  dataKey = "value",
  xKey = "label",
  title,
  subtitle,
  valueFormatter,
  height = 260,
}) {
  const [activeIndex, setActiveIndex] = useState(null);

  return (
    <ChartShell title={title} subtitle={subtitle}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            onMouseMove={(state) =>
              setActiveIndex(state?.isTooltipActive ? state.activeTooltipIndex : null)
            }
            onMouseLeave={() => setActiveIndex(null)}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke={tokens.border}
              strokeDasharray="0"
            />
            <XAxis
              dataKey={xKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: tokens.muted, fontSize: 12 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: tokens.muted, fontSize: 12 }}
              width={36}
            />
            <Tooltip
              cursor={{ fill: tokens.surface }}
              content={<StripeTooltip valueFormatter={valueFormatter} />}
            />
            <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} maxBarSize={40}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === activeIndex ? tokens.accent : tokens.accentSoft}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}

export function StripeLineChart({
  data,
  dataKey = "value",
  xKey = "label",
  title,
  subtitle,
  valueFormatter,
  height = 260,
}) {
  return (
    <ChartShell title={title} subtitle={subtitle}>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="stripeLineStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={tokens.accent} />
                <stop offset="100%" stopColor={tokens.gradientEnd} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={tokens.border} />
            <XAxis
              dataKey={xKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: tokens.muted, fontSize: 12 }}
              dy={8}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: tokens.muted, fontSize: 12 }}
              width={36}
            />
            <Tooltip content={<StripeTooltip valueFormatter={valueFormatter} />} />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke="url(#stripeLineStroke)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 5,
                fill: tokens.accent,
                stroke: "#FFFFFF",
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
```

Notes:
- Bars sit at a soft indigo fill (`#EDECFF`) at rest and switch to the solid accent (`#635BFF`) only on hover — the same "accent appears on interaction, not by default" restraint used in `GradientCard`.
- The line stroke reads its color from an SVG `<linearGradient>` (`url(#stripeLineStroke)`), which only resolves in SVG-based renderers (Recharts/D3) — swapping to a canvas-based chart library (e.g. Chart.js) would need a solid color or a canvas gradient instead.
- Tooltip is a custom dark-navy (`#0A2540`) card rather than the Recharts default, echoing the site's dark footer/contrast-band treatment.
- Gridlines are hairline `#E3E8EE`, horizontal only, with muted `#697386` tick labels — kept recessive so the data reads as the primary signal.
- Both accept `data`, `dataKey`, `xKey`, `title`, `subtitle`, and `valueFormatter` props for reuse across different metrics.