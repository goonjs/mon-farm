/**
 * Jest's globals (describe/it/expect/jest) for the component-test tier.
 *
 * A reference rather than tsconfig's `types` array: setting `types` would
 * restrict ambient types to only what is listed and drop Expo's own.
 *
 * The Vitest tier does not need this — src/core tests import describe/it/expect
 * explicitly, which is also what keeps the two runners from colliding.
 */
/// <reference types="jest" />
