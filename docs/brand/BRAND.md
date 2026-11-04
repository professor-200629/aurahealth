# AuraHealth brand kit

**The mark:** an arch that shelters a person, and also the letter A. It is meant to say "someone is looking out for you".
It avoids hearts, crosses (the red cross is a protected emblem) and lotus shapes (a party symbol in India).

| Asset | File |
| --- | --- |
| Colour mark on teal | `aurahealth-mark.svg` |
| Mark for light backgrounds | `aurahealth-mark-on-light.svg` |
| One colour, white | `aurahealth-mark-one-color.svg`, `aurahealth-mark-white.svg` |
| Mark and name | `aurahealth-wordmark.svg` |
| Concepts compared | `concepts.html` |
| Android launcher | `android/app/src/main/res/drawable/ic_launcher_{foreground,background,monochrome}.xml` |
| Notification icon | `android/app/src/main/res/drawable/ic_stat_aura.xml` |
| Web favicon, in-app mark | `frontend/public/favicon.svg`, `Logo` in `frontend/src/ui.tsx` |

**Why this one.** Three concepts were drawn and compared in circle and rounded-square masks at 120, 72, 48, 32, 24 and 16 px,
on light and dark. "Shelter" (a straight A) was clear but common. "Open a" did not read as a letter. The "sheltering arch"
stayed recognisable down to 16 px and was the warmest, so it was chosen. Nobody outside this project has judged it.

**Rules**

- Launcher: the foreground is scaled to 0.84, so that the mark stays inside the 66 dp safe circle of the 108 dp canvas.
- Smallest size: 16 px. Below 24 px use the one-colour mark.
- Keep clear space of at least the dot's diameter. Do not stretch it, recolour the arch or add effects.

**Colour** (`frontend/src/index.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--brand` | `#0f5c56` | Icon background |
| `--brand-light` | `#f4b740` | The dot only. Not for text |
| `--accent` | `#1f6f68` | Buttons, links |
| `--ink`, `--muted` | `#12302e`, `#5d6e6c` | Text |
| `--bg`, `--paper` | `#f6f4ef`, `#fffdf9` | Page, sheets |
| `--sos` | `#b3261e` | Only for urgent or destructive meaning |

Contrast was computed on 4 Nov 2026 (WCAG formula): body and muted text 4.88:1 or better, white on accent 5.95:1, white on
SOS 6.54:1, input borders (`--control-line`) at least 3:1.

**Type:** the system font (Roboto on Android, Noto Sans Telugu for Telugu). Body 18 px, notes 16 px, small notes 14 px; a few older labels are still 13 px. Line height 1.5.
**Spacing:** 16 px page gutter. Corners: 18 px for cards, 12 px for small parts. Aim for touch targets of at least 48 px; some older controls are still smaller.

**Name check (not legal advice).** A web search on 4 Nov 2026 found **Aura Health, Inc.** of San Francisco, which publishes the
meditation app "Aura: Meditation & Sleep, CBT". This is a similar name in a neighbouring field, so it is a real risk. A trademark
aggregator lists a US application by that company from June 2023 as abandoned; that was not checked against USPTO records.
No Indian health app with this name turned up, but no Indian trademark search was done. **Nothing here is legal clearance.
Have a trademark adviser check the name before any public launch.** The mark itself has had no conflict search.
