/**
 * lib/media/pickImage
 * ─────────────────────────────────────────────────────────────────────────────
 * Choosing a photo, from the camera or the library.
 *
 * Kept out of the screen because three things have to be right every time and
 * none of them are obvious:
 *
 *   Permission. Asking is not the same as being granted, and a permanent
 *     refusal cannot be re-prompted — the OS ignores repeat requests. The
 *     caller is told which of the two happened so it can explain rather than
 *     appear broken.
 *
 *   Size. The server rejects anything over 5MB, and a modern phone camera
 *     produces files well past that. Discovering the limit as a failed upload
 *     after thirty seconds on mobile data is a bad way to find out, so images
 *     are compressed and resized before they leave.
 *
 *   Aspect. A profile picture is displayed in a circle, so it is cropped
 *     square at pick time rather than centre-cropped at render and quietly
 *     cutting someone's head off.
 */

import * as ImagePicker from "expo-image-picker";

export type PickSource = "camera" | "library";

export type PickResult =
  | { status: "picked"; uri: string }
  | { status: "cancelled" }
  /** Refused this time, but the OS will ask again. */
  | { status: "denied" }
  /** Refused permanently — only Settings can change it. */
  | { status: "blocked" };

/**
 * Square, and compressed enough to stay comfortably under the server's 5MB
 * cap. 0.7 on a ~1000px square lands around 150–400KB, which is far more than
 * an avatar needs and quick to upload on a poor connection.
 */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
};

async function ensurePermission(source: PickSource): Promise<PickResult | null> {
  const current =
    source === "camera"
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();

  if (current.granted) return null;

  // Already refused permanently — requesting again is a no-op, so tell the
  // caller to point at Settings instead of showing a prompt that never appears.
  if (!current.canAskAgain) return { status: "blocked" };

  const requested =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (requested.granted) return null;
  return { status: requested.canAskAgain ? "denied" : "blocked" };
}

export async function pickImage(source: PickSource): Promise<PickResult> {
  const permissionProblem = await ensurePermission(source);
  if (permissionProblem) return permissionProblem;

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);

  if (result.canceled || !result.assets?.length) return { status: "cancelled" };

  return { status: "picked", uri: result.assets[0].uri };
}
