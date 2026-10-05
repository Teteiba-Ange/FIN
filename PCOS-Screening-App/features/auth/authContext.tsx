// features/auth/authContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { apiService } from "@/lib/api";
import { registerForPushNotifications } from "@/lib/notifications";
import { pullFromServer, clearLocalLogs, syncNow } from "@/lib/logs";

// Required for expo-auth-session on Android to close the browser after redirect
WebBrowser.maybeCompleteAuthSession();

export interface User {
  id: string;
  email: string;
  fullName: string;
  age?: string | number;
  weight?: string | number;
  height?: string | number;
  /**
   * Server-relative path, e.g. "/avatars/avatar-abc.jpg". Resolve to a
   * loadable URL with `resolveAssetUrl` from `@/lib/api` — it prefixes the
   * host and adds a cache-buster, which matters because the server reuses the
   * same filename for every upload by the same user.
   */
  profilePicture?: string | null;
  /** @deprecated Local-only field kept for older callers. Use `profilePicture`. */
  avatarUri?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  socialAuth: (provider: "google" | "facebook", mode: "login" | "signup") => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  /** Uploads a picked image and refreshes the profile. Throws on failure. */
  uploadAvatar: (fileUri: string) => Promise<void>;
  setAvatarUri: (uri: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Changes on every successful avatar upload, to bust the image cache. */
  avatarVersion: number;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  socialAuth: async () => {},
  logout: () => {},
  updateProfile: async () => {},
  uploadAvatar: async () => {},
  setAvatarUri: async () => {},
  refreshProfile: async () => {},
  avatarVersion: 0,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped on every successful avatar upload. The server reuses one filename
  // per user, so without this the cached old image keeps being shown.
  const [avatarVersion, setAvatarVersion] = useState(0);

  // ── Init auth on app start ────────────────────────────────────────────────
  /**
   * Reads the tokens back out of the keychain and re-establishes the session.
   *
   * Before A-01 this was decorative: `getToken()` returned an in-memory field
   * that was always null on a cold start, so the branch below never ran and
   * every launch redirected to /login. Now that tokens persist, this is what
   * actually keeps someone signed in.
   */
  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        const storedToken = await apiService.restoreSession();
        if (!storedToken || cancelled) return;

        setToken(storedToken);

        try {
          const profile = await apiService.getProfile();
          if (!cancelled) setUser(profile);
        } catch (error: any) {
          // A network failure is not an invalid token. Clearing the session
          // because the user opened the app on a train would sign them out
          // and lose the refresh token with it.
          if (error?.message?.startsWith("Network")) {
            console.warn("[AUTH] Offline at startup — keeping stored session");
            return;
          }
          // The request wrapper already tried a refresh before surfacing this,
          // so reaching here means both tokens are genuinely dead.
          console.log("[AUTH] Stored session rejected — clearing");
          await apiService.setTokens(null, null);
          if (!cancelled) setToken(null);
        }
      } catch (error) {
        console.error("[AUTH] Init error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Register push token silently (never blocks login) ────────────────────
  const registerPush = () => {
    registerForPushNotifications().catch((err) =>
      console.warn("[AUTH] Push registration failed silently:", err)
    );
  };

  /**
   * Pulls the account's health logs down to the device (A-02). This is what
   * makes a reinstall or a new phone recover the user's history instead of
   * presenting an empty app. Never blocks sign-in — offline just means the
   * local cache stays as it is until the next pull.
   */
  const restoreLogs = () => {
    pullFromServer().catch((err) =>
      console.warn("[AUTH] Could not pull logs (non-fatal):", err)
    );
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const response = await apiService.login(email.trim().toLowerCase(), password);
    setUser(response.user);
    setToken(await apiService.getToken());
    console.log("[AUTH] Login successful");
    registerPush();
    restoreLogs();
  };

  // ── Signup ────────────────────────────────────────────────────────────────
  const signup = async (email: string, password: string, fullName: string) => {
    const response = await apiService.signup(email.trim().toLowerCase(), password, fullName);
    setUser(response.user);
    setToken(await apiService.getToken());
    console.log("[AUTH] Signup successful");
    registerPush();
  };

  // ── JWT decoder helper ────────────────────────────────────────────────────
  const parseJwt = (rawToken: string): Record<string, any> | null => {
    try {
      const base64Url = rawToken.split(".")[1];
      const base64    = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const decoded   =
        typeof atob === "function"
          ? atob(base64)
          : Buffer.from(base64, "base64").toString("binary");
      if (!decoded) return null;
      const json = decodeURIComponent(
        decoded
          .split("")
          .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join("")
      );
      return JSON.parse(json);
    } catch {
      return null;
    }
  };

  // ── Social auth ───────────────────────────────────────────────────────────
  const socialAuth = async (
    provider: "google" | "facebook",
    mode: "login" | "signup"
  ) => {
    const appConfig      = Constants.expoConfig ?? (Constants as any).manifest;
    const googleClientId = appConfig?.extra?.googleClientId ?? "YOUR_GOOGLE_CLIENT_ID";
    const facebookAppId  = appConfig?.extra?.facebookAppId  ?? "YOUR_FACEBOOK_APP_ID";

    // ── FIX 1: useProxy removed — use scheme-based redirect instead ──────────
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: "pcosscreeningapp",   // must match your app.json scheme
    });

    let socialToken: string | null = null;
    let userInfo: { email?: string; name?: string; id?: string } | null = null;
    const nonce = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

    // ── Google ────────────────────────────────────────────────────────────────
    if (provider === "google") {
      if (!googleClientId || googleClientId === "YOUR_GOOGLE_CLIENT_ID")
        throw new Error("Google Client ID is not configured in app.json extras.");

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?response_type=id_token` +
        `&client_id=${encodeURIComponent(googleClientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent("openid email profile")}` +
        `&nonce=${encodeURIComponent(nonce)}&prompt=select_account`;

      // ── FIX 2: startAsync is removed — use openAuthSessionAsync instead ────
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== "success")
        throw new Error("Google authentication was cancelled or failed.");

      // Parse id_token from the redirect URL fragment
      const url    = result.url;
      const params = new URLSearchParams(url.split("#")[1] ?? url.split("?")[1] ?? "");
      const idToken = params.get("id_token");

      if (!idToken) throw new Error("Google did not return an id_token.");

      socialToken = idToken;
      const decoded = parseJwt(socialToken);
      if (!decoded?.email || !decoded.email_verified)
        throw new Error("Google did not return a verified email.");

      userInfo = {
        email: decoded.email,
        name:  decoded.name ?? decoded.given_name ?? decoded.email,
        id:    decoded.sub,
      };
    }

    // ── Facebook ──────────────────────────────────────────────────────────────
    if (provider === "facebook") {
      if (!facebookAppId || facebookAppId === "YOUR_FACEBOOK_APP_ID")
        throw new Error("Facebook App ID is not configured in app.json extras.");

      const authUrl =
        `https://www.facebook.com/v15.0/dialog/oauth` +
        `?client_id=${encodeURIComponent(facebookAppId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent("email,public_profile")}`;

      // ── FIX 2 (same): use openAuthSessionAsync ────────────────────────────
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== "success")
        throw new Error("Facebook authentication was cancelled or failed.");

      const url    = result.url;
      const params = new URLSearchParams(url.split("#")[1] ?? url.split("?")[1] ?? "");
      const accessToken = params.get("access_token");

      if (!accessToken) throw new Error("Facebook did not return an access_token.");

      socialToken = accessToken;

      const profileRes = await fetch(
        `https://graph.facebook.com/me?access_token=${encodeURIComponent(socialToken)}&fields=id,name,email`
      );
      if (!profileRes.ok) throw new Error("Unable to verify Facebook profile.");

      const profileJson = await profileRes.json();
      if (!profileJson.email) throw new Error("Facebook did not return an email.");

      userInfo = {
        email: profileJson.email,
        name:  profileJson.name,
        id:    profileJson.id,
      };
    }

    if (!userInfo?.email) throw new Error("Unable to verify social account email.");

    const socialUser: User = {
      id:       userInfo.id ?? `${provider}-user`,
      email:    userInfo.email,
      fullName: userInfo.name ?? userInfo.email,
    };

    setUser(socialUser);
    setToken(socialToken);
    await apiService.setToken(socialToken ?? "");
    registerPush();
    console.log(`[AUTH] Social ${mode} with ${provider} succeeded`);
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    // Push anything still queued before the token is thrown away — after that
    // the writes can never be sent, and clearing below would discard them.
    try {
      await syncNow();
    } catch {
      console.warn("[AUTH] Could not flush pending writes before logout");
    }

    try {
      const rToken = await apiService.getRefreshToken();
      if (rToken) await apiService.logout().catch(() => {});
    } catch {
      /* silent */
    }

    setUser(null);
    setToken(null);
    await apiService.setTokens(null, null);

    // Health data must not remain readable to whoever signs in next on this
    // handset. Safe to clear: the server holds it, and signing back in pulls
    // it down again.
    await clearLocalLogs();
    console.log("[AUTH] Logged out");
  };

