import Constants from 'expo-constants';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, Screen, StatusPill } from '@/components';
import { runDiagnostics, type DiagnosticsReport } from '@/features/diagnostics/connectionChecks';
import { envResult } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme';

// DEVELOPMENT-ONLY: verifies this phone can reach the local Supabase on the Mac over Wi-Fi.
export default function ConnectionScreen() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    if (!envResult.ok || !supabase) return;
    setRunning(true);
    try {
      setReport(await runDiagnostics(envResult.env, supabase));
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  if (!__DEV__) return <Redirect href="/welcome" />;

  // Metro's host is the Mac's address as seen by this phone; Supabase should normally share it.
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? null;
  const supabaseHost = envResult.ok ? safeHostname(envResult.env.supabaseUrl) : null;
  const allPassed = report?.checks.every((c) => c.status === 'pass') ?? false;

  return (
    <Screen scroll edges={['bottom']}>
      <View style={styles.stack}>
        {!envResult.ok ? (
          <Banner tone="danger" title="App is not configured" message={`${envResult.problems.join(' ')} Run \`pnpm mobile:env\` on the Mac, then restart \`pnpm mobile\`.`} />
        ) : (
          <>
            {envResult.warnings.map((w) => (
              <Banner key={w} tone="warning" title="Check configuration" message={w} />
            ))}
            {metroHost && supabaseHost && metroHost !== supabaseHost ? (
              <Banner
                tone="warning"
                title="Different hosts"
                message={`The app was loaded from ${metroHost} but Supabase is set to ${supabaseHost}. If the Mac's IP changed, run \`pnpm mobile:env\`.`}
              />
            ) : null}
            {report ? (
              allPassed ? (
                <Banner tone="success" title="Connected to local Supabase" message="This phone can reach Auth, the database and Realtime on the Mac." />
              ) : (
                <Banner tone="danger" title="Connection problem" message="At least one check failed. See the details below." />
              )
            ) : null}
          </>
        )}

        <Card>
          <AppText variant="heading">Configuration</AppText>
          <Row label="Supabase URL" value={envResult.ok ? envResult.env.supabaseUrl : 'not set'} />
          <Row label="Key" value={envResult.ok ? `${envResult.env.supabaseAnonKey.slice(0, 10)}… (anon, public)` : 'not set'} />
          <Row label="App loaded from" value={Constants.expoConfig?.hostUri ?? 'unknown'} />
          <Row label="Device" value={`${Platform.OS} ${String(Platform.Version)}`} />
        </Card>

        {report?.checks.map((c) => (
          <Card key={c.id}>
            <View style={styles.checkHeader}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {c.label}
              </AppText>
              <StatusPill label={c.status === 'pass' ? 'Pass' : 'Fail'} tone={c.status === 'pass' ? 'success' : 'danger'} />
            </View>
            <AppText variant="small" color={colors.ink500}>
              {c.detail}
            </AppText>
            {c.latencyMs !== null ? (
              <AppText variant="caption" color={colors.ink400}>
                {c.latencyMs} ms
              </AppText>
            ) : null}
          </Card>
        ))}

        {report?.clockSkewMs != null ? (
          <Card>
            <AppText variant="bodyStrong">Phone clock vs server</AppText>
            <AppText variant="small" color={colors.ink500}>
              {Math.abs(report.clockSkewMs) < 2000
                ? 'In sync (within 2 s).'
                : `Phone clock is ${Math.round(Math.abs(report.clockSkewMs) / 1000)} s ${report.clockSkewMs > 0 ? 'behind' : 'ahead of'} the server. Countdowns will use server time.`}
            </AppText>
          </Card>
        ) : null}

        <Button label={running ? 'Checking…' : 'Run checks again'} loading={running} onPress={() => void run()} disabled={!envResult.ok} />
        {report ? (
          <AppText variant="caption" color={colors.ink400} align="center">
            Last run {report.ranAt.toLocaleTimeString()}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="small" color={colors.ink500}>
        {label}
      </AppText>
      <AppText variant="small" selectable>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md, paddingBottom: spacing.xxl },
  checkHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  flex: { flex: 1 },
  row: { marginTop: spacing.sm, gap: spacing.xxs },
});
