import { useNetInfo } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const netInfo = useNetInfo();
  const isConnected = netInfo.isConnected !== false && netInfo.isInternetReachable !== false;
  return { isConnected };
}
