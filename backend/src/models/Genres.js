// ============================================================
// Canonical genre list (Title Case)
// ============================================================
//
// The original Song/Artist/Album schemas had genre enums that included
// BOTH 'Hip Hop' AND 'hip hop', 'Reggae' AND 'reggae' — a copy-paste
// "fix" for a case-sensitivity bug that created two distinct values
// for the same logical genre. A query for `genre: 'Hip Hop'` wouldn't
// match docs with `'hip hop'`.
//
// The fix:
//   - Schemas now reference ONLY this canonical list.
//   - A pre-save normalizer (in each model) converts incoming values
//     to canonical form (case-insensitive lookup). Anything outside
//     the canonical list is rejected by the enum validator.
//
// If you ever add a new genre, add it here and migrate existing docs
// in the DB if necessary.

export const GENRES = [
  'Afrobeat',
  'Hip Hop',
  'R&B',
  'Dancehall',
  'Reggae',
  'Gospel',
  'Traditional',
  'Amapiano',
  'Cuundu',
  'Soul',
  'Rock',
  'Kalindula',
  'Other',
];

/**
 * Case-insensitively map an incoming genre string to its canonical form.
 * Returns the canonical version if matched, or null if not found.
 *
 *   normalizeGenre('hip hop')  → 'Hip Hop'
 *   normalizeGenre('HIP HOP')  → 'Hip Hop'
 *   normalizeGenre('jazz')     → null
 */
export function normalizeGenre(genre) {
  if (typeof genre !== 'string') return null;
  const lower = genre.toLowerCase().trim();
  return GENRES.find((g) => g.toLowerCase() === lower) || null;
}