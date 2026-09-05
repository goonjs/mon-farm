# Mobile checklist

Complete this for any story that adds or changes a screen, a control, or a
figure that is rendered. It sits alongside
`docs/checklists/definition-of-done.md`, not instead of it.

Everything here was learned from a defect that actually shipped. The
2026-09-05 audit (`docs/ux/mobile-audit.md`) is the evidence; the rules are
short because each one is paid for.

## The rule behind the rules

The app is used **one-handed, outdoors, on a phone, sometimes with wet
hands**, by someone who is standing next to the person whose money is on the
screen. A control that is merely *present* is not usable, and a number that
is merely *rendered* is not read. Both have to be checked as a person would
meet them, not as the DOM reports them.

## Reachability

- [ ] **Nothing interactive is under 44×44 CSS px.** Not a floor to aim
      above — a floor. Where a compact visual is genuinely required (a tab,
      a status pill), pad the *hit target* with `hitSlop` rather than
      shrinking the tappable area to match the visual.
- [ ] **No small interactive element sits flush against a large one.** A
      32px-tall tab strip touching a `flex: 1` pressable is how the counter's
      tabs became untappable: at 360×640 the browser's own touch hit-test
      resolved a tap inside the tab's box to the numeral beneath it. Give it
      a real gap, or explicitly review the hit target.
- [ ] **Every primary action is reachable without discovering a scroll** at
      the narrowest supported width, on the simplest possible instance of
      that screen.

## Tapping is not clicking

- [ ] **A `.click()` proves nothing about touch.** Playwright's default
      click and `fireEvent.click` exercise mouse handling only. Anything
      reachable by mouse but not by finger is invisible to that test — which
      is exactly how the tab defect passed a green suite for weeks.
- [ ] On any project marked `isMobile` / `hasTouch`, reachability is asserted
      with `page.touchscreen.tap()` or locator `.tap()`.
- [ ] **Assert the consequence, not the element.** `toBeVisible()` says a box
      is non-empty. Assert that the tab actually switched, the panel actually
      opened, the event was actually written.

## Numbers must not clip

- [ ] **Every figure is tested at the size it will really reach**, not the
      size in today's fixtures. A seven-figure owner total needed 347px and
      got 116 — and no fixture in the repo had ever gone past six figures,
      which is why nobody saw it. Money and weight rendered on one line need
      a fixture at 1.5–2× the widest realistic value for a big season.
- [ ] **`adjustsFontSizeToFit` does nothing on web.** Never rely on it alone
      for a number that must not clip. Measure and set the size (the
      `HoldStage` `advanceEm` pattern), or lay it out so it never needs to
      shrink.
- [ ] **A truncated figure is a blocking bug**, not a cosmetic one. This app
      exists so two people can agree a number out loud; `฿ 1...` is worse
      than showing nothing, because it looks like an answer.

## Layout

- [ ] **`document.documentElement.scrollWidth <= clientWidth`** at every
      supported viewport. Content that overflows horizontally inside a
      vertical `ScrollView` is unreachable, not merely ugly.
- [ ] **No fixed side-by-side layout without a portrait answer.** Any
      `flexDirection: 'row'` that assumes landscape width must say, in its
      story, what it does under 400px — stack, scroll, or shrink — and be
      screenshotted at 360×640 proving it.
- [ ] **Portrait is a supported orientation** (owner decision, 2026-09-04),
      including on the counter. It is not an "orientation hint" special case
      any more.

## Thai text

- [ ] Fixtures carry **real Thai**, including at least one long worker, zone
      or reason string. Stacked vowels and tone marks clip and wrap in ways
      Latin placeholder text never reveals.
- [ ] Labels and placeholders are checked for clipping at the narrowest
      supported width, not only in the language they were authored in.

## Viewports to check

At minimum, and portrait means portrait:

| | Why it is in the list |
| --- | --- |
| **360×640** | The commonest small Android. Where the tab defect reproduces, and where nothing else was ever tested. |
| **390×844** | iPhone-class portrait. |
| **844×390** | The landscape the app was designed for. |
| **740×360** | The NFR-4 low-end floor. |
| **820×1180** | Tablet portrait — and not a safe harbour: the settlement total clipped here too. |
