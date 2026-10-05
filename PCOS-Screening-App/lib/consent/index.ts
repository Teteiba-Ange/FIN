/**
 * lib/consent
 * ─────────────────────────────────────────────────────────────────────────────
 * Whether the user has seen and agreed to how their health data is handled.
 *
 * Versioned deliberately. Consent to one set of terms is not consent to a
 * later one, so when what the app does with the data changes, bump
 * `CONSENT_VERSION` and everyone is asked again. A single boolean would make
 * that impossible to do honestly.
 *
 * Stored on the device rather than the account: it gates onboarding, which
 * runs before there *is* an account.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pcos_consent";

/**
 * Bump when the data handling described in onboarding materially changes —
 * new data collected, a new recipient, a new retention rule.
 */
export const CONSENT_VERSION = 1;

export type ConsentRecord = {
  version: number;
  /** ISO timestamp of when it was given. */
  agreedAt: string;
};

export async function getConsent(): Promise<ConsentRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    return typeof parsed?.version === "number" ? parsed : null;
  } catch {
    // Unreadable means unknown, and unknown means ask again. Treating a
    // corrupt record as consent would be the wrong way to fail.
    return null;
  }
}

export async function setConsent(record: ConsentRecord): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(record)).catch((error) =>
    console.warn("[CONSENT] Could not save:", error)
  );
}

/** True when the user has agreed to the *current* version. */
export async function hasCurrentConsent(): Promise<boolean> {
  const record = await getConsent();
  return record != null && record.version >= CONSENT_VERSION;
}

export async function clearConsent(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
