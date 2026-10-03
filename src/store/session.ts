import type { UserId } from '../core/types';

/**
 * The user id stamped on events until Google login exists (E02-S01).
 *
 * D-23 means every event has a real user, so `actor.userId` is not optional;
 * login is the story that supplies one. Until then this one constant stands
 * in, and E02-S01 replaces it with the Firebase Auth uid from the session
 * (and makes recording impossible without it). Nothing from before that
 * point is synced or migrated, so the placeholder never leaves the device.
 */
export const PRE_LOGIN_USER_ID: UserId = 'pre-login';
