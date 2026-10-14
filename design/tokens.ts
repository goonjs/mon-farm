/**
 * mon-farm design tokens — the single source of truth.
 *
 * Consumed two ways:
 *   1. Directly, by React Native / react-native-web StyleSheet (Branch 2).
 *   2. Emitted to `docs/ux/tokens.css` by `scripts/emit-tokens.mjs`, which the
 *      HTML prototypes and screen designs @import.
 *
 * CI runs the emitter and `git diff --exit-code docs/ux/tokens.css`, so the two
 * consumers cannot drift. Change a token here, regenerate, commit both.
 *
 * ── Rules for editing this file ──────────────────────────────────────────────
 *
 * NUMBERS, NOT STRINGS, for anything dimensional. React Native needs `16`; CSS
 * needs `16px`. The emitter appends the unit. Storing `'16px'` here would force
 * a parseInt on the RN side, which is how token systems rot.
 *
 * NO IMPORTS, ONE FUNCTION. The exported `tokens` object must stay plain and
 * serializable so the emitter can walk it and so it costs nothing to import on
 * a low-end Android. The single exception is `colorFor`, a pure function from
 * a palette to the semantic colours, called once at load (E01-S17) — its
 * result is a plain object like everything else in `tokens`.
 *
 * TWO COLOUR LAYERS (E01-S17). `PALETTES` holds raw ramps; `colorFor` maps
 * them onto semantic roles; `ACTIVE_PALETTE` picks the palette. Screens read
 * roles only (`theme.color.<role>`), and no raw colour may appear in `src/`
 * (scripts/no-raw-colour.test.ts). Ramps are not emitted to tokens.css.
 *
 * ── Design thesis (FarmMate adoption, 2026-10-03) ───────────────────────────
 *
 * Visual language is FarmMate's (brand navy, brand green, warm yellow, soft
 * rounded cards — see docs/ux/design-system.md "FarmMate adoption"). Field
 * constraints still win wherever the two conflict:
 *
 *   - Every text/control pairing is CI-checked (scripts/check-contrast.mjs).
 *     FarmMate status hues that fail are kept at their brand HUE and darkened
 *     in lightness only; the original FarmMate value is noted beside each.
 *   - The public weighing numeral keeps its own near-black `numeral` token —
 *     the instrument rule survives inside the brand.
 *   - Colour is never the only carrier of state (NFR-4).
 *
 * Signal roles stay DISJOINT — no hue does double duty:
 *
 *     navy   → interactive. Touch this.        (FarmMate primary button)
 *     green  → counted / done / synced.        (never text on a control)
 *     red    → rejected / voided / conflict.
 *     amber  → flagged / pending. Recorded, non-blocking.
 *
 * Debt repayment (owner 2026-10-14) has its own colour-blind-safe pair, apart
 * from the sale and from the signals above: blue ↘ tapper → farm, vermillion
 * ↗ farm → tapper, grey ⇄ netting (no cash). Arrow + word always carry it.
 *
 * Brand accents (`brand*`) are decorative fills only — illustration, icon
 * tiles, chart bars. They never carry text and never carry state alone.
 *
 * NO WEB FONTS FETCHED AT RUNTIME. The app must be fully usable with no network
 * on first launch (NFR-1). FarmMate specifies Noto Sans Thai + Inter; whether
 * to BUNDLE them as app assets is an open owner question. Until answered,
 * system stacks only.
 */

// ── Colour, layer 1: palettes (raw ramps) ────────────────────────────────────
//
// Screens never read these. They are not emitted to tokens.css. Only
// `colorFor` below reads them, to fill the semantic roles screens do read.
//
// Two kinds of ramp (docs/stories/e01-s17-semantic-color-tokens.md):
//   - channel ramps — `neutral`, `ink`, `primary`: the palette's look; free to
//     change hue between palettes.
//   - hue ramps — `green`, `red`, `amber`, the six category hues and the two
//     debt hues (`blue`, `vermillion`): same hue
//     in every palette, lightness only, so a signal keeps its meaning.
//
// Steps are not evenly spaced: palette A has to land on the pre-existing
// values exactly. Nobody outside this file addresses a step by number.

