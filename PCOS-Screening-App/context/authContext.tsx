// context/authContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import apiService from "./apiService";
import { registerForPushNotifications } from "../utils/notifications";

// Required for expo-auth-session on Android to close the browser after redirect
WebBrowser.maybeCompleteAuthSession();

export interface User {
  id: string;
  email: string;
  fullName: string;
  age?: string | number;
  weight?: string | number;
  height?: string | number;
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
  setAvatarUri: (uri: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
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
  setAvatarUri: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Init auth on app start ────────────────────────────────────────────────
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = await apiService.getToken();
        if (storedToken) {
          setToken(storedToken);
          try {
            const profile = await apiService.getProfile();
            setUser(profile);
          } catch {
            console.log("[AUTH] Stored token invalid — clearing");
            await apiService.setToken("");
            setToken(null);
          }
        }
      } catch (error) {
        console.error("[AUTH] Init error:", error);
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);

  // ── Register push token silently (never blocks login) ────────────────────
  const registerPush = () => {
    registerForPushNotifications().catch((err) =>
      console.warn("[AUTH] Push registration failed silently:", err)
    );
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email: string, password: string) => {
    const response = await apiService.login(email.trim().toLowerCase(), password);
    setUser(response.user);
    setToken(await apiService.getToken());
    console.log("[AUTH] Login successful:", response.user.fullName);
    registerPush();
  };

  // ── Signup ────────────────────────────────────────────────────────────────
  const signup = async (email: string, password: string, fullName: string) => {
    const response = await apiService.signup(email.trim().toLowerCase(), password, fullName);
    setUser(response.user);
    setToken(await apiService.getToken());
    console.log("[AUTH] Signup successful:", response.user.fullName);
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
    try {
      const rToken = await apiService.getRefreshToken();
      if (rToken) await apiService.logout().catch(() => {});
    } catch {
      /* silent */
    }
    setUser(null);
    setToken(null);
    await apiService.setTokens(null, null);
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
        updateProfile, setAvatarUri, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);