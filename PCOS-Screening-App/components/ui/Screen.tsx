/**
 * Screen — the outer wrapper every screen uses.
 *
 * Replaces 35 hand-rolled SafeAreaView + ScrollView combinations, each with
 * slightly different padding. Handles safe areas, the themed background, and
 * keyboard avoidance in one place.
 *
 * ─── Keyboard handling ──────────────────────────────────────────────────────
 *
 * This previously wrapped everything in a `KeyboardAvoidingView` with
 * `behavior="padding"` on iOS. That is the wrong tool around a ScrollView:
 * padding shrinks the scroll container from the outside, which stops the
 * keyboard covering the *view* but does nothing to bring the focused input
 * into sight — so on a long form (signup, edit profile, the assessment steps)
 * the user still ends up typing behind the keyboard. It also double-counts
 * against `automaticallyAdjustKeyboardInsets`.
 *
 * What is used instead:
 *
 *   Scrolling content — `automaticallyAdjustKeyboardInsets` on the ScrollView.
 *     iOS adds a bottom inset matching the keyboard *and* scrolls the focused
 *     field into view. On Android the manifest's `adjustResize` resizes the
 *     window and React Native brings the focused input in, so no extra work.
 *
 *   Non-scrolling content (`scroll={false}`) — a real KeyboardAvoidingView,
 *     since there is no scroll container to inset.
 *
 * `keyboardOffset` exists for content inside a Modal, where the view does not
 * start at the top of the window and iOS cannot infer the distance itself.
 */

import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import Animated, { FadeInUp } from "react-native-reanimated";

import { useTheme, spacing } from "@/theme";

type ScreenProps = {
  children: React.ReactNode;
  /** Set false for screens that manage their own scrolling (e.g. a FlatList). */
  scroll?: boolean;
  /** Remove the default horizontal padding for edge-to-edge content. */
  padded?: boolean;
  /** Safe-area edges to inset. Screens under a tab bar don't need "bottom". */
  edges?: readonly Edge[];
  /**
   * Extra offset for keyboard avoidance, in points. Needed when this sits
   * inside a Modal or below a header, where iOS cannot work out the distance
   * from the top of the window on its own.
   */
  keyboardOffset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ["top"],
  keyboardOffset = 0,
  contentContainerStyle,
  style,
}: ScreenProps) {
  const { colors } = useTheme();

  const content = scroll ? (
    <Animated.ScrollView
      entering={FadeInUp.duration(420)}
      showsVerticalScrollIndicator={false}
      // Taps on controls behind the keyboard land on the first press rather
      // than being swallowed by the dismiss.
      keyboardShouldPersistTaps="handled"
      // Dragging dismisses the keyboard — the gesture users already expect.
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      // The important one: insets for the keyboard AND scrolls the focused
      // field into view. iOS only; Android is covered by adjustResize.
      automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        padded && styles.padded,
        styles.scrollContent,
        contentContainerStyle,
      ]}
    >
      {children}
    </Animated.ScrollView>
  ) : (
    <Animated.View
      entering={FadeInUp.duration(420)}
      style={[styles.flex, padded && styles.padded, contentContainerStyle]}
    >
      {children}
    </Animated.View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.flex, { backgroundColor: colors.bg }, style]}
    >
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={[styles.orbTop, { backgroundColor: colors.primarySubtle }]} />
        <View style={[styles.orbBottom, { backgroundColor: colors.sunken }]} />
      </View>

      {/*
        Only the non-scrolling case gets a KeyboardAvoidingView. Wrapping the
        ScrollView in one as well would apply the inset twice.
      */}
      {scroll ? (
        content
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={keyboardOffset}
        >
          {content}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  orbTop: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -145,
    right: -95,
    opacity: 0.7,
  },
  orbBottom: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -120,
    left: -90,
    opacity: 0.65,
  },
  padded: { paddingHorizontal: spacing.xl },
  // Breathing room so the last element never sits against the tab bar.
  scrollContent: { paddingBottom: spacing.xxxl, flexGrow: 1 },
});
