import { useNetworkStatus } from '@/features/diagnostics/useNetworkStatus';

import { Banner } from './Banner';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  if (isConnected) return null;
  return <Banner tone="danger" title="You are offline" message="Check your internet connection." />;
}