  // ── Profile helpers ───────────────────────────────────────────────────────
  const updateProfile = async (updates: Partial<User>) => {
    await apiService.updateProfile(
      updates.fullName ?? "",
      updates.age     != null ? String(updates.age)    : "",
      updates.weight  != null ? String(updates.weight) : "",
      updates.height  != null ? String(updates.height) : ""
    );
    await refreshProfile();
  };

  /**
   * Uploads a profile picture and refreshes the profile from the server.
   *
   * `setAvatarUri` below only ever set local state, so a picture "changed"
   * fine and then vanished on the next launch — nothing was ever sent. The
   * backend endpoint had existed the whole time; nothing called it.
   *
   * The optimistic local update is what makes the change feel instant: the
   * picked file URI is on the device already, so it renders immediately while
   * the upload runs. The refresh afterwards replaces it with the server's
   * path, which is what survives a reinstall.
   */
  const uploadAvatar = async (fileUri: string) => {
    if (!user) throw new Error("You need to be signed in to change your picture.");

    setUser({ ...user, avatarUri: fileUri });

    try {
      const { profilePicture } = await apiService.uploadAvatar(fileUri);
      // Bumped before the refresh so the new URL is requested with a fresh
      // cache-busting value — the filename does not change between uploads.
      setAvatarVersion(Date.now());
      setUser((current) =>
        current ? { ...current, profilePicture, avatarUri: undefined } : current
      );
      await refreshProfile();
    } catch (error) {
      // Roll the optimistic preview back, or the user is left looking at a
      // picture that was never saved.
      setUser((current) => (current ? { ...current, avatarUri: undefined } : current));
      throw error;
    }
  };

  const setAvatarUri = async (uri: string) => {
    if (!user) return;
    setUser({ ...user, avatarUri: uri });
  };

  const refreshProfile = async () => {
    const profile = await apiService.getProfile();
    setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{
        user, token, loading,
        login, signup, socialAuth, logout,
        updateProfile, uploadAvatar, setAvatarUri, refreshProfile,
        avatarVersion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);