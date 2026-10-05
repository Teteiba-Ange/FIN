/**
 * Avatar — a profile picture, initials, or a fallback glyph.
 *
 * The same face appears on the profile screen and in the menu card, and both
 * previously drew their own circle with their own fallback logic. One component
 * means a picture that changes in one place changes everywhere.
 *
 * Falls back in order: photo → initials → person icon. Initials before the
 * glyph because a signed-in user with no photo still has a name, and "AM" is
 * more identifying than an anonymous silhouette.
 *
 * `editable` adds a camera badge and makes the whole thing a button. The badge
 * exists because a tappable circle with no affordance is not discoverable —
 * users do not try tapping their own photo unless something suggests they can.
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, spacing } from "@/theme";
import { Text } from "./Text";

type AvatarProps = {
  /** Fully-resolved image URL, or null for the fallback. */
  uri?: string | null;
  /** Used to derive initials when there is no picture. */
  name?: string | null;
  size?: number;
  /** Shows a camera badge and makes the avatar pressable. */
  editable?: boolean;
  onPress?: () => void;
  /** Covers the avatar with a spinner while an upload is in flight. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

function initialsOf(name?: string | null): string {
  if (!name?.trim()) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Avatar({
  uri,
  name,
  size = 64,
  editable = false,
  onPress,
  loading = false,
  style,
}: AvatarProps) {
  const { colors } = useTheme();
  // A broken URL should fall back to initials rather than showing the
  // platform's grey placeholder box.
  const [failed, setFailed] = useState(false);

  const initials = initialsOf(name);
  const showImage = Boolean(uri) && !failed;

  const body = (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primarySubtle,
          },
        ]}
      >
        {showImage ? (
          <Image
            // Keyed on the URL so a new one (including a changed cache-buster)
            // forces a reload rather than reusing the decoded old image.
            key={uri}
            source={{ uri: uri! }}
            style={{ width: size, height: size }}
            onError={() => setFailed(true)}
            accessibilityIgnoresInvertColors
          />
        ) : initials ? (
          <Text
            variant="subhead"
            style={{ color: colors.primary, fontSize: size * 0.34 }}
          >
            {initials}
          </Text>
        ) : (
          <Ionicons name="person" size={size * 0.42} color={colors.primary} />
        )}
      </View>

      {loading && (
        <View
          style={[
            styles.overlay,
            { borderRadius: size / 2, backgroundColor: colors.scrim },
          ]}
        >
          <ActivityIndicator color={colors.onPrimary} />
        </View>
      )}

      {editable && !loading && (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: colors.primary,
              borderColor: colors.bg,
              width: size * 0.34,
              height: size * 0.34,
              borderRadius: (size * 0.34) / 2,
            },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name="camera" size={size * 0.18} color={colors.onPrimary} />
        </View>
      )}
    </View>
  );

  if (!editable && !onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={
        uri ? "Change your profile picture" : "Add a profile picture"
      }
      accessibilityState={{ busy: loading }}
      hitSlop={spacing.sm}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    // Clips the image to the circle rather than letting square corners show.
    overflow: "hidden",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  pressed: { opacity: 0.85 },
});
