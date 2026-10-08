# Design

## Brand facts (from the re_form brandbook, 2026)

- **Name:** always lowercase with an underscore: `re_form`. Master logo **re_form ed**; sub-brands **hub**, **academy**, **community**, **platform**, **core**, each with its own mark and colour.
- **Colours**

  | Name | Hex | Sub-brand |
  | --- | --- | --- |
  | Shockwave | `#77bfb2` | ed (master) |
  | Honey Grove | `#e1b345` | hub |
  | Rich Lavender | `#79569a` | academy |
  | Vivid Vermilion | `#dd6937` | community |
  | Juicy Lime | `#abca54` | platform |
  | Sugar Pink | `#e28ba3` | core |
  | Dark Black | `#000000` in the brandbook; the PDF's dark ink and backgrounds are `#221f20` | — |
  | Pure White | `#ffffff` | — |

- **Type:** Outfit (main, semibold), Stolzl (secondary, book), Sour Gummy (decorative). Stolzl is a commercial font and needs a web licence; the mockups use Lexend in its place.
- **Logo rules:** don't modify, rotate, outline, add a shadow or put the logo in a box; align it left or centre-left; minimum height 1 cm; keep the safe zone.
- **Icons:** simple straight line icons in black or white with coloured accents.
- **Look:** lowercase headings, the `_` bar as a motif and bullet, dark `#221f20` pages with teal headings.

## Accessibility notes

- Teal `#77bfb2` is too light for text on white. On white backgrounds use `#3a978a` for headings of 24 px and up and `#2b7a6e` for smaller text.
- Text on teal, honey, lime, pink or vermilion fills: dark ink `#221f20`. Text on lavender: white.

## Controls (iOS style, 2026-10-09)

Buttons, fields, selects, switches, checks, segmented controls, chips and menus use the `ui-` classes in
`src/app/globals.css` in every theme (Pirjo's choice: iOS look everywhere, re_form teal as the one tint colour).
Soft fills instead of outlines; shadows only on the switch knob, the selected segment and menus (which also blur
what is behind them). Capsule buttons, 44 px tall by default (`ui-sm` 32 px). Fields are 16 px so iPhones don't zoom.

| Token | White | Dark | Colour | Checked against (≥4.5:1 for text) |
| --- | --- | --- | --- | --- |
| tint (text, plain buttons) | `#24695f` | `#8fd0c4` | `#24695f` | page, sunk panels, gray and tinted fills |
| tint fill (filled buttons) | `#24695f` + white text (6.4:1) | `#77bfb2` + ink (7.7:1) | `#77bfb2` + ink | — |
| danger | `#a83226` | `#f39a78` | `#a83226` | page, sunk panels, tinted fill |
| switch on | `#3a978a` | `#77bfb2` | `#3a978a` | ≥3:1 against the page |
| check ring | `#7c7c82` | `#8e8e93` | `#7c7c82` | ≥3:1 against the page |

## Design directions

The 15 mockups live on a Claude Design canvas (private link, owner: Pirjo) and their source is in [mockups/](mockups/). They are written in Claude's `.dc.html` canvas format, so they are a visual and CSS reference rather than pages that open on their own.

| Direction | Look | Files |
| --- | --- | --- |
| A · Dark studio | `#221f20` ground, teal accent, editorial lowercase type, square corners | `A-*.dc.html` |
| B · White paper | White ground, thin ink rules, newsletter-style home page, teal as highlight | `B-*.dc.html` |
| C · Colour system | Each module takes a sub-brand colour and logo, 2 px ink outlines, rounded "sticker" shapes, Sour Gummy numbers | `C-*.dc.html` |

In direction C the module ↔ sub-brand mapping is a proposal: workspace = core, resources = hub, assessments = academy, messages = community, logged-in app = platform.

## Logos

[logos/](logos/) holds PNG crops from the brandbook PDF in dark-ink and white-ink versions. Swap in the official SVG files before launch.
