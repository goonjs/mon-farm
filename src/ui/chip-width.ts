/**
 * The narrowest a word chip may be (owner, decision page q1 = ค, 2026-11-08).
 *
 * A chip is always at least 48 tall, the touch floor (`target.min`). Held to a
 * width of 48 too, a short name ("นัด") becomes a circle with a word inside,
 * which the owner ruled out on 2026-11-06 (no round word buttons). At 64 it
 * stays a pill that reads as a choice, and the target is wider than the floor.
 * Longer labels grow past it as before.
 */
export const CHIP_MIN_WIDTH = 64;
