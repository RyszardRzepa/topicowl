# Notion-Inspired UI Style Guide

## 1. Core Principles

- **Focus on Content** – UI should feel like a blank sheet; avoid unnecessary chrome
- **Minimal Contrast, Max Legibility** – Rely on soft grays and high-contrast text
- **Subtle Cues** – State changes are communicated through gentle color, elevation and motion (never loud)
- **Consistency Before Variety** – The same pattern must behave the same everywhere

## 2. Foundations

### 2.1 Typography

| Role | Font | Weight | Size (rem / px) | Line-height |
|------|------|--------|-----------------|-------------|
| Body | Inter, sans-serif fallback | 400 | 0.94 / 15 px | 1.6 |
| Small | Inter | 400 | 0.875 / 14 px | 1.5 |
| H3 | Inter | 600 | 1.25 / 20 px | 1.45 |
| H2 | Inter | 600 | 1.5 / 24 px | 1.4 |
| H1 | Inter | 700 | 1.875 / 30 px | 1.3 |

**Guidelines:**
- Use Sentence case for all headings
- Limit max text line-length to 680 px (~72 ch) in default layout
- Provide a Small text toggle that reduces font-size to 0.875 rem and tightens vertical rhythm (mirrors Notion's small-text option)

### 2.2 Color System

#### Light mode (default)

| Token | Text | Background |
|-------|------|------------|
| default | #373530 | #FFFFFF |
| gray | #787774 | #F1F1EF |
| brown | #976D57 | #F3EEEE |
| orange | #CC782F | #F8ECDF |
| yellow | #C29343 | #FAF3DD |
| green | #548164 | #EEF3ED |
| blue | #487CA5 | #E9F3F7 |
| purple | #8A67AB | #F6F3F8 |
| pink | #B35488 | #F9F2F5 |
| red | #C4554D | #FAECEC |

#### Dark mode
(invert surfaces; text shifts to light gray)

| Token | Text | Background |
|-------|------|------------|
| default | #D4D4D4 | #191919 |
| ...follow table from light mode using dark variants |

**Accent color (accent-blue):** #2F80ED – apply to primary actions, links, focus rings

**Usage Rules:**
- 90% of the UI should remain grayscale
- Reserve accent colors for interactivity, states, and inline semantic highlights
- Maintain a minimum 4.5:1 contrast ratio for text/surface combinations

### 2.3 Spacing & Layout

- **8-pt grid** across spacing, sizing, and iconography
- **Default content column:** 680 px. Provide a Full-width mode up to 1180 px when toggled
- **Vertical rhythm:** {4, 8, 16, 24, 32, 48} px increments
- **Corner radius:** 4 px global; never exceed 8 px

### 2.4 Elevation

- **0 dp:** static elements
- **1 dp:** hover surfaces (shadow: 0 1 2 rgba(0,0,0,0.04))
- **2 dp:** active/drag or modal surfaces

## 3. Components

### 3.1 Links
```css
color: var(--accent-blue);
text-decoration: none;
transition: color .15s ease;

&:hover {
  text-decoration: underline;
}
```

### 3.2 Buttons

| Style | Default | Hover | Active/Pressed |
|-------|---------|-------|----------------|
| Primary | bg #FFFFFF; border 1px solid #DADADA; text #373530 | subtle shadow + 4% darker text | inset shadow; background #F1F1F1 |
| Ghost | transparent bg; no border | bg rgba(55,53,48,.05) | bg rgba(55,53,48,.1) |
| Danger | text & border #C4554D | bg #FAECEC | bg #F5D9D9 |

### 3.3 Inputs / Selects
```css
border: 1px solid #E0E0E0;
background: #FFFFFF;
height: 32px;
padding: 0 8px;
border-radius: 3px;

&:focus {
  outline: 2px solid var(--accent-blue);
}
```

### 3.4 Callouts
- 1 px left-border using semantic color token
- 8 px padding; 4 px radius

### 3.5 Cards / Panels
- White surface, border 1px solid #E0E0E0, radius 4 px, shadow 0 1 3 rgba(0,0,0,0.06)

### 3.6 Dividers
```css
height: 1px;
background: #E0E0E0;
margin: 16px 0;
```

### 3.7 Iconography
- **24 × 24 px icons**
- **Stroke width 1.5 px**
- Use monochrome icons; tint with text color when placed in colored surfaces

## 4. Interaction & Motion

| Interaction | Property | Timing | Easing |
|-------------|----------|--------|--------|
| Hover in/out | opacity, shadow | 150 ms | ease-in-out |
| Collapse/expand | height, opacity | 200 ms | ease-in-out |
| Modal enter | transform translateY(8px)→0 | 250 ms | cubic-bezier(.42,0,.58,1) |

**Guidelines:**
- Keep all transitions 200-300 ms to feel snappy yet noticeable
- Only animate one property at a time to avoid jank

## 5. Accessibility

- Color contrast ≥ 4.5 for body & 3.0 for large text
- All interactive elements receive a 2 px focus ring in accent-blue
- Ensure keyboard navigation order matches DOM order
- Provide text alternatives for all icons and media

## 6. Tone & Microcopy

- Use plain, friendly language; avoid jargon
- Prefer action-oriented labels: Add page, Rename, Duplicate
- Keep error messages short, state what went wrong and how to fix

## 7. Implementation Checklist

Last updated 23 July 2025 — Aligns with Notion UI observed as of July 2025.

### Tailwind CSS Implementation

When implementing these styles with Tailwind CSS 4.0, use these utility classes:

#### Typography
- Body: `text-[15px] leading-relaxed font-normal`
- Small: `text-sm leading-normal`
- H3: `text-xl font-semibold leading-snug`
- H2: `text-2xl font-semibold leading-tight`
- H1: `text-3xl font-bold leading-tight`

#### Colors
- Default text: `text-[#373530]`
- Gray text: `text-[#787774]`
- Accent blue: `text-[#2F80ED]`
- Default background: `bg-white`
- Gray background: `bg-[#F1F1EF]`

#### Spacing
- Use: `space-y-1` (4px), `space-y-2` (8px), `space-y-4` (16px), `space-y-6` (24px), `space-y-8` (32px), `space-y-12` (48px)

#### Components
- Button primary: `bg-white border border-[#DADADA] text-[#373530] hover:shadow-sm`
- Button ghost: `bg-transparent hover:bg-black/5 active:bg-black/10`
- Input: `border border-[#E0E0E0] bg-white h-8 px-2 rounded-sm focus:outline-2 focus:outline-[#2F80ED]`
- Card: `bg-white border border-[#E0E0E0] rounded shadow-sm`
- Divider: `h-px bg-[#E0E0E0] my-4`