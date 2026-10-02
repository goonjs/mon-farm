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
 * NO IMPORTS, NO FUNCTIONS. This object must stay plain and serializable so the
 * emitter can walk it and so it costs nothing to import on a low-end Android.
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
 * Brand accents (`brand*`) are decorative fills only — illustration, icon
 * tiles, chart bars. They never carry text and never carry state alone.
 *
 * NO WEB FONTS FETCHED AT RUNTIME. The app must be fully usable with no network
 * on first launch (NFR-1). FarmMate specifies Noto Sans Thai + Inter; whether
 * to BUNDLE them as app assets is an open owner question. Until answered,
 * system stacks only.
 */

export const tokens = {
  /**
   * Light is the default and the field mode.
   *
   * Finding F-15: phone displays are additive, so dark-ink-on-white at maximum
   * brightness is the brightest, highest-contrast thing a phone can put in
   * direct sun — which is the exact condition this screen exists for. The
   * battery cost is real and flagged in F-15 as needing a field measurement.
   *
   * Dark exists for evening and indoor weighing at the ล้ง, and is opt-in.
   * FarmMate defines no dark theme; the dark values below are derived from the
   * FarmMate hues and are this repo's own.
   */
  color: {
    light: {
      /** The public stage. Pure white (FarmMate surfaceBackground). */
      stage: '#FFFFFF',
      /** Screen ground behind cards. FarmMate surfaceSubtle. */
      surface: '#F7FAFC',
      /** Recessed: inputs, wells, segmented-control track. FarmMate surfaceGray. */
      surfaceSunk: '#F1F3F5',
      /** Raised: cards over surface. FarmMate surfaceCard. */
      surfaceRaised: '#FFFFFF',

      /**
       * The public weighing numeral. Owner decision 2026-10-03 (§12.9 Q3):
       * follow FarmMate first — navy like all text (14.54:1 on stage, AAA).
       * Kept as its own token so it can return to near-black (#0A0B0C) if the
       * field test shows a problem, without touching `ink`.
       */
      numeral: '#002858',
      /** Primary text. FarmMate textPrimary (brand navy). */
      ink: '#002858',
      /** Secondary text. FarmMate textSecondary. */
      inkSoft: '#52657A',
      /** Tertiary — placeholders, disabled. FarmMate textMuted. Below AA; decorative only. */
      inkFaint: '#7A8998',
      /** Text/glyph on a filled signal colour. */
      inkInverse: '#FFFFFF',

      /** Decorative dividers only. FarmMate borderStrong. Below 3:1 — carries no meaning. */
      rule: '#CBD4DC',
      /** FarmMate borderDefault. Card hairlines. */
      ruleFaint: '#E4E9EE',
      /**
       * Boundaries that define a control: input borders, unfilled button
       * outlines. WCAG 1.4.11 requires 3:1 and no FarmMate border clears it, so
       * this borrows FarmMate textMuted (3.42:1 on surface).
       */
      ruleStrong: '#7A8998',

      /** navy — interactive. FarmMate brandNavy: primary buttons, active tab, links. */
      action: '#002858',
      /** FarmMate brandNavyDeep. */
      actionHover: '#002850',
      /** FarmMate surfaceBlue. Selected rows, secondary-button wash. */
      actionSunk: '#EAF5FC',

      /** green — counted / done. FarmMate success #00AA7D, darkened (2.98:1 → 6.18:1). */
      accept: '#006F52',
      /** FarmMate surfaceGreen. */
      acceptSunk: '#E8F8F2',

      /** red — rejected, voided, destructive, conflict. FarmMate error #E55353, darkened (3.69:1 → 6.37:1). */
      reject: '#BB1C1C',
      /** Derived tint of the error hue — FarmMate has no red surface. */
      rejectSunk: '#FDECEC',

      /** amber — flagged / pending. FarmMate warning #F2B233, darkened (1.88:1 → 6.24:1). */
      warn: '#815908',
      /** FarmMate surfaceYellow / brandYellowSoft. */
      warnSunk: '#FFF5D8',

      /** Sync status (SYNC-3). Aliases of the signal hues — shape + word carry it too. */
      statusSynced: '#006F52',
      statusPending: '#815908',
      statusConflict: '#BB1C1C',

      /** Brand accents — decorative fills only, never text, never sole state. */
      brand: '#00AA7D',
      /** FarmMate brandGreenDark. Filled brand controls (e.g. FAB) — white glyph clears 3:1 (4.08). */
      brandStrong: '#008F6C',
      /** FarmMate brandYellow. Illustration, chart series. */
      brandYellow: '#FECB56',
      /** FarmMate brandCream. Warm highlight ground. */
      brandCream: '#FFF8E8',

      /** Full-stage feedback washes, driven by opacity at the call site. */
      flashAccept: '#006F52',
      flashReject: '#BB1C1C',
    },

    dark: {
      stage: '#000000',
      surface: '#0B1520',
      surfaceSunk: '#060E17',
      surfaceRaised: '#13202E',

      numeral: '#F4F5F6',
      ink: '#F4F5F6',
      inkSoft: '#A3B1C0',
      inkFaint: '#6E7D8C',
      inkInverse: '#0A0B0C',

      rule: '#2E3B49',
      ruleFaint: '#1B2632',
      ruleStrong: '#7D8B99',

      action: '#8FB4EC',
      actionHover: '#A9C6F1',
      actionSunk: '#0F2340',

      accept: '#48C090',
      acceptSunk: '#0B2A21',

      reject: '#F0796A',
      rejectSunk: '#331310',

      warn: '#FECB56',
      warnSunk: '#2E2409',

      statusSynced: '#48C090',
      statusPending: '#FECB56',
      statusConflict: '#F0796A',

      brand: '#48C090',
      brandStrong: '#48C090',
      brandYellow: '#FECB56',
      brandCream: '#221D10',

      flashAccept: '#48C090',
      flashReject: '#F0796A',
    },
  },

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
export type ColorScheme = keyof Tokens['color'];
export type ColorName = keyof Tokens['color']['light'];

export default tokens;
