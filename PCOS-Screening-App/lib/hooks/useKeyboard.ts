/**
 * lib/hooks/useKeyboard
 * ─────────────────────────────────────────────────────────────────────────────
 * Whether the software keyboard is up, and how tall it is.
 *
 * `automaticallyAdjustKeyboardInsets` on the scroll container (see
 * `components/ui/Screen`) handles the general case: it insets for the keyboard
 * and scrolls the focused field into view. That is enough for a form that
 * simply runs off the bottom of a long screen.
 *
 * It is not enough for the auth screens. Those centre their content and carry a
 * brand block — logo, title, subtitle — worth roughly 200pt. On a small handset
 * with the keyboard open there is about 340pt of usable height left, and signup
 * has four fields in it. The last field is reachable by scrolling, but the user
 * should not have to scroll a login form.
 *
 * So those screens collapse the brand block while the keyboard is up, and need
 * to know when that is.
 *
 * iOS gets `keyboardWillShow`, which fires *before* the animation, so the
 * layout change runs alongside it rather than lurching afterwards. Android has
 * no "will" event, so `keyboardDidShow` is the only option there.
 */

import { useEffect, useState } from "react";
import { Keyboard, Platform, type KeyboardEvent } from "react-native";

export type KeyboardState = {
  visible: boolean;
  /** Height in points. 0 when hidden. */
  height: number;
};

export function useKeyboard(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ visible: false, height: 0 });

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (event: KeyboardEvent) => {
      setState({ visible: true, height: event.endCoordinates?.height ?? 0 });
    };
    const onHide = () => setState({ visible: false, height: 0 });

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return state;
}
