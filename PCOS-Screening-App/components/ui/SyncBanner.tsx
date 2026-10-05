/**
 * SyncBanner — tells the user when their entries haven't reached the server.
 *
 * E-06. Previously every failure was either a silent `.catch(() => {})` or a
 * modal alert: Home swallowed a failed fetch, Settings fell back to local
 * storage without saying so, and the forum set an `error` it never rendered.
 * The user had no way to know whether what they'd logged was safe.
 *
 * It reports **what is actually queued**, not a guess at network state. That is
 * a deliberate choice over adding a connectivity library: "3 entries haven't
 * synced" is both true and actionable, whereas "You're offline" is neither when
 * the phone has signal and the server is simply down. It also stays honest on
 * the case that matters most — a write that failed for a reason unrelated to
 * connectivity.
 *
 * Nothing is shown when the queue is empty, which is almost always.
 */

import React, { useCallback, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { pendingCount, syncNow } from "@/lib/logs";
import { useTheme, radius, spacing } from "@/theme";
import { Text } from "./Text";
import { Button } from "./Button";

export function SyncBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const [pending, setPending] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(() => {
    pendingCount()
      .then(setPending)
      .catch(() => setPending(0));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // A flush triggered elsewhere (app foreground, a write on another
      // screen) can drain the queue while this is mounted, so re-check
      // periodically rather than only on focus.
      const timer = setInterval(refresh, 5000);
      return () => clearInterval(timer);
    }, [refresh])
  );

  if (pending === 0) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const remaining = await syncNow();
      setPending(remaining);
    } catch {
      // Still queued — the count stays, which is the correct message.
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.riskModerateSubtle },
        style,
      ]}
      accessibilityLiveRegion="polite"
      accessible
      accessibilityLabel={`${pending} ${
        pending === 1 ? "entry has" : "entries have"
      } not synced yet. They are saved on this phone.`}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.riskModerate} />

      <View style={styles.text}>
        <Text variant="callout" style={{ color: colors.riskModerate }}>
          {pending === 1
            ? "1 entry hasn't synced yet"
            : `${pending} entries haven't synced yet`}
        </Text>
        {/*
          The reassurance matters as much as the warning: the data is not lost,
          it just hasn't left the device. Without this the banner reads as
          "your logging failed", which is not what happened.
        */}
        <Text variant="caption" color="textSecondary">
          Saved on this phone. They&apos;ll upload automatically.
        </Text>
      </View>

      <Button
        label="Retry"
        onPress={handleRetry}
        variant="ghost"
        size="sm"
        fullWidth={false}
        loading={retrying}
        accessibilityLabel="Retry syncing now"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    paddingLeft: spacing.lg,
    borderRadius: radius.md,
  },
  text: { flex: 1, gap: 1 },
});
