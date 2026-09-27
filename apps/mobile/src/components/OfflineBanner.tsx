import { useTranslation } from 'react-i18next';

import { useNetworkStatus } from '@/features/diagnostics/useNetworkStatus';

import { Banner } from './Banner';

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isConnected } = useNetworkStatus();
  if (isConnected) return null;
  return <Banner tone="danger" title={t('common.offlineTitle')} message={t('common.offlineMessage')} />;
}