/**
 * A — FarmMate (navy, brand green, warm yellow). The default.
 * Signal steps are FarmMate hues darkened in lightness only to clear AA:
 * green.700 ← success #00AA7D (2.98 → 6.18:1), red.700 ← error #E55353
 * (3.69 → 6.37:1), amber.800 ← warning #F2B233 (1.88 → 6.24:1).
 */
const farmmate = {
  neutral: {
    0: '#FFFFFF', 50: '#F7FAFC', 100: '#F1F3F5', 150: '#E4E9EE', 200: '#CBD4DC', 300: '#A3B1C0',
    400: '#7A8998', 500: '#6E7D8C', 600: '#52657A', 700: '#2E3B49', 800: '#1B2632', 850: '#13202E',
    900: '#0B1520', 950: '#060E17', 975: '#0A0B0C', 1000: '#000000',
  },
  ink: { 50: '#F4F5F6', 900: '#002858' },
  primary: { 50: '#EAF5FC', 200: '#A9C6F1', 300: '#8FB4EC', 900: '#002858', 925: '#002850', 950: '#0F2340' },
  green: { 50: '#E8F8F2', 400: '#48C090', 500: '#00AA7D', 600: '#008F6C', 700: '#006F52', 950: '#0B2A21' },
  red: { 50: '#FDECEC', 300: '#F0796A', 700: '#BB1C1C', 950: '#331310' },
  amber: { 25: '#FFF8E8', 50: '#FFF5D8', 300: '#FECB56', 800: '#815908', 900: '#2E2409', 950: '#221D10' },
  teal: { 50: '#E7FBFE', 400: '#14A5B5', 700: '#0F7985', 900: '#143134' },
  indigo: { 50: '#E9EAFC', 400: '#7981D8', 700: '#535DCD', 900: '#141634' },
  purple: { 50: '#F6E9FB', 400: '#B06CCE', 700: '#9940BF', 900: '#2A1434' },
  magenta: { 50: '#FCE8F3', 400: '#D65C9D', 700: '#BE2F7B', 900: '#341425' },
  orange: { 50: '#FEF1E7', 400: '#DD7220', 700: '#AA5718', 900: '#342214' },
  olive: { 50: '#FBFEE7', 400: '#93A51D', 700: '#667314', 900: '#2F3414' },
  // Debt hues (owner 2026-10-14): Okabe-Ito colour-blind-safe pair, kept at
  // their hue and searched in lightness only. blue ← #0072B2 (light text
  // 4.95 → 6.25:1 on surface), vermillion ← #D55E00 (3.69 → 6.30:1).
  blue: { 50: '#E3F3FD', 400: '#0AA7FF', 700: '#006299', 900: '#142834' },
  vermillion: { 50: '#FDEEE3', 400: '#FF760A', 700: '#994400', 900: '#342214' },
} as const;

/**
 * Every palette has exactly palette A's ramps and steps — no more, no fewer.
 * Drop a step from B and `npm run typecheck` goes red.
 */
export type PaletteShape = {
  readonly [R in keyof typeof farmmate]: { readonly [S in keyof (typeof farmmate)[R]]: string };
};

/**
 * B — "instrument": the pre-FarmMate colours (commit 7bdc160), the set already
 * tested in a sunlit yard. Near-black ink on neutral grey, canvas-blue action,
 * deeper signal hues. The way back if navy reads poorly in sun (§12.10 Q3).
 * One change from the original: neutral.400 #7E858C → #788087 (3:1 on sunk).
 */
