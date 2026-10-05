// app/signup.tsx
/**
 * Create an account.
 *
 * Rebuilt on the design system, matching login exactly — the two screens
 * previously used different backgrounds (#ffffff vs #f0f4f8), different input
 * styles, different radii and different social-button colours, so moving
 * between them felt like moving between two apps.
 *
 * Also fixed here:
 *   - The 220px stock photo is gone. It pushed the first input below the fold
 *     on a small handset and carried no information.
 *   - Password rules are stated up front and checked inline, rather than the
 *     only feedback being an `Alert` saying "Passwords do not match" after
 *     the user has filled in four fields.
 *   - Social buttons removed — see the note in login.tsx for why neither
 *     provider could have worked.
 *   - "Join PMOS Wellness" corrected: the product is named inconsistently in
 *     five places across the app. See C-09 in PLAN.md.
 */

import React, { useRef, useState } from "react";
import { Image, StyleSheet, View, type TextInput } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

import { Screen, Text, Field, Button, Card } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { useKeyboard } from "@/lib/hooks/useKeyboard";
import { spacing, radius, useTheme } from "@/theme";

type Errors = {
  name?: string;
  email?: string;
  password?: string;
  confirm?: string;
  form?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signup } = useAuth();
  const keyboard = useKeyboard();

  // Name → email → password → confirm → submit, without the keyboard dropping
  // between each. Four fields is exactly where tapping each one starts to grate.
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const clear = (key: keyof Errors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));

  const validate = (): boolean => {
    const next: Errors = {};

    if (!name.trim()) next.name = "Enter your name";
    else if (name.trim().length < 2) next.name = "That name looks too short";

    if (!email.trim()) next.email = "Enter your email address";
    else if (!EMAIL_RE.test(email.trim())) next.email = "That doesn't look like an email address";

    if (!password) next.password = "Choose a password";
    else if (password.length < MIN_PASSWORD)
      next.password = `Use at least ${MIN_PASSWORD} characters`;

    if (!confirm) next.confirm = "Type your password again";
    else if (confirm !== password) next.confirm = "These don't match";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await signup(email.trim().toLowerCase(), password, name.trim());
      router.replace("/");
    } catch (error: any) {
      // The server returns 409 with this exact message for a taken email.
      // That belongs next to the email field, not in a generic banner.
      if (error?.message === "Email already registered") {
        setErrors({ email: "There's already an account with this email. Try signing in." });
      } else {
        setErrors({
          form: error?.message ?? "We couldn't create your account. Check your connection and try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      edges={["top", "bottom"]}
      // Four fields plus a ~200pt brand block does not fit above the keyboard
      // on a small handset. Centring against the shrunken viewport would put
      // "Confirm password" behind it.
      contentContainerStyle={[styles.content, keyboard.visible && styles.contentTyping]}
    >
      <Animated.View layout={LinearTransition.duration(220)} style={styles.brand}>
        {!keyboard.visible && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(120)}
            style={[styles.mark, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Image
              source={require("../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </Animated.View>
        )}

        <Text variant="title" center accessibilityRole="header" style={styles.title}>
          Create your account
        </Text>

        {!keyboard.visible && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
            <Text variant="body" color="textSecondary" center style={styles.subtitle}>
              Track your symptoms and cycle over time, and see how they change.
            </Text>
          </Animated.View>
        )}
      </Animated.View>

      <View style={styles.form}>
        <Field
          label="Full name"
          placeholder="Jane Doe"
          value={name}
          onChangeText={(v) => {
            setName(v);
            clear("name");
          }}
          error={errors.name}
          icon="person-outline"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
          // Keeps the keyboard up between fields instead of dropping and
          // re-raising it, which is what makes a four-field form feel slow.
          blurOnSubmit={false}
        />

        <Field
          ref={emailRef}
          label="Email address"
          placeholder="jane@example.com"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            clear("email");
          }}
          error={errors.email}
          icon="mail-outline"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          blurOnSubmit={false}
        />

        <Field
          ref={passwordRef}
          label="Password"
          placeholder="At least 8 characters"
          helper={`${MIN_PASSWORD} characters or more.`}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            clear("password");
            if (confirm) clear("confirm");
          }}
          error={errors.password}
          icon="lock-closed-outline"
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          blurOnSubmit={false}
        />

        <Field
          ref={confirmRef}
          label="Confirm password"
          placeholder="Type it again"
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            clear("confirm");
          }}
          error={errors.confirm}
          icon="lock-closed-outline"
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSignup}
        />

        {errors.form && (
          <Card
            variant="sunken"
            style={[styles.formError, { backgroundColor: colors.dangerSubtle }]}
          >
            <Text
              variant="callout"
              style={{ color: colors.danger }}
              accessibilityLiveRegion="polite"
            >
              {errors.form}
            </Text>
          </Card>
        )}

        <Button
          label="Create account"
          onPress={handleSignup}
          loading={submitting}
          size="lg"
          style={styles.submit}
        />

        {/*
          The app collects menstrual history, symptoms and family medical
          history. Saying so before the account exists is the minimum; the
          full consent step lands with onboarding (E-05 / G-06 in PLAN.md).
        */}
        <Text variant="caption" color="textTertiary" center style={styles.consent}>
          Your health data is stored against your account and is only visible to you.
        </Text>
      </View>

      <View style={styles.footer}>
        <Text variant="callout" color="textSecondary" center>
          Already have an account?
        </Text>
        <Button
          label="Sign in"
          onPress={() => router.replace("/login")}
          variant="ghost"
          size="sm"
          fullWidth={false}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: "center", paddingTop: spacing.xl, paddingBottom: spacing.xxxl },
  contentTyping: { justifyContent: "flex-start", paddingTop: spacing.lg },
  brand: { alignItems: "center", marginBottom: spacing.xxl },
  mark: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  logo: { width: 42, height: 42 },
  title: { marginBottom: spacing.xs },
  subtitle: { maxWidth: 320 },
  form: { gap: spacing.lg },
  formError: { paddingVertical: spacing.md },
  submit: { marginTop: spacing.sm },
  consent: { maxWidth: 320, alignSelf: "center" },
  footer: { marginTop: spacing.xxl, alignItems: "center", gap: spacing.xs },
});
