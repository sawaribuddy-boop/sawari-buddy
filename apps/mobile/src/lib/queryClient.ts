import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide QueryClient. Default staleTime keeps data fresh for 30 s so screens don't
 * refetch on every navigation. Realtime events invalidate eagerly when something changes.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: 'always',
    },
    mutations: {
      retry: 0,
    },
  },
});
