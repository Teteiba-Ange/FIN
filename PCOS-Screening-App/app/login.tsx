// app/login.tsx
/**
 * Sign in.
 *
 * Rebuilt on the design system. What changed and why:
 *
 *   - 32 hardcoded hex values are gone, so the screen now has a dark mode.
 *     Previously it rendered #f0f4f8 regardless of the device setting while
 *     the status bar around it went dark.
 *   - Validation is inline, next to the field it concerns, instead of an
 *     `Alert` that names the problem after covering the form.
 *   - The Facebook button is removed: `app.json` still holds the literal
 *     "YOUR_FACEBOOK_APP_ID" and `socialAuth` throws on that string, so it
 *     could never have worked. Google is removed for the same class of
 *     reason — it stores Google's id_token as our bearer token, which our
 *     own middleware can never verify, so every request after "success"
 *     returns 401. Both come back when there is a backend to exchange with.
 *   - "Forgot password" is removed rather than left as a control with no
 *     handler and no route behind it. A dead control costs more trust than
 *     an absent one.
 */

import React, { useRef, useState } from "react";
import { Image, StyleSheet, View, type TextInput } from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";

import { Screen, Text, Field, Button, Card } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { useKeyboard } from "@/lib/hooks/useKeyboard";
import { spacing, radius, useTheme } from "@/theme";

type Errors = { email?: string; password?: string; form?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { login } = useAuth();
  const keyboard = useKeyboard();

  // So the keyboard's "Next" key moves to the password rather than doing
  // nothing, which is what `returnKeyType` alone amounts to.
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const clear = (key: keyof Errors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));

  const validate = (): boolean => {
    const next: Errors = {};
    if (!email.trim()) next.email = "Enter your email address";
    else if (!EMAIL_RE.test(email.trim())) next.email = "That doesn't look like an email address";
    if (!password) next.password = "Enter your password";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace("/");
    } catch (error: any) {
      // The server returns a deliberately vague "Invalid credentials" for both
      // an unknown email and a wrong password — we keep that vagueness here
      // rather than telling an attacker which of the two they got right.
      setErrors({
        form:
          error?.message === "Invalid credentials"
            ? "That email and password don't match. Check both and try again."
            : (error?.message ?? "We couldn't sign you in. Check your connection and try again."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      edges={["top", "bottom"]}
      // Centred while idle, top-aligned once the keyboard is up — centring
      // against a shrunken viewport pushes the fields under the keyboard.
      contentContainerStyle={[styles.content, keyboard.visible && styles.contentTyping]}
    >
      <Animated.View layout={LinearTransition.duration(220)} style={styles.brand}>
        {/*
          The logo and subtitle are the first things to go when space is tight.
          They are decoration on a screen the user has already decided to use,
          and on a small handset they are the difference between the password
          field being visible and being behind the keyboard.
        */}
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
              // Decorative — the product name is right below it in text.
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </Animated.View>
        )}

        <Text variant="title" center accessibilityRole="header" style={styles.title}>
          Welcome back
        </Text>

        {!keyboard.visible && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
            <Text variant="body" color="textSecondary" center style={styles.subtitle}>
              Sign in to pick up your tracking where you left off.
            </Text>
          </Animated.View>
        )}
      </Animated.View>

      <View style={styles.form}>
        <Field
          label="Email address"
          placeholder="name@example.com"
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
          // Keeps the keyboard up between the two fields instead of dropping
          // and re-raising it, which is what makes a two-field form feel slow.
          blurOnSubmit={false}
        />

        <Field
          ref={passwordRef}
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            clear("password");
          }}
          error={errors.password}
          icon="lock-closed-outline"
          secure
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleLogin}
        />

        {/*
          A failure that belongs to the submission rather than to one field.
          Announced politely so a screen reader picks it up without stealing
          focus from wherever the user currently is.
        */}
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
          label="Sign in"
          onPress={handleLogin}
          loading={submitting}
          size="lg"
          style={styles.submit}
        />
      </View>

      <View style={styles.footer}>
        <Text variant="callout" color="textSecondary" center>
          New here?
        </Text>
        <Button
          label="Create an account"
          onPress={() => router.push("/signup")}
          variant="ghost"
          size="sm"
          fullWidth={false}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The form sits slightly above centre — optically centred rather than
  // mathematically, which is what reads as balanced once the keyboard is up.
  content: { justifyContent: "center", paddingBottom: spacing.xxxl },
  // With the keyboard up the viewport is roughly half as tall; centring in it
  // puts the fields under the keyboard rather than above it.
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
  subtitle: { maxWidth: 300 },
  form: { gap: spacing.lg },
  formError: { paddingVertical: spacing.md },
  submit: { marginTop: spacing.sm },
  footer: {
    marginTop: spacing.xxl,
    alignItems: "center",
    gap: spacing.xs,
  },
});
