// Pure helpers for the profile screens (no React Native imports, so tests can use them).

/** Message for a failed profile update (the name; the phone is changed by verifying a new number). */
export function updateProfileErrorMessage(_error: { code?: string; message?: string } | null): string {
  return 'Could not save your changes. Please try again.';
}
