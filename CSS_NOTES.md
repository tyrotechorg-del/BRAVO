# CSS — State Notes

## What I did

Bundled all **30 CSS files** from your existing repo into the
proper `frontend/public/css/` directory in this zip. Two
misplaced files (`frontend/public/js/pages/downloads.css` and
`song.css`) have been moved into the correct
`frontend/public/css/pages/` location.

## What I did NOT do

**No CSS audit happened across the 16 batches.** Every batch
README explicitly listed CSS as out of scope, and that didn't
change here. The files in this zip are the same files from
your repo — only relocated, not rewritten.

If you want a real CSS pass (theme cleanup, z-index hierarchy,
mobile breakpoint audit, dead-code removal, switching to CSS
variables consistently), that's a separate project. Probably
2,000–3,000 lines of work that I'd quote as its own batch.

## Quick smell test (5-minute scan, not an audit)

I did look at the files just enough to flag the obvious smells.
Here's what I saw:

### 1. `!important` is being used as a hammer

**158 `!important` declarations total** across the CSS:

| File | Count |
|------|-------|
| `responsive.css` | 63 |
| `mobile.css` | 45 |
| `pages/home.css` | 34 |
| `main.css` | 14 |
| `touch-fixes.css` | 1 |
| `components/player.css` | 1 |

When you see `!important` clustered in `responsive.css` and
`mobile.css`, that's a signature of "the desktop styles win
the cascade unless I force them not to." The proper fix is to
write the breakpoint rules with equal-or-higher specificity to
the rules they're overriding — not to slap `!important` on
everything.

This isn't actively broken, but it makes the CSS painful to
maintain. Every new style you write has to consider "do I need
`!important` to win against the existing rules?".

### 2. `style.css` and `main.css` both exist and DIFFER

```
main.css   1,058 lines
style.css  2,345 lines
```

The `index.html` I shipped loads `main.css`. `style.css`
isn't referenced anywhere in the new HTML — so it's either
dead code OR loaded by something I missed. Check your existing
HTML for `<link href="css/style.css">` references. If none
exist, `style.css` is dead and can be deleted.

**I didn't delete it** because it's not 100% certain. If you
confirm nothing references it, add it to the dead-code list.

### 3. Z-index hierarchy is ad-hoc

Z-index values currently in use:

```
1000  navbar, player, generic
1001  navbar nav-menu (mobile open)
1002  navbar dropdown (mobile)
1999  touch-fixes audio-player
2000  modal backdrop
2001  modal content
9999  touch-fixes some override
10000 style.css (highest)
```

There's no documented hierarchy. Best practice would be a CSS
variable layer scheme:

```css
:root {
    --z-base:    0;
    --z-dropdown: 100;
    --z-sticky:  200;
    --z-fixed:   300;
    --z-navbar:  400;
    --z-player:  450;
    --z-modal:   500;
    --z-toast:   600;
    --z-tooltip: 700;
}
```

…and then every `z-index` references one of those. Currently
every developer who adds a modal or popover has to guess. The
fact that `style.css` reaches `10000` suggests at least one of
those guesses went too far.

### 4. Mobile fixes via overrides instead of proper breakpoints

`responsive.css` (1,200+ lines) and `mobile.css` (separate
file) and `touch-fixes.css` all do similar things — override
desktop styles with `!important` and a `@media` query.

Cleaner pattern: write each component's CSS mobile-first
(narrow viewport defaults), then `@media (min-width: ...)` to
add desktop refinements. Eliminates the need for an `!important`
arms race.

### 5. Themes look OK

`themes/dark.css` and `themes/light.css` both define 15
variables each — same names, different values. That's the
right structure. The Settings page in batch 12 toggles the
`light-theme` class on `<body>`, and the themes pick up via
the variable difference. This part is fine.

### 6. `frontend/force/css/style.css` is part of the dead tree

The 16th CSS file from your repo is in `frontend/force/css/`.
That entire `frontend/force/` directory is dead since pre-batch-1
(pre-rewrite legacy HTML/JS mirror of the app) and gets removed
by `batch 15 apply-deletes.sh`.

## What I'd recommend (if you ever do a CSS pass)

In priority order:

1. **Pick one of `style.css` or `main.css` and delete the other.**
   Smallest change, immediate clarity win.
2. **Establish a z-index hierarchy** via CSS variables, refactor
   the existing `z-index:` declarations to use them.
3. **Replace `!important` with proper specificity.** This is the
   biggest win for maintainability. Probably 4 hours of focused
   work. Use a CSS specificity calculator to ensure replacements
   actually win the cascade.
4. **Consolidate** `responsive.css` + `mobile.css` + `touch-fixes.css`
   into per-component media queries. Big file → many small,
   colocated rules.
5. **Test on actual phones.** The desktop browser's responsive
   mode lies about iOS Safari quirks.

But again: none of this is required to ship. The site renders
on your current CSS. These are quality-of-life improvements,
not bug fixes.

## How CSS interacts with the hardened JS

A few CSS class names changed in the JS rewrites:

- **`PaymentFlowModal`** uses `.payment-flow-modal`, `.spinner`,
  `.modal-footer` classes — your Modal component CSS should
  already cover the structural ones. The inner content uses
  inline styles for the gradient backgrounds and centering, so
  no new CSS file is needed.
- **`WalletPage`** uses inline styles for the balance card
  (purple gradient). No new CSS file needed.
- **`SubscriptionPage`** plan cards use inline styles. No new
  CSS file needed.
- **`PaymentHistoryPage`** uses the existing `.data-table` /
  `.status-badge` classes you already have for the admin
  tables.

In short: the new pages from batches 14-16 don't require any
new CSS. They reuse existing classes or use inline styles for
their distinctive bits.

If a page renders but looks wrong, it's likely missing one of:

- `.btn-primary`, `.btn-secondary`, `.btn-outline`, `.btn-danger`,
  `.btn-success`, `.btn-warning`, `.btn-light` button classes
- `.empty-state`, `.loading-container`, `.spinner` utility classes
- `.modal`, `.modal-content`, `.modal-footer` modal classes
- `.data-table` admin table class
- `.form-group`, `.form-label` form classes
- `.dashboard-stats`, `.stat-card`, `.stat-card-sm` stat classes
- `.toast-container`, `.toast` toast classes

If you grep your existing CSS for those class names and find
them, you're set. If any are missing, that's a CSS file that
needs to be added — probably from a place where the original
JS hardcoded styles inline.
