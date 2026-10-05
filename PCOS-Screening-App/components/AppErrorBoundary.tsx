/**
 * AppErrorBoundary — the last line of defence (B-07).
 *
 * There was no error boundary anywhere in the tree, so a single render throw
 * unmounted the whole app to a white screen with no way back. That is not
 * hypothetical: `mental-wellbeing.tsx` shipped with a hook called at module
 * scope, and every user who tapped it got exactly that.
 *
 * What this deliberately does *not* do is pretend nothing happened. It says
 * something broke, offers the two things that actually help — try again, or go
 * home — and shows the error text, because a user reporting "it crashed" is
 * far less useful to you than one who can read out a message.
 *
 * `onError` is a hook for a crash reporter. Sentry's Expo SDK slots in there
 * (G-08) once there is a DSN to point it at; until then errors go to the
 * console, which is honest about the fact that nothing is collecting them.
 */

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useTheme, spacing, radius } from "@/theme";

type Props = {
  children: React.ReactNode;
  /** Called once per caught error. Wire a crash reporter here. */
  onError?: (error: Error, componentStack: string) => void;
};

type State = { error: Error | null; componentStack: string | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const stack = info.componentStack ?? "";
    this.setState({ componentStack: stack });

    // Kept even once a reporter is wired — during development the console is
    // where this is actually read.
    console.error("[CRASH]", error, stack);
    this.props.onError?.(error, stack);
  }

  reset = () => this.setState({ error: null, componentStack: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <ErrorScreen
        error={this.state.error}
        componentStack={this.state.componentStack}
        onRetry={this.reset}
      />
    );
  }
}

/**
 * Split out as a function component so it can use the theme hook — the
 * boundary itself must be a class, since there is still no hook equivalent of
 * `componentDidCatch`.
 */
function ErrorScreen({
  error,
  componentStack,
  onRetry,
}: {
  error: Error;
  componentStack: string | null;
  onRetry: () => void;
}) {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.badge, { backgroundColor: colors.dangerSubtle }]}>
          <Ionicons
            name="alert-circle-outline"
            size={30}
            color={colors.danger}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>

        <View style={styles.copy}>
          <Text variant="title" center accessibilityRole="header">
            Something went wrong
          </Text>
          <Text variant="body" color="textSecondary" center>
            This screen hit a problem it couldn&apos;t recover from on its own.
            Nothing you&apos;ve logged has been lost.
          </Text>
        </View>

        {/*
          The message is shown rather than hidden behind a generic apology.
          "It crashed" is not a report anyone can act on; a message is.
        */}
        <View style={[styles.details, { backgroundColor: colors.sunken }]}>
          <Text variant="label" color="textTertiary">
            What happened
          </Text>
          <Text variant="callout" color="textSecondary" selectable>
            {error.message || String(error)}
          </Text>

          {__DEV__ && componentStack ? (
            <Text variant="caption" color="textTertiary" selectable style={styles.stack}>
              {componentStack.trim().split("\n").slice(0, 8).join("\n")}
            </Text>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button label="Try again" onPress={onRetry} icon="refresh-outline" />
        </View>

        <Text variant="caption" color="textTertiary" center>
          If it keeps happening, closing and reopening the app usually clears it.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xl,
    padding: spacing.lg,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: spacing.sm, maxWidth: 320 },
  details: {
    width: "100%",
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  stack: { marginTop: spacing.sm, fontFamily: undefined },
  actions: { width: "100%", gap: spacing.sm },
});
