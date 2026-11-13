# Design

## Who it is for and what the page must do

MedMap is for older people and the family members who look after their medicines. Many
read on a phone, some with poor eyesight, often while holding a pill bottle. The interface
has one job: show which combinations to raise with a pharmacist, and never look more
certain than the data is.

## Direction: the pharmacy counter

The visual language comes from the dispensary: a printed bottle label, a clean counter,
ink that is easy to read. Calm and plain. No gradients, no glass, no decoration that could
be mistaken for a signal.

- **Signature element:** medicines are drawn as small bottle labels, and the lines between
  them use three line styles (thick solid, dashed, dotted). The hero of the landing page
  is that map itself, built from invented demo medicines, because the map is the product.
- **Restraint everywhere else:** flat surfaces, one typeface, left-aligned text.
- **Amber is used once:** the colour of a pill bottle marks the brand accent in the hero
  and the logo. It is never used for severity.

## Colour roles

Tokens live in `apps/web/tailwind.config.ts`. Components use the names, never hex values.

| Role                | Light     | Dark      | Use                                            |
| ------------------- | --------- | --------- | ---------------------------------------------- |
| `surface`           | `#F3F6F5` | `#0F1B1E` | Page background, a cool paper white            |
| `surface-raised`    | `#FFFFFF` | `#17272B` | Cards, dialogs, inputs                         |
| `surface-sunken`    | `#E6ECEA` | `#0A1416` | Wells, table headers, hover                    |
| `text`              | `#14262B` | `#E6EFED` | Body text (ink)                                |
| `text-muted`        | `#465A5F` | `#A6B8B5` | Secondary text, still AA on every surface      |
| `border`            | `#C3CFCC` | `#2C4045` | Dividers                                       |
| `border-strong`     | `#6F8380` | `#6B8786` | Input and control outlines (3:1)               |
| `primary`           | `#0E5A63` | `#5CC4CB` | Actions and links, a deep dispensary teal      |
| `accent`            | `#E3A02B` | `#E9B24C` | Brand mark and hero only                       |
| `focus`             | `#0B57D0` | `#8AB4FF` | Focus ring, distinct from every other colour   |
| `danger`            | `#A62B0B` | `#FF9B7A` | Destructive actions and form errors            |
| `severity-serious`  | `#A62B0B` | `#FF9B7A` | Serious flags (vermilion)                      |
| `severity-moderate` | `#735000` | `#F1C35B` | Moderate flags (ochre)                         |
| `severity-minor`    | `#1D5A9E` | `#8DBBF2` | Minor flags (blue)                             |
| `unchecked`         | `#465A5F` | `#A6B8B5` | "Could not check", always with a hatch pattern |
| `demo`              | `#3B2A6B` | `#CDBDFF` | Demo-data banner, unlike any severity colour   |

Each severity has a `-soft` background. The three severity hues follow the Okabe-Ito
colour-blind-safe set (vermilion, yellow-brown, blue) and differ in lightness, but colour
is never the only signal: every severity also has a text label, an icon shape and a line
style. There is no green anywhere, because green reads as "safe".

A third theme, `contrast`, uses black on white with black borders. It is chosen in
settings or picked up from `prefers-contrast: more`.

## Type

One family: **Atkinson Hyperlegible Next** (variable, self-hosted, `font-display: swap`).
It was drawn for low-vision readers; similar letters are made deliberately different.

| Token  | Size (rem) | Use                         |
| ------ | ---------- | --------------------------- |
| `xs`   | 0.8125     | Fine print, never body text |
| `sm`   | 0.9375     | Labels, table cells         |
| `base` | 1.0625     | Body (17 px)                |
| `lg`   | 1.25       | Lead paragraphs             |
| `xl`   | 1.5        | Card titles                 |
| `2xl`  | 1.875      | Section headings            |
| `3xl`  | 2.375      | Page titles                 |
| `4xl`  | 3          | Landing headings            |
| `5xl`  | 3.75       | Landing hero, desktop only  |

Headings are bold (700) with tight tracking. Body is 400. Lines stay under 68 characters.
Sentence case everywhere; no all-caps labels. Large-text mode scales the root size to 120%.

## Spacing, radius, shadow

- Spacing: Tailwind's 4 px scale. Page gutter 20 px on phones, 32 px from 768 px.
- Touch targets: at least 44 by 44 px (`min-h-touch`).
- Radius: `sm` 4 px (badges), `md` 8 px (controls), `lg` 14 px (cards, dialogs).
- Shadow: `raised` for cards that sit above the page, `overlay` for dialogs. Nothing else.

## Layout

- Content is left-aligned in a single column up to 72 rem wide.
- Breakpoints: 480, 768, 1024 and 1440 px. Layouts are designed at 360 px first.
- Signed-in pages use a bottom navigation bar under 768 px and a left rail from 768 px.
- Results open on the ranked list. The graph is the second tab and gets a "focus on this
  medicine" control so it stays usable on a phone. A table is the third tab.

## Components

`presentation/ui/`: Button, Input, Select, Dialog, Toast, Card, Badge, Tabs, Table,
Skeleton, EmptyState, Stepper.

Rules:

- Every interactive element has hover, focus-visible, disabled, loading and error states.
- The focus ring is 3 px, offset 2 px, in the `focus` colour, on every theme.
- Errors say what happened and what to do next. Empty states offer the next action.
- A button's label names what it does ("Add medicine"), and the result uses the same word.

## Severity encoding

| Severity        | Line                | Icon             | Label             |
| --------------- | ------------------- | ---------------- | ----------------- |
| Serious         | 5 px solid          | Warning triangle | "Serious"         |
| Moderate        | 3 px dashed         | Diamond          | "Moderate"        |
| Minor           | 1.5 px dotted       | Circle           | "Minor"           |
| Could not check | hatched node border | Question mark    | "Could not check" |

Pairs with no flag are not drawn at all.

## Motion

GSAP with ScrollTrigger, through hooks in `application/animation/`. Constants are in
`domain/motion.ts`.

- One orchestrated moment: the landing hero draws its map (labels first, then lines).
- A pinned three-step "how it works" sequence on the landing page.
- Short staggered entrances for lists of cards, and count-ups on the results summary.
- Safety content is never animated: severity badges, warnings and notices appear at once.
- With `prefers-reduced-motion: reduce` every animation shows its final state immediately.
- Hidden start states are set from JavaScript, so content is visible if scripts fail.

## Voice

Short sentences. Plain words, around a 6th-grade reading level. "Medicine", not
"medication". Say what a thing does. Never reassure: MedMap reports what a source lists and
points to the pharmacist.
