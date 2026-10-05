/**
 * lib/api/tokenStore
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent storage for the access and refresh tokens.
 *
 * This is the fix for the single biggest bug in the app. `PCOSAPIService`
 * previously held both tokens in class fields with the persistence commented
 * out:
 *
 *     async setTokens(token, refreshToken) {
 *       this.token = token;
 *       this.refreshToken = refreshToken;
 *       // await AsyncStorage.setItem('authToken', token || '');
 *       // await AsyncStorage.setItem('refreshToken', refreshToken || '');
 *     }
 *
 * So the tokens lived exactly as long as the JS bundle. Every cold start,
 * `authContext` called `getToken()`, got `null`, and redirected to /login —
 * nobody had ever stayed signed in. The whole refresh-rotation system on the
 * backend (hashed secrets, revocation, 30-day TTL) had never executed once,
 * because the refresh token was gone before it could be used.
 *
 * SecureStore rather than AsyncStorage: these are bearer credentials for
 * health data. AsyncStorage is unencrypted on both platforms and readable
 * from a rooted or jailbroken device, or from a filesystem backup. SecureStore
 * is the iOS Keychain and Android EncryptedSharedPreferences.
 *
 * Falls back to AsyncStorage on web, where SecureStore has no implementation —
 * the app is primarily native, and a signed-in web session is better than a
 * crash on load.
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_KEY = "pcos_access_token";
const REFRESH_KEY = "pcos_refresh_token";

const isWeb = Platform.OS === "web";

async function put(key: string, value: string | null): Promise<void> {
  try {
    if (value == null || value === "") {
      if (isWeb) await AsyncStorage.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
      return;
    }
    if (isWeb) await AsyncStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch (error) {
    // A failed write means the user gets signed out on next launch. That is
    // recoverable and not worth crashing over, but it should be visible.
    console.warn(`[TOKENS] Could not persist ${key}:`, error);
  }
}

async function take(key: string): Promise<string | null> {
  try {
    const value = isWeb
      ? await AsyncStorage.getItem(key)
      : await SecureStore.getItemAsync(key);
    return value || null;
  } catch (error) {
    console.warn(`[TOKENS] Could not read ${key}:`, error);
    return null;
  }
}

export const tokenStore = {
  save: (accessToken: string | null, refreshToken: string | null) =>
    Promise.all([put(ACCESS_KEY, accessToken), put(REFRESH_KEY, refreshToken)]).then(
      () => undefined
    ),

  saveAccess: (accessToken: string | null) => put(ACCESS_KEY, accessToken),

  read: async (): Promise<{ accessToken: string | null; refreshToken: string | null }> => {
    const [accessToken, refreshToken] = await Promise.all([
      take(ACCESS_KEY),
      take(REFRESH_KEY),
    ]);
    return { accessToken, refreshToken };
  },

  clear: () => Promise.all([put(ACCESS_KEY, null), put(REFRESH_KEY, null)]).then(() => undefined),
};
