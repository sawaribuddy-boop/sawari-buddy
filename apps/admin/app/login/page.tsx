'use client';

import { useActionState } from 'react';
import { login } from './actions';

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, null);

  return (
    <main style={styles.main}>
      <form action={formAction} style={styles.form}>
        <h1 style={styles.title}>SawariBuddy Admin</h1>

        {error && <p style={styles.error}>{error}</p>}

        <label style={styles.label}>
          Email
          <input name="email" type="email" required autoComplete="email" style={styles.input} />
        </label>

        <label style={styles.label}>
          Password
          <input name="password" type="password" required autoComplete="current-password" style={styles.input} />
        </label>

        <button type="submit" disabled={pending} style={styles.button}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

const styles = {
  main: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#f5f5f5',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    width: 360,
    padding: 32,
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  title: {
    margin: 0,
    fontSize: 24,
    textAlign: 'center' as const,
  },
  error: {
    margin: 0,
    padding: '8px 12px',
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: 6,
    fontSize: 14,
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 14,
    outline: 'none',
  },
  button: {
    padding: '10px 16px',
    background: '#1a7a3a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
} satisfies Record<string, React.CSSProperties>;
