import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, BrandMark, Button, Icon } from '@/components';
import { colors, radius, spacing } from '@/theme';

// Concept screen P1 (Splash / Welcome). The photo in the concept is replaced by a styled
// PLACEHOLDER scene (D5) until final brand artwork is provided.
export default function WelcomeScreen() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.green900, colors.green800, '#12402C']} style={StyleSheet.absoluteFill} />
      <HeroScene />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <BrandMark size={40} onDark />
        </View>

        <View style={styles.bottom}>
          <AppText variant="display" color={colors.white}>
            Shared Auto
          </AppText>
          <View style={styles.taglines}>
            {['Same route', 'Lower cost', 'A better commute'].map((line) => (
              <AppText key={line} variant="heading" color="rgba(255,255,255,0.88)" style={styles.tagline}>
                {line}
              </AppText>
            ))}
          </View>

          <View style={styles.values}>
            <Value icon="shield-check-outline" label="Safe" />
            <Value icon="account-group-outline" label="Affordable" />
            <Value icon="leaf" label="Eco-friendly" />
          </View>

          <Button label="Get Started" onPress={() => router.push('/signup')} />

          <Link href="/login" asChild>
            <Pressable accessibilityRole="link" style={styles.loginLink} hitSlop={8}>
              <AppText variant="small" color="rgba(255,255,255,0.8)" align="center">
                Already have an account?{' '}
                <AppText variant="small" color={colors.white} style={styles.loginStrong}>
                  Log in
                </AppText>
              </AppText>
            </Pressable>
          </Link>

          {__DEV__ ? (
            <View style={styles.devLinks}>
              <Link href="/dev/connection" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <AppText variant="caption" color="rgba(255,255,255,0.5)">
                    Connection check
                  </AppText>
                </Pressable>
              </Link>
              <AppText variant="caption" color="rgba(255,255,255,0.3)">
                ·
              </AppText>
              <Link href="/dev/components" asChild>
                <Pressable accessibilityRole="link" hitSlop={8}>
                  <AppText variant="caption" color="rgba(255,255,255,0.5)">
                    Design preview
                  </AppText>
                </Pressable>
              </Link>
              <AppText variant="caption" color="rgba(255,255,255,0.3)">
                (dev only)
              </AppText>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function Value({ icon, label }: { icon: 'shield-check-outline' | 'account-group-outline' | 'leaf'; label: string }) {
  return (
    <View style={styles.value}>
      <Icon name={icon} size={16} color={colors.autoYellow} />
      <AppText variant="caption" color={colors.white}>
        {label}
      </AppText>
    </View>
  );
}

/** Decorative placeholder: evening sun, a shared auto, and the road it sits on. Grouped so it scales as one unit. */
function HeroScene() {
  return (
    <View style={styles.scene} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.sceneGroup}>
        <View style={styles.sun} />
        <View style={styles.auto}>
          <Icon name="rickshaw" size={140} color={colors.autoYellow} />
        </View>
        <View style={styles.road}>
          <View style={styles.lane}>
            {Array.from({ length: 7 }, (_, i) => (
              <View key={i} style={styles.dash} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.green900 },
  safe: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  top: { paddingTop: spacing.md },
  bottom: { gap: spacing.lg, paddingBottom: spacing.md },
  taglines: { gap: spacing.xxs },
  tagline: { fontWeight: '600' },
  values: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  loginLink: { paddingVertical: spacing.xs },
  devLinks: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  loginStrong: { fontWeight: '700', textDecorationLine: 'underline' },

  scene: { ...StyleSheet.absoluteFill, justifyContent: 'flex-start', paddingTop: '22%' },
  sceneGroup: { alignItems: 'center' },
  sun: {
    position: 'absolute',
    top: -30,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: colors.autoYellow,
    opacity: 0.14,
  },
  auto: { marginTop: 40 },
  road: {
    marginTop: -30,
    alignSelf: 'stretch',
    marginHorizontal: -40,
    height: 64,
    backgroundColor: 'rgba(0,0,0,0.28)',
    transform: [{ rotate: '-4deg' }],
    justifyContent: 'center',
  },
  lane: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: spacing.xl },
  dash: { width: 30, height: 5, borderRadius: 3, backgroundColor: colors.autoYellow, opacity: 0.55 },
});