const instrument = {
  neutral: {
    0: '#FFFFFF', 50: '#F2F3F4', 100: '#E4E6E8', 150: '#DDE0E3', 200: '#C4C8CC', 300: '#A0A6AC',
    400: '#788087', 500: '#6B7278', 600: '#55595E', 700: '#3A4046', 800: '#24282D', 850: '#1D2024',
    900: '#15171A', 950: '#0D0F11', 975: '#0A0B0C', 1000: '#000000',
  },
  ink: { 50: '#F4F5F6', 900: '#0A0B0C' },
  primary: { 50: '#E7EDF7', 200: '#9BBDF0', 300: '#7FA8E8', 900: '#17458C', 925: '#0F3068', 950: '#152239' },
  green: { 50: '#E0EFE6', 400: '#4FBF85', 500: '#2E9E6B', 600: '#1F7A50', 700: '#06542C', 950: '#0E2A1B' },
  red: { 50: '#FAE4E1', 300: '#F0796A', 700: '#9E2015', 950: '#331310' },
  amber: { 25: '#FBF4E6', 50: '#F7EBD6', 300: '#E0A03C', 800: '#6F4000', 900: '#2E2109', 950: '#221A0C' },
  teal: farmmate.teal,
  indigo: farmmate.indigo,
  purple: farmmate.purple,
  magenta: farmmate.magenta,
  orange: farmmate.orange,
  olive: farmmate.olive,
  blue: farmmate.blue,
  vermillion: farmmate.vermillion,
} satisfies PaletteShape;

export const PALETTES = { farmmate, instrument } as const;
export type PaletteKey = keyof typeof PALETTES;

/**
 * THE switch. Change this one value to re-colour the whole app, then run
 * `npm run tokens` and `npm run contrast` (contrast checks every palette).
 */
export const ACTIVE_PALETTE: PaletteKey = 'farmmate';

// ── Colour, layer 2: semantic roles ──────────────────────────────────────────
//
// The ONE role table, shared by every palette. Screens read only these names
// (`theme.color.<name>`). The names are a contract with other teams: add,
// never rename or remove without a story.

/**
 * Palette → `{ light, dark }` semantic colours. The only function in this
 * file; it is pure and runs once at load, so `tokens` stays a plain object.
 */
