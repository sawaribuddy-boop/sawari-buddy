'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { signOut } from './actions';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/stops', label: 'Stops' },
  { href: '/routes', label: 'Routes' },
  { href: '/drivers', label: 'Drivers' },
  { href: '/fleet', label: 'Fleet' },
  { href: '/trips', label: 'Trips' },
  { href: '/issues', label: 'Issues' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/settings', label: 'Settings' },
] as const;

export function AdminShell({ profileName, children }: { profileName: string; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>SawariBuddy</div>
        <nav style={styles.nav}>
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={pathname === href ? { ...styles.link, ...styles.activeLink } : styles.link}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div style={styles.footer}>
          <span style={styles.profileName}>{profileName}</span>
          <form action={signOut}>
            <button type="submit" style={styles.signOut}>Sign out</button>
          </form>
        </div>
      </aside>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: 220,
    background: '#111827',
    color: '#f9fafb',
    display: 'flex',
    flexDirection: 'column' as const,
    flexShrink: 0,
  },
  brand: {
    padding: '20px 16px',
    fontSize: 18,
    fontWeight: 700,
    borderBottom: '1px solid #374151',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    padding: '12px 8px',
    flex: 1,
  },
  link: {
    display: 'block',
    padding: '8px 12px',
    borderRadius: 6,
    color: '#d1d5db',
    textDecoration: 'none',
    fontSize: 14,
  },
  activeLink: {
    background: '#1f2937',
    color: '#fff',
    fontWeight: 600,
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #374151',
    fontSize: 13,
  },
  profileName: {
    display: 'block',
    color: '#9ca3af',
    marginBottom: 8,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  signOut: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
  },
  main: {
    flex: 1,
    padding: 24,
    background: '#f9fafb',
    overflow: 'auto' as const,
  },
} satisfies Record<string, React.CSSProperties>;
