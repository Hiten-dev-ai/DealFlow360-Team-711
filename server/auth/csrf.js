import { createHash, timingSafeEqual } from 'node:crypto';

export function csrfTokenForSession(sessionToken) {
  return createHash('sha256').update(`dealflow360:csrf:${sessionToken}`).digest('base64url');
}

export function csrfMatches(sessionToken, suppliedToken) {
  if (!sessionToken || !suppliedToken) return false;
  const expected = Buffer.from(csrfTokenForSession(sessionToken));
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
