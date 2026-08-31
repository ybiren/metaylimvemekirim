/**
 * Whether a dialog should open as a full-screen sheet rather than a card.
 *
 * Deliberately not `window.innerWidth < 600`. A phone with "Desktop site"
 * switched on reports a viewport around 980px, so a width-only test picks the
 * desktop card and sizes it against a screen the device does not have - a
 * customer's chat window opened with the composer row off the right edge.
 * `pointer: coarse` describes the input device rather than the viewport, so it
 * stays true on a phone whatever width is being reported. Capped at 1024px so
 * a desktop browser never matches it.
 */
export function isMobileLayout(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(
    '(max-width: 600px), (pointer: coarse) and (max-width: 1024px)'
  ).matches;
}
