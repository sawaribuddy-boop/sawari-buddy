import { errorMessageFor } from '@sawari/constants';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, Card, Icon, type IconName, ListRow, SettingsSection, StatusPill, type PillTone } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDeleteAccount } from '@/features/auth/useDeleteAccount';
import { useDriverHome } from '@/features/driver';
import {
  APP_VERSION,
  callSupport,
  emailSupport,
  openExternal,
  PRIVACY_URL,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  TERMS_URL,
  whatsappSupport,
} from '@/lib/appInfo';
import { colors, radius, spacing } from '@/theme';

const ROLE_LABEL = { PASSENGER: 'Passenger', DRIVER: 'Driver' } as const;

const DRIVER_STATUS: Record<string, { label: string; tone: PillTone }> = {
  ACTIVE: { label: 'Verified', tone: 'success' },
  PENDING_VERIFICATION: { label: 'Verification pending', tone: 'warning' },
  SUSPENDED: { label: 'Suspended', tone: 'danger' },
};

export interface ProfileRideLink {
  title: string;
  subtitle: string;
  icon: IconName;
  href: Href;
}

export interface ProfileViewProps {
  /** Role-specific screens: passenger routes live under (passenger), driver routes under /driver. */
  links: {
    editProfile: Href;
    changePassword: Href;
    reportProblem: Href;
    rides: ProfileRideLink[];
  };
}

/** "+919876543210" → "+91 98765 43210"; other numbers are shown as stored. */
export function formatPhone(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

/** Profile for passengers and drivers: account, rides, driver details, help, about, sign out. */
export function ProfileView({ links }: ProfileViewProps) {
  const router = useRouter();
  const { account, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const deleteMutation = useDeleteAccount();
  if (!account) return null;

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need to log in again to use SawariBuddy.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          void signOut().finally(() => setSigningOut(false));
        },
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'Your name, email and phone number will be removed and you will be signed out. ' +
        'Past rides stay in our records without your details. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  }

  return (
    <View style={styles.stack}>
      <Card>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Icon name="account" size={30} color={colors.green700} />
          </View>
          <View style={styles.flex}>
            <AppText variant="heading">{account.fullName}</AppText>
            {account.email ? (
              <AppText variant="small" color={colors.ink500}>
                {account.email}
              </AppText>
            ) : null}
            <AppText variant="small" color={colors.ink500}>
              {account.phone ? formatPhone(account.phone) : 'No mobile number added'}
            </AppText>
          </View>
          <StatusPill label={ROLE_LABEL[account.role]} tone={account.role === 'DRIVER' ? 'info' : 'success'} />
        </View>
      </Card>

      {account.role === 'DRIVER' ? <DriverDetails licenseNumber={account.licenseNumber} driverStatus={account.driverStatus} /> : null}

      <SettingsSection title="Rides">
        {links.rides.map((ride) => (
          <ListRow key={ride.title} title={ride.title} subtitle={ride.subtitle} icon={ride.icon} onPress={() => router.push(ride.href)} />
        ))}
      </SettingsSection>

      <SettingsSection title="Account">
        <ListRow title="Edit profile" subtitle="Name and mobile number" icon="account-edit-outline" onPress={() => router.push(links.editProfile)} />
        <ListRow title="Change password" icon="lock-reset" onPress={() => router.push(links.changePassword)} />
      </SettingsSection>

      <SettingsSection title="Help & support">
        <ListRow
          title="Report a problem"
          subtitle="Booking, payment or anything else"
          icon="alert-circle-outline"
          onPress={() => router.push(links.reportProblem)}
        />
        <ListRow title="Call support" subtitle={SUPPORT_PHONE_DISPLAY} icon="phone-outline" onPress={callSupport} />
        <ListRow title="WhatsApp support" subtitle={SUPPORT_PHONE_DISPLAY} icon="whatsapp" onPress={whatsappSupport} />
        <ListRow title="Email support" subtitle={SUPPORT_EMAIL} icon="email-outline" onPress={() => emailSupport()} />
      </SettingsSection>

      <SettingsSection title="About">
        <ListRow
          title="Terms & Conditions"
          icon="file-document-outline"
          onPress={() => void openExternal(TERMS_URL, { title: 'Terms & Conditions', text: TERMS_URL })}
        />
        <ListRow
          title="Privacy Policy"
          icon="shield-lock-outline"
          onPress={() => void openExternal(PRIVACY_URL, { title: 'Privacy Policy', text: PRIVACY_URL })}
        />
        <ListRow title="App version" subtitle={APP_VERSION} icon="information-outline" />
      </SettingsSection>

      <View style={styles.actions}>
        <Button label="Sign out" variant="dangerSoft" icon="logout" loading={signingOut} onPress={confirmSignOut} />
        {deleteMutation.isError ? (
          <Banner tone="danger" title="Could not delete your account" message={errorMessageFor(deleteMutation.error)} />
        ) : null}
        <Button
          label="Delete account"
          variant="dangerSoft"
          icon="account-remove-outline"
          loading={deleteMutation.isPending}
          disabled={signingOut}
          onPress={confirmDelete}
        />
      </View>
    </View>
  );
}

function DriverDetails({ licenseNumber, driverStatus }: { licenseNumber: string | null; driverStatus: string | null }) {
  const { data } = useDriverHome();
  const auto = (data as { auto?: { registration_number: string; model: string | null; colour: string | null } | null } | null)?.auto;
  const status = driverStatus ? DRIVER_STATUS[driverStatus] : undefined;
  const autoDetails = auto ? [auto.model, auto.colour].filter(Boolean).join(' · ') : '';

  return (
    <SettingsSection title="Driver details">
      <View style={styles.statusRow}>
        <AppText variant="bodyStrong">Driver status</AppText>
        {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
      </View>
      <ListRow
        title={auto ? auto.registration_number : 'No auto assigned'}
        subtitle={auto ? autoDetails || 'Assigned auto' : 'Contact support to get an auto assigned'}
        icon="rickshaw"
      />
      <ListRow title="Driving licence" subtitle={licenseNumber ?? 'Not on file'} icon="card-account-details-outline" />
    </SettingsSection>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.green50, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: spacing.xxs },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  actions: { gap: spacing.md },
});