export function colorFor(p: PaletteShape) {
  const n = p.neutral;
  const g = p.green;
  const r = p.red;
  const a = p.amber;
  const pr = p.primary;
  return {
    /**
     * Light is the default and the field mode.
     *
     * Finding F-15: phone displays are additive, so dark-ink-on-white at
     * maximum brightness is the brightest, highest-contrast thing a phone can
     * put in direct sun — the exact condition this screen exists for.
     */
    light: {
      /** The public stage — flat, no shadow. */
      stage: n[0],
      /** Screen ground behind cards. */
      surface: n[50],
      /** Recessed: inputs, wells, segmented-control track, neutral chip. */
      surfaceSunk: n[100],
      /** Cards: with a `ruleFaint` hairline and `shadow.card`. */
      surfaceRaised: n[0],
      /** The public weighing numeral only. Own token so it can diverge from `ink`. */
      numeral: p.ink[900],
      /** Primary text. */
      ink: p.ink[900],
      /** Secondary text, units beside numbers. */
      inkSoft: n[600],
      /** Placeholders, chevrons — decorative only (below AA). */
      inkFaint: n[400],
      /** Text/glyph on a filled colour. */
      inkInverse: n[0],
      /** Top app bar ground and its title/icons. */
      appBar: n[50],
      appBarInk: p.ink[900],

      /** Decorative dividers only — carries no meaning. */
      rule: n[200],
      /** Card hairlines, row separators. */
      ruleFaint: n[150],
      /** Boundaries that define a control (WCAG 1.4.11, ≥3:1). */
      ruleStrong: n[400],
      /** Keyboard / switch-access focus ring. */
      focusRing: pr[900],

      /** navy — interactive: primary button, link, selected tab. */
      action: pr[900],
      actionHover: pr[925],
      /** Selected row / option wash. */
      actionSunk: pr[50],
      /** Disabled control fill (dashed `ruleStrong` border) and its still-AA label. */
      disabledFill: n[100],
      disabledInk: n[600],

      /** green — counted / done. Shape + word always carry it too. */
      accept: g[700],
      acceptSunk: g[50],
      /** red — rejected, voided, destructive, conflict. */
      reject: r[700],
      rejectSunk: r[50],
      /** amber — flagged / pending. Recorded, non-blocking. */
      warn: a[800],
      warnSunk: a[50],
      /** Sync status (SYNC-3) — aliases of the signal hues. */
      statusSynced: g[700],
      statusPending: a[800],
      statusConflict: r[700],

      /** Money in / out — always with + / − and a word. */
      moneyIn: g[700],
      moneyInSunk: g[50],
      moneyOut: p.ink[900],
      moneyOutSunk: n[100],

      /**
       * Debt repayment, shown apart from the sale (weight × price) on
       * settlement screens. Always with its arrow AND a word — never colour
       * alone. Not green/red (accept/reject) and not amber (warn).
       */
      /** blue ↘ — tapper → farm: the tapper repays debt. */
      debtIn: p.blue[700],
      debtInSunk: p.blue[50],
      /** vermillion ↗ — farm → tapper: the farm repays money it owes. */
      debtOut: p.vermillion[700],
      debtOutSunk: p.vermillion[50],
      /** grey ⇄ — netting; no cash moves. */
      debtNet: n[600],
      debtNetSunk: n[100],

      /** Group colours (farm / zone / tapper / chart series) — decoration, always named. */
      category1: p.teal[700],
      category1Sunk: p.teal[50],
      category2: p.indigo[700],
      category2Sunk: p.indigo[50],
      category3: p.purple[700],
      category3Sunk: p.purple[50],
      category4: p.magenta[700],
      category4Sunk: p.magenta[50],
      category5: p.orange[700],
      category5Sunk: p.orange[50],
      category6: p.olive[700],
      category6Sunk: p.olive[50],

      /** Brand accents — decorative fills only, never text, never sole state. */
      brand: g[500],
      /** Icon-only filled brand control (FAB): white glyph clears 3:1, not 4.5. */
      brandStrong: g[600],
      brandLight: g[400],
      brandYellow: a[300],
      /** Highlight card ground (e.g. owner's share) — not a warning. */
      brandCream: a[25],
      /** Full-stage feedback washes, driven by opacity at the call site. */
      flashAccept: g[700],
      flashReject: r[700],
      /** Sheet/dialog scrim colour — always with `opacity.scrim`. */
      scrim: p.ink[900],
    },

    /**
     * Dark is opt-in, for evening and indoor weighing at the ล้ง. FarmMate
     * defines no dark theme; these derive from the same hues.
     */
    dark: {
      stage: n[1000],
      surface: n[900],
      surfaceSunk: n[950],
      surfaceRaised: n[850],
      numeral: p.ink[50],
      ink: p.ink[50],
      inkSoft: n[300],
      inkFaint: n[500],
      inkInverse: n[975],
      appBar: n[900],
      appBarInk: p.ink[50],

      rule: n[700],
      ruleFaint: n[800],
      ruleStrong: n[400],
      focusRing: pr[300],

      action: pr[300],
      actionHover: pr[200],
      actionSunk: pr[950],
      disabledFill: n[950],
      disabledInk: n[300],

      accept: g[400],
      acceptSunk: g[950],
      reject: r[300],
      rejectSunk: r[950],
      warn: a[300],
      warnSunk: a[900],
      statusSynced: g[400],
      statusPending: a[300],
      statusConflict: r[300],

      moneyIn: g[400],
      moneyInSunk: g[950],
      moneyOut: p.ink[50],
      moneyOutSunk: n[950],

      debtIn: p.blue[400],
      debtInSunk: p.blue[900],
      debtOut: p.vermillion[400],
      debtOutSunk: p.vermillion[900],
      debtNet: n[300],
      debtNetSunk: n[800],

      category1: p.teal[400],
      category1Sunk: p.teal[900],
      category2: p.indigo[400],
      category2Sunk: p.indigo[900],
      category3: p.purple[400],
      category3Sunk: p.purple[900],
      category4: p.magenta[400],
      category4Sunk: p.magenta[900],
      category5: p.orange[400],
      category5Sunk: p.orange[900],
      category6: p.olive[400],
      category6Sunk: p.olive[900],

      brand: g[400],
      brandStrong: g[400],
      brandLight: g[600],
      brandYellow: a[300],
      brandCream: a[950],
      flashAccept: g[400],
      flashReject: r[300],
      scrim: n[1000],
    },
  };
}

