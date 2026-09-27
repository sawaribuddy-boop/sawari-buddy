import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/auth';
import { AdminShell } from './AdminShell';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();

  return <AdminShell profileName={profile.full_name ?? profile.email ?? 'Admin'}>{children}</AdminShell>;
}
