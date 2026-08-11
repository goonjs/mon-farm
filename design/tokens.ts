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
 * ── Design thesis ────────────────────────────────────────────────────────────
 *
 * This is an instrument, not a document. Two parties stand around a scale and
 * watch a number they both have to trust. So: achromatic ground, numerals
 * dominant, and colour reserved entirely for state.
 *
 * The four signal hues are DISJOINT — no hue does double duty:
 *
 *     blue   → interactive. Touch this.        (never a state)
 *     green  → counted. This basket is in.     (never a control)
 *     red    → rejected / voided. Not counted.
 *     amber  → flagged. Recorded, non-blocking.
 *
 * That separation is what lets finding F-16's non-colour encodings (shape,
 * icon, position, motion) layer cleanly on top: colour and shape agree instead
 * of competing. Blue is drawn from the tarpaulins in every Thai farm yard; it
 * is the one hue in the working environment that never means "good" or "bad".
 *
 * NO WEB FONTS ANYWHERE. The app must be fully usable with no network on first
 * launch (NFR-1). A font that fails to load is a count nobody can read. System
 * stacks only — this is a hard constraint, not a preference.
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
   */
  color: {
    light: {
      /** The public stage. Pure white — maximum luminance, nothing warmer. */
      stage: '#FFFFFF',
      /** Operator panels. Very slightly cool so it recedes behind the stage. */
      surface: '#F2F3F4',
      /** Recessed: inputs, code, wells. */
      surfaceSunk: '#E4E6E8',
      /** Raised: cards over surface. */
      surfaceRaised: '#FFFFFF',

      /** The count, and any text that must survive glare. */
      ink: '#0A0B0C',
      /** Secondary text, mono labels. */
      inkSoft: '#55595E',
      /** Tertiary — placeholders, disabled. Fails AA on purpose; decorative only. */
      inkFaint: '#8A9096',
      /** Text on a filled signal colour. */
      inkInverse: '#FFFFFF',

      /** Decorative dividers only. Deliberately below 3:1 — carries no meaning. */
      rule: '#C4C8CC',
      ruleFaint: '#DDE0E3',
      /**
       * Boundaries that define a control: input borders, unfilled button
       * outlines, the dial track. WCAG 1.4.11 requires 3:1 for these, and
       * `rule` does not clear it. Reach for this whenever the line is the only
       * thing telling someone where a target begins.
       */
      ruleStrong: '#7E858C',

      /** blue — interactive. Buttons, links, focus, the active tab. */
      action: '#17458C',
      actionHover: '#0F3068',
      actionSunk: '#E7EDF7',

      /** green — counted. The hold ring fill, accepted-basket log rows. */
      accept: '#06542C',
      acceptSunk: '#E0EFE6',

      /** red — rejected, voided, destructive. */
      reject: '#9E2015',
      rejectSunk: '#FAE4E1',

      /** amber — flagged. Recorded and visible, never blocking. */
      warn: '#6F4000',
      warnSunk: '#F7EBD6',

      /** Full-stage feedback washes, driven by opacity at the call site. */
      flashAccept: '#06542C',
      flashReject: '#9E2015',
    },

    dark: {
      stage: '#000000',
      surface: '#15171A',
      surfaceSunk: '#0D0F11',
      surfaceRaised: '#1D2024',

      ink: '#F4F5F6',
      inkSoft: '#A0A6AC',
      inkFaint: '#6B7278',
      inkInverse: '#0A0B0C',

      rule: '#3A4046',
      ruleFaint: '#24282D',
      ruleStrong: '#79818A',

      action: '#7FA8E8',
      actionHover: '#9BBDF0',
      actionSunk: '#152239',

      accept: '#4FBF85',
      acceptSunk: '#0E2A1B',

      reject: '#F0796A',
      rejectSunk: '#331310',

      warn: '#E0A03C',
      warnSunk: '#2E2109',

      flashAccept: '#4FBF85',
      flashReject: '#F0796A',
    },
  },

  /** 4px base. Landscape phones are short — vertical rhythm has to stay tight. */
  space: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 40,
  },

  radius: {
    /** Chips, pills' smaller cousin. */
    sm: 4,
    /** Buttons, panels. */
    md: 8,
    /** Cards, the device frame. */
    lg: 14,
    pill: 999,
  },

  border: {
    hair: 1,
    /** Focus rings and the device frame. */
    thick: 2,
    /** The hold ring's stroke. */
    ring: 10,
  },

  font: {
    /**
     * System stacks only — see the no-web-fonts note at the top of this file.
     * `sans` carries everything in the app. The serif in the docs shell is for
     * documents; the instrument does not use it.
     */
    family: {
      sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans Thai", sans-serif',
      mono: 'ui-monospace, SFMono-Regular, Menlo, "Roboto Mono", monospace',
    },

    /**
     * Operator-register sizes, in pt/px. The public numeral is NOT here — it is
     * sized as a ratio of the viewport (see `publicNumeral` below).
     */
    size: {
      /** Mono labels, tick marks. */
      micro: 11,
      /** Secondary operator text. */
      small: 13,
      /** Default operator body. */
      body: 15,
      /** Emphasised operator text — running totals, panel headings. */
      lead: 19,
      /** Pile/zone identity on a transition card. */
      title: 26,
      /** Secondary large numerals: pile totals, settlement figures. */
      figure: 44,
    },

    weight: {
      regular: '400',
      medium: '500',
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
   * Elevation is expressed as a rule + ground change, not a shadow.
   * react-native-web and native diverge on shadow rendering, and the
   * high-contrast direction wants flat surfaces anyway. Kept as a token so the
   * decision is visible rather than merely absent.
   */
  elevation: {
    none: 0,
    card: 0,
    overlay: 0,
  },
} as const;

export type Tokens = typeof tokens;
export type ColorScheme = keyof Tokens['color'];
export type ColorName = keyof Tokens['color']['light'];

export default tokens;