export type SemanticColors = ReturnType<typeof colorFor>;

export const tokens = {
  /**
   * Semantic colours of the active palette — see `colorFor` above.
   * Light is the default and the field mode (F-15); dark is opt-in.
   */
  color: colorFor(PALETTES[ACTIVE_PALETTE]),

  /**
   * 4px base. Numeric keys are FarmMate's scale (emit as `--space-1` …
   * `--space-16`, matching FarmMate's CSS names). The named keys are the
   * pre-FarmMate aliases consumed by src/ — same grid, kept so nothing breaks.
   */
  space: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    10: 40,
    12: 48,
    16: 64,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 40,
  },

  /** FarmMate radius scale. (Pre-FarmMate: sm 4, md 8, lg 14.) */
  radius: {
    /** Chips, small tiles. */
    sm: 8,
    /** Buttons, inputs, icon tiles. */
    md: 12,
    /** Cards. */
    lg: 16,
    xl: 20,
    /** FarmMate `2xl`. Large sheets, primary pill-ish buttons. */
    xxl: 24,
    pill: 999,
  },

  border: {
    hair: 1,
    /** Focus rings and the device frame. */
    thick: 2,
    /** The hold ring's stroke. */
    ring: 10,
  },

  /**
   * FarmMate layout dimensions. FarmMate's `minimumTouchTarget` (44) is NOT
   * adopted — `target.min` (48) is the field floor and wins (NFR-4).
   */
  layout: {
    screenPaddingX: 16,
    topBarHeight: 56,
    bottomNavHeight: 72,
    /** = target.min. */
    buttonHeight: 48,
    inputHeight: 48,
    fabSize: 56,
  },

  /**
   * FarmMate shadows, split into numbers + an rgba colour so both RN
   * (shadowOffset/shadowRadius/shadowColor) and CSS
   * (`0 var(--shadow-card-y) var(--shadow-card-blur) var(--shadow-card-color)`)
   * can consume them. Applied to cards and floating controls together with a
   * `ruleFaint` hairline (owner §12.9 Q4, 2026-10-03), so an edge survives in
   * direct sun. Never on the public stage. To be A/B-compared in a preview.
   */
  shadow: {
    card: { y: 2, blur: 12, color: 'rgba(0, 40, 88, 0.06)' },
    floating: { y: 6, blur: 24, color: 'rgba(0, 40, 88, 0.10)' },
    button: { y: 3, blur: 10, color: 'rgba(0, 40, 88, 0.10)' },
  },

  font: {
    /**
     * System stacks only — see the no-web-fonts note at the top of this file.
     * FarmMate specifies "Noto Sans Thai" (Thai) + "Inter" (Latin); Noto Sans
     * Thai is already named here and is the Android system Thai face, so it
     * renders wherever the OS has it. Inter is NOT added until the owner
     * decides whether to bundle it. `sans` carries everything in the app. The serif in the docs shell is for
     * documents; the instrument does not use it.
     */
    family: {
      sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans Thai", sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, "Roboto Mono", monospace',
    },

    /**
     * Type scale, in pt/px. The public numeral is NOT here — it is sized as a
     * ratio of the viewport (see `publicNumeral` below).
     *
     * FarmMate scale first; the pre-FarmMate names follow as aliases mapped to
     * the nearest FarmMate step (src/ consumes them). FarmMate's own body
     * default is `bodyMd` 14 — field use prefers `bodyLg` 16 for primary
     * operator text in sun (owner question in design-system.md).
     */
    size: {
      displayXl: 32,
      displayLg: 28,
      headingXl: 24,
      headingLg: 20,
      headingMd: 18,
      headingSm: 16,
      bodyLg: 16,
      bodyMd: 14,
      bodySm: 13,
      caption: 12,
      /** Mono labels, tick marks. FarmMate micro. */
      micro: 11,
      /** Secondary operator text. = bodySm (unchanged). */
      small: 13,
      /** Default operator body. = bodyLg (was 15). */
      body: 16,
      /** Running totals, panel headings. = headingLg (was 19). */
      lead: 20,
      /** Pile/zone identity on a transition card. = headingXl (was 26). */
      title: 24,
      /**
       * Secondary large numerals: pile totals, settlement figures. Field
       * extension ABOVE FarmMate's largest step (32) — no FarmMate equivalent.
       */
      figure: 44,
    },

    weight: {
      regular: '400',
      medium: '500',
      /** FarmMate semibold — headings, card titles. */
      semibold: '600',
      bold: '700',
      /** The public numeral only. */
      black: '800',
    },

    tracking: {
      /** Large numerals tighten. */
      tight: -0.04,
      normal: 0,
      /** Mono labels open up. */
      wide: 0.09,
    },

    lineHeight: {
      /** Numerals — no leading, they are boxes. */
      solid: 1,
      snug: 1.25,
      body: 1.5,
    },
  },

  /**
   * The public numeral is sized as a FRACTION OF THE SHORT VIEWPORT DIMENSION,
   * never as a pt value.
   *
   * Finding F-9.7 is arithmetic about physical millimetres: comfortable reading
   * at 10 m needs ~83 mm of numeral height, the threshold is ~40 mm, and a 6.1"
   * phone can physically produce at most ~59 mm. The only way to spend the
   * device's full height is to express the numeral as a proportion of it.
   *
   * Do not "fix" these to fixed sizes. Doing so silently gives back the
   * millimetres that the entire cross-check depends on.
   */
  publicNumeral: {
    /**
     * Font size as a fraction of the STAGE's height (not the device's — chrome
     * takes roughly 106px, and the stage is what the glyph actually has).
     */
    stageHeightRatio: 0.94,
    /**
     * STARTING estimate for the advance width of one tabular digit, in ems.
     * Used to cap the size when a wide count would otherwise overflow: the real
     * size is min(height-driven, width-driven), so digit count never needs its
     * own hard-coded step. Per-digit steps were tried and quietly under-sized
     * three digits to 0.589 of the viewport — below the floor below.
     *
     * It is only the first guess, and it is deliberately not trusted after the
     * first paint. `sans` is a system stack, so which font actually renders the
     * numeral depends on the device: this value is right for the macOS system
     * face it was calibrated against and 5.8% low for the one CI's Linux
     * runner picks, which put a width-bound numeral 22px outside a 390px
     * portrait viewport. HoldStage re-derives the true advance from the glyph
     * it actually drew (see `advanceEm` there) — a constant cannot be correct
     * for every system stack, so it is measured rather than assumed.
     */
    digitWidthEm: 0.62,
    /**
     * Playwright asserts measured height ≥ this × DEVICE height, at both two
     * and three digits, on both reference and floor viewports.
     *
     * Valid WITHIN one device-density class (phone vs. phone), not across
     * classes. A ratio of logical points is only a stand-in for physical
     * millimetres if points-per-mm is roughly constant between the devices
     * being compared — true for phone vs. phone (~160 points/inch on both
     * historically), false for phone vs. tablet (an iPad's points map to
     * roughly 20% more physical mm each than an iPhone's do, since tablets
     * show more content rather than scaling content up). Measured directly:
     * a tablet in portrait at three digits computes to ratio ≈0.54 here —
     * below this floor — while working the same geometry in real millimetres
     * puts the glyph at ~85mm, past even the "comfortable" 83mm target. The
     * ratio undersells the tablet; `tabletBreakpointPx` below is what
     * corrects for it, rather than papering over the gap by lowering this
     * floor and weakening what it verifies for phones.
     */
    minHeightRatio: 0.62,
    /**
     * Short-dimension CSS px above which a device is treated as tablet-class
     * for the rotate-hint decision, regardless of `minHeightRatio`. 600 is
     * Material Design's own phone/tablet breakpoint — a defensible, already
     * externally-documented line, not a number invented for this app.
     */
    tabletBreakpointPx: 600,
  },

  /**
   * The hold indicator: a stroke that travels the stage's perimeter.
   *
   * It was a centred dial first. A dial competes with the numeral for width —
   * at three digits they collide — and F-9.7 says every millimetre of numeral
   * is load-bearing. The perimeter costs the numeral nothing, and it is the
   * longest path available on the screen, so progress stays visible from the
   * public distance where a small centred ring would not be.
   */
  bezel: {
    /** Stroke width. Thick enough to read at ~10 m. */
    width: 12,
    /** Inset from the stage edge. */
    inset: 6,
  },

  duration: {
    /** Accept/reject flash. Long enough to register, short enough not to gate. */
    flash: 180,
    /** Ring sweep and the hold itself. The anti-mistap budget (F-6). */
    hold: 1500,
    /** Undo-last stays available this long after a basket lands (F-12). */
    undoWindow: 8000,
    toast: 2400,
    /** Tab and panel transitions. */
    move: 160,
  },

  /**
   * Minimum touch targets, in pt. NFR-4: one-handed, gloved or wet hands, in a
   * yard. Above the 44pt platform floor deliberately.
   */
  target: {
    min: 48,
    comfortable: 56,
  },

  /**
   * Reference viewports. Playwright projects mirror these.
   *
   * Orientation is no longer locked (S19) — portrait is genuinely better for
   * row-heavy screens (setup, log, settlement), and only one screen has a real
   * physical constraint against it: see `publicNumeral` above and
   * `docs/ux/design-system.md` §9/§4 for the millimetre arithmetic. That
   * constraint is what `minHeightRatio` measures at runtime, not a hardcoded
   * "portrait phones are bad" rule — a phone in portrait is fine up to two
   * digits, and a tablet is fine in portrait at any digit count in this MVP's
   * range.
   */
  viewport: {
    /** Modern 6.1" phone, landscape. */
    reference: { width: 844, height: 390 },
    /** The NFR-4 low-end Android floor. Layout must hold here. */
    floor: { width: 740, height: 360 },
    /** Same phone, portrait. The binding case for the numeral floor at 3+ digits. */
    portrait: { width: 390, height: 844 },
    /** Common ~10.9" tablet, portrait. Clears the numeral floor at any digit count in range. */
    tabletPortrait: { width: 820, height: 1180 },
    /** Same tablet, landscape — smoke-checked only; shares the phone landscape layout. */
    tabletLandscape: { width: 1180, height: 820 },
  },

  /** Opacity steps, so "slightly faded" is a decision made once. */
  opacity: {
    disabled: 0.38,
    muted: 0.62,
    scrim: 0.72,
    flash: 0.85,
  },

  /**
   * Android elevation levels paired with `shadow` above (owner §12.9 Q4):
   * soft FarmMate shadow + `ruleFaint` hairline on cards; nothing on the
   * public stage. RN and web render shadows differently — verify both, and
   * compare against flat (+hairline) in an A/B preview before locking.
   */
  elevation: {
    none: 0,
    card: 2,
    overlay: 6,
  },

  /**
   * User text-size setting (owner §12.9 Q5): S / M / L = primary body text of
   * 14 / 16 / 18. Every other type size scales by the same factor. The public
   * numeral is viewport-sized and does not scale.
   */
  textScale: {
    s: 0.875,
    m: 1,
    l: 1.125,
  },
} as const;

export type Tokens = typeof tokens;
export type ColorScheme = keyof SemanticColors;
export type ColorName = keyof SemanticColors['light'];

export default tokens;
