import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { driverHeartbeat } from '@/lib/api';
import { supabase } from '@/lib/supabase';

const DEFAULT_INTERVAL_S = 10;
const MIN_INTERVAL_S = 3;
const FAILURE_THRESHOLD = 5;

export type HeartbeatState = {
  isRunning: boolean;
  consecutiveFailures: number;
  lastError: string | null;
  hasLocationPermission: boolean | null;
};

export function useHeartbeat(enabled: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef(DEFAULT_INTERVAL_S);
  const mountedRef = useRef(true);

  const [state, setState] = useState<HeartbeatState>({
    isRunning: false,
    consecutiveFailures: 0,
    lastError: null,
    hasLocationPermission: null,
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(async () => {
    if (!mountedRef.current || !supabase) return;

    let lat: number | undefined;
    let lng: number | undefined;
    let accuracyM: number | undefined;

    const { status } = await Location.getForegroundPermissionsAsync();
    const hasPermission = status === Location.PermissionStatus.GRANTED;
    if (hasPermission) {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        accuracyM = loc.coords.accuracy ?? undefined;
      } catch {
        // Location fetch failed — send heartbeat without coords
      }
    }

    try {
      const result = (await driverHeartbeat(supabase, { lat, lng, accuracyM })) as Record<
        string,
        unknown
      >;
      if (!mountedRef.current) return;

      const nextSeconds = typeof result.next_heartbeat_seconds === 'number'
        ? Math.max(result.next_heartbeat_seconds, MIN_INTERVAL_S)
        : DEFAULT_INTERVAL_S;
      intervalRef.current = nextSeconds;

      setState((s) => ({
        ...s,
        isRunning: true,
        consecutiveFailures: 0,
        lastError: null,
        hasLocationPermission: hasPermission,
      }));
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : String(err);
      setState((s) => ({
        ...s,
        isRunning: true,
        consecutiveFailures: s.consecutiveFailures + 1,
        lastError: message,
        hasLocationPermission: hasPermission,
      }));
    }

    if (mountedRef.current) {
      timerRef.current = setTimeout(() => void tick(), intervalRef.current * 1000);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setState((s) => ({ ...s, isRunning: false, consecutiveFailures: 0, lastError: null }));
      return;
    }

    void (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        await Location.requestForegroundPermissionsAsync();
      }
      void tick();
    })();

    return clearTimer;
  }, [enabled, clearTimer, tick]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (!enabled) return;
      if (nextState === 'active') {
        clearTimer();
        void tick();
      } else {
        clearTimer();
        setState((s) => ({ ...s, isRunning: false }));
      }
    });
    return () => subscription.remove();
  }, [enabled, clearTimer, tick]);

  const isUnreachable = state.consecutiveFailures >= FAILURE_THRESHOLD;

  return { ...state, isUnreachable };
}
