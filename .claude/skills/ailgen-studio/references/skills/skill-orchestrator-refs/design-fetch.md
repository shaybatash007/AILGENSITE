# Design Fetch Reference — Atomic Visual Composition

This reference is loaded when atoms involve UI, visual design, or frontend composition.
The principle: every visual element is fetched and resolved independently, then assembled
into a whole that is greater than the sum of its parts.

---

## The Design Fetch Principle

Generic AI design fails because it invents everything from nothing.
This skill fetches everything from reality, then assembles with a twist.

```
FETCH each element individually
  ↓
RESOLVE each element to a concrete value
  ↓
COMPOSE the whole from real resolved parts
  ↓
INJECT the twist — one unexpected choice that no default would make
```

---

## Element Fetch Checklist

Before designing any UI component, fetch and resolve every element:

### Typography

```
Fetch: Google Fonts catalog / font system / brand guide
Resolve to:
  □  Display font: name, weight, size scale (not "something bold")
  □  Body font: name, weight, line-height
  □  Mono font: name (if code is present)
  □  Font pairing logic: why these two work together

Never default to: Inter, Roboto, Arial, system-ui, Space Grotesk
Always verify: font is loadable in the target environment
```

### Color System

```
Fetch: color theory reference / existing brand tokens / palette generator
Resolve to:
  □  Primary: exact hex value + usage rule
  □  Secondary: exact hex + usage rule
  □  Accent: exact hex + where it appears
  □  Background: exact hex or gradient definition
  □  Surface: card/panel exact hex
  □  Text: primary text hex, secondary text hex, muted hex
  □  Semantic: success, warning, error, info hex values
  □  Border: exact hex + opacity rule

Never: "a nice blue" — always a specific hex
```

### Spacing System

```
Fetch: design system reference (8px grid / 4px grid / custom)
Resolve to:
  □  Base unit: 4px or 8px
  □  Scale: xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48, 3xl=64 (example)
  □  Padding conventions: component internal padding
  □  Margin conventions: component external spacing
```

### Iconography

```
Fetch: icon library reference (Lucide, Phosphor, Heroicons, etc.)
Resolve to:
  □  Icon set chosen + import path
  □  Icon size scale: sm=16, md=20, lg=24
  □  Stroke width: 1.5 or 2
  □  Icon color: inherits text or explicit
```

### Motion / Animation

```
Fetch: animation principles (Disney 12 / Material Motion / Spring physics)
Resolve to:
  □  Easing function: exact cubic-bezier or spring config
  □  Duration scale: fast=150ms, normal=300ms, slow=500ms
  □  Enter/exit pattern: what happens when elements appear/disappear
  □  Interaction feedback: hover, focus, active state transitions
```

### Elevation / Depth

```
Fetch: shadow system reference
Resolve to:
  □  Level 0: no shadow (flat)
  □  Level 1: subtle (cards)
  □  Level 2: medium (dropdowns)
  □  Level 3: pronounced (modals)
  □  Exact box-shadow values for each level
```

---

## Assembly Protocol

Once all elements are fetched and resolved:

```
1. LAYOUT — establish spatial structure first (grid, flex, flow)
2. TYPOGRAPHY — apply font system to all text elements
3. COLOR — apply color system to all surfaces and text
4. SPACING — apply spacing scale to all padding/margins
5. ICONS — place and size all icons
6. MOTION — layer in transitions and animations last
7. REVIEW — does the whole feel coherent? are there seams?
8. TWIST — inject the differentiator
```

---

## The Twist

Every design must contain one element that answers:
**"What would no one else think to do here?"**

Examples of valid twists:
- A cursor that changes shape on hover over interactive elements
- Section dividers that are SVG curves instead of horizontal rules
- Background that subtly shifts color as the user scrolls
- Input focus state that expands the input field slightly
- Card hover that lifts with a genuine perspective transform
- Numbers that count up when they enter the viewport
- Loading skeleton that matches the exact shape of the content
- A single accent color that appears only on the most important action

The twist must be:
- Subtle enough not to distract
- Functional (serves a purpose or adds delight, not noise)
- Technically sound (not a performance liability)
- Original (something you fetched no reference for — something invented for this)

---

## Composition Atom Template

When a design atom runs, document it:

```
[A3] DESIGN ATOM — ComponentName

PRE-FETCH
  □  Typography: fetched — [font names resolved]
  □  Colors: fetched — [hex values documented]
  □  Spacing: fetched — [scale documented]
  □  Icons: fetched — [library + names resolved]
  □  Motion: fetched — [easing + duration resolved]
  □  Reference designs: fetched — [what was studied]

EXECUTION
  Component built: [description]
  Unexpected twist: [what was injected]
  
GATE
  □  Every visual value is concrete (no "nice blue", no "large padding")
  □  Fonts are loadable
  □  Colors pass contrast ratio (WCAG AA minimum)
  □  Motion respects prefers-reduced-motion
  □  Component is responsive
  □  Twist is present and intentional

STATUS: PASS ✓ / FAIL ✗
```

---

## What "Assembled Like a Green Thing" Means

The instruction "assemble the whole like assembled parts of a green thing" means:

A leaf is not a generic shape. It is composed of:
- A specific venation pattern (structure)
- A precise shade of green unique to its species (color)
- A texture of waxy surface cells (material)
- A specific serration profile along the edge (detail)
- A petiole of exact proportion (proportion)

Each was fetched from nature's design system.
The leaf is the assembly of all these resolved specifics.
The result is recognizably, unmistakably itself.

Your UI component should be the same.
Not "a card with a button" but a specific, resolved, unmistakable thing.
