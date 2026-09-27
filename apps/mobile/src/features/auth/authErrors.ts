// Maps Supabase Auth errors to user-facing messages. Never shows raw server text for known cases,
// and never reveals whether an email exists on sign-in.

interface AuthErrorLike {
  code?: string | undefined;
  message?: string | undefined;
  status?: number | undefined;
  name?: string | undefined;
}

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'invalid_credentials':
      return 'Email or password is incorrect.';
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try logging in.';
    case 'weak_password':
      return 'Please choose a stronger password.';
    case 'email_address_invalid':
      return 'Enter a valid email address.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'signup_disabled':
      return 'Sign-up is currently disabled.';
    case 'email_not_confirmed':
      return 'Please confirm your email address first.';
    default:
      break;
  }
  if (error.name === 'AuthRetryableFetchError' || /network request failed|failed to fetch|fetch failed/i.test(error.message ?? '')) {
    return "Can't reach SawariBuddy. Check your connection and try again.";
  }
  return 'Something went wrong. Please try again.';
}
