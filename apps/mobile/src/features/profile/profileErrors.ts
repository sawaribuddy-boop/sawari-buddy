// Pure helpers for the profile screens (no React Native imports, so tests can use them).

/** Message for a failed profile update. 23505 = unique violation on profiles.phone. */
export function updateProfileErrorMessage(error: { code?: string; message?: string } | null): string {
  if (error?.code === '23505') return 'This mobile number is already used by another account.';
  return 'Could not save your changes. Please try again.';
}
