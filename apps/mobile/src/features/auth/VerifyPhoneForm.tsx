import { formatPhone } from '@sawari/domain';
import { mobileNumber, otpCode } from '@sawari/validation';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Banner, Button, TextField } from '@/components';
import { colors, spacing } from '@/theme';

import { useAuth } from './AuthProvider';

const RESEND_AFTER_SECONDS = 30;

/**
 * Two steps: enter the mobile number and get an SMS code, then enter the code. A number already
 * verified on another account is refused when the code is requested.
 */
export function VerifyPhoneForm({ initialPhone, onVerified }: { initialPhone?: string | null; onVerified?: () => void }) {
  const { sendPhoneCode, verifyPhoneCode } = useAuth();
  const [phoneInput, setPhoneInput] = useState(initialPhone ? formatPhone(initialPhone) : '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function send(phoneRaw: string) {
    setFormError(null);
    const parsed = mobileNumber.safeParse(phoneRaw);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    const { error } = await sendPhoneCode(parsed.data);
    setBusy(false);
    if (error) {
      setFormError(error);
      return;
    }
    setSentTo(parsed.data);
    setCode('');
    setResendIn(RESEND_AFTER_SECONDS);
  }

  async function verify() {
    if (!sentTo) return;
    setFormError(null);
    const parsed = otpCode.safeParse(code);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    const { error } = await verifyPhoneCode(sentTo, parsed.data);
    setBusy(false);
    if (error) setFormError(error);
    else onVerified?.();
  }

  if (!sentTo) {
    return (
      <View style={styles.body}>
        {formError ? <Banner tone="danger" title="Couldn't send the code" message={formError} /> : null}
        <TextField
          label="Mobile number"
          value={phoneInput}
          onChangeText={setPhoneInput}
          error={fieldError}
          hint="We'll text you a 6-digit code."
          placeholder="98765 43210"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="send"
          onSubmitEditing={() => void send(phoneInput)}
        />
        <Button label="Send code" icon="message-text-outline" loading={busy} onPress={() => void send(phoneInput)} />
      </View>
    );
  }

  return (
    <View style={styles.body}>
      {formError ? <Banner tone="danger" title="Couldn't verify the code" message={formError} /> : null}
      <AppText color={colors.ink500}>
        We sent a 6-digit code to <AppText variant="bodyStrong">{formatPhone(sentTo)}</AppText>.
      </AppText>
      <TextField
        label="Code"
        value={code}
        onChangeText={setCode}
        error={fieldError}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={7}
        returnKeyType="done"
        onSubmitEditing={() => void verify()}
      />
      <Button label="Verify" icon="check" loading={busy} onPress={() => void verify()} />
      <View style={styles.links}>
        <Pressable
          accessibilityRole="button"
          disabled={resendIn > 0 || busy}
          onPress={() => void send(sentTo)}
          hitSlop={8}
        >
          <AppText variant="small" color={resendIn > 0 ? colors.ink400 : colors.green700}>
            {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setSentTo(null);
            setFormError(null);
            setFieldError(undefined);
          }}
          hitSlop={8}
        >
          <AppText variant="small" color={colors.green700}>
            Change number
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
});
