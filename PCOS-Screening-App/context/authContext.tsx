import React, { createContext, useContext, useState, useEffect } from "react";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import apiService from "./apiService";

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
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for stored token on app start
    const initializeAuth = async () => {
      try {
        const storedToken = await apiService.getToken();
        if (storedToken) {
          setToken(storedToken);
          // Try to get user profile
          try {
            const profile = await apiService.getProfile();
            setUser(profile);
          } catch (error) {
            // Token might be invalid, clear it
            console.log("Token invalid, clearing auth");
            await apiService.setToken("");
            setToken(null);
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const response = await apiService.login(normalizedEmail, password);
      setUser(response.user);
      const currentToken = await apiService.getToken();
      setToken(currentToken);
      console.log("Login successful:", response.user.fullName);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const signup = async (email: string, password: string, fullName: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const response = await apiService.signup(normalizedEmail, password, fullName);
      setUser(response.user);
      const currentToken = await apiService.getToken();
      setToken(currentToken);
      console.log("Signup successful:", response.user.fullName);
    } catch (error) {
      console.error("Signup error:", error);
      throw error;
    }
  };

  const parseJwt = (token: string) => {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = typeof atob === "function"
        ? atob(base64)
        : typeof Buffer !== "undefined"
        ? Buffer.from(base64, "base64").toString("binary")
        : null;

      if (!decoded) {
        return null;
      }

      const jsonPayload = decodeURIComponent(
        decoded
          .split("")
          .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join("")
      );

      return JSON.parse(jsonPayload) as Record<string, any>;
    } catch (error) {
      return null;
    }
  };

  const socialAuth = async (provider: "google" | "facebook", mode: "login" | "signup") => {
    const appConfig = Constants.expoConfig || Constants.manifest;
    const googleClientId = appConfig?.extra?.googleClientId || "YOUR_GOOGLE_CLIENT_ID";
    const facebookAppId = appConfig?.extra?.facebookAppId || "YOUR_FACEBOOK_APP_ID";
    const redirectUri = AuthSession.makeRedirectUri({ useProxy: true, scheme: "pcosscreeningapp" });
    let authUrl = "";
    let token: string | null = null;
    let userInfo: { email?: string; name?: string; id?: string } | null = null;
    const nonce = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);

    if (provider === "google") {
      if (!googleClientId || googleClientId === "YOUR_GOOGLE_CLIENT_ID") {
        throw new Error("Google Client ID is not configured.");
      }
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=id_token&client_id=${encodeURIComponent(
        googleClientId
      )}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(
        "openid email profile"
      )}&nonce=${encodeURIComponent(nonce)}&prompt=select_account`;

      const result = await AuthSession.startAsync({ authUrl, returnUrl: redirectUri });
      if (result.type !== "success" || !result.params?.id_token) {
        throw new Error("Google authentication was cancelled or failed.");
      }
      token = result.params.id_token as string;
      const decoded = parseJwt(token);
      if (!decoded || !decoded.email || !decoded.email_verified) {
        throw new Error("Google ID token did not return a verified email.");
      }
      if (decoded.aud !== googleClientId) {
        throw new Error("Google ID token audience mismatch.");
      }
      if (decoded.iss !== "https://accounts.google.com" && decoded.iss !== "accounts.google.com") {
        throw new Error("Google ID token issuer mismatch.");
      }
      userInfo = {
        email: decoded.email,
        name: decoded.name || decoded.given_name || decoded.email,
        id: decoded.sub,
      };
    }

    if (provider === "facebook") {
      if (!facebookAppId || facebookAppId === "YOUR_FACEBOOK_APP_ID") {
        throw new Error("Facebook App ID is not configured.");
      }
      authUrl = `https://www.facebook.com/v15.0/dialog/oauth?client_id=${encodeURIComponent(
        facebookAppId
      )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(
        "email,public_profile"
      )}`;

      const result = await AuthSession.startAsync({ authUrl, returnUrl: redirectUri });
      if (result.type !== "success" || !result.params?.access_token) {
        throw new Error("Facebook authentication was cancelled or failed.");
      }
      token = result.params.access_token as string;
      const profileResponse = await fetch(
        `https://graph.facebook.com/me?access_token=${encodeURIComponent(token)}&fields=id,name,email`
      );
      if (!profileResponse.ok) {
        throw new Error("Unable to verify Facebook profile.");
      }
      const profileJson = await profileResponse.json();
      if (!profileJson.email) {
        throw new Error("Facebook login did not return a verified email.");
      }
      userInfo = {
        email: profileJson.email,
        name: profileJson.name,
        id: profileJson.id,
      };
    }

    if (!userInfo || !userInfo.email) {
      throw new Error("Unable to verify social account email.");
    }

    const socialUser: User = {
      id: userInfo.id || `${provider}-${mode}-user`,
      email: userInfo.email,
      fullName: userInfo.name || userInfo.email,
    };
    setUser(socialUser);
    setToken(token || `${provider}-${mode}-token`);
    await apiService.setToken(token || `${provider}-${mode}-token`);
    console.log(`Social ${mode} with ${provider} succeeded`);
  };

  const logout = async () => {
    try {
      const rToken = await apiService.getRefreshToken();
      if (rToken) {
        try {
          await apiService.logout();
        } catch (err) {
          console.warn("Logout server call failed:", err);
        }
      }
    } catch (err) {
      console.warn("Logout failed to notify server:", err);
    }
    setUser(null);
    setToken(null);
    await apiService.setTokens(null, null);
    console.log("Logged out");
  };

  const updateProfile = async (updates: Partial<User>) => {
    try {
      await apiService.updateProfile(
        updates.fullName || "",
        updates.age !== undefined ? String(updates.age) : "",
        updates.weight !== undefined ? String(updates.weight) : "",
        updates.height !== undefined ? String(updates.height) : ""
      );
      // Refresh profile after update
      await refreshProfile();
    } catch (error) {
      console.error("Profile update error:", error);
      throw error;
    }
  };

  const setAvatarUri = async (uri: string) => {
    if (!user) return;
    setUser({ ...user, avatarUri: uri });
  };

  const refreshProfile = async () => {
    try {
      const profile = await apiService.getProfile();
      setUser(profile);
    } catch (error) {
      console.error("Profile refresh error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        signup,
        socialAuth,
        logout,
        updateProfile,
        setAvatarUri,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);