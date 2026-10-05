// API Service for React Native PCOS App
import { Platform } from "react-native";
import Constants from "expo-constants";

import { tokenStore } from "./tokenStore";

/**
 * Base URL resolution.
 *
 * `EXPO_PUBLIC_API_URL` is the only value that works in a real build. The
 * previous code read `process.env.API_PORT`, which Expo does not inline into
 * the bundle without the `EXPO_PUBLIC_` prefix — so it was always `undefined`
 * and silently fell through to the default. The emulator paths below are a
 * development convenience only; `10.0.2.2` is an Android-emulator loopback
 * alias that does not resolve on a physical device.
 *
 * Set it per build profile in eas.json. See G-03 in PLAN.md.
 */
const getApiBase = () => {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const API_PORT = process.env.EXPO_PUBLIC_API_PORT || "5000";

  // Metro tells us the host it is being served from, which is the dev
  // machine's LAN address — the one a physical device can actually reach.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;

  const host =
    typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;

  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${API_PORT}/api`;
  }

  if (Platform.OS === "android") return `http://10.0.2.2:${API_PORT}/api`;
  return `http://127.0.0.1:${API_PORT}/api`;
};

const API_BASE = getApiBase();

/** The server root, without the `/api` suffix — where static files are served. */
const SERVER_ROOT = API_BASE.replace(/\/api\/?$/, "");

/**
 * Turns the server's relative `/avatars/…` path into something `<Image>` can
 * load, and defeats the cache.
 *
 * The backend names every avatar `avatar-<userId>.<ext>`, so a user who
 * replaces their picture gets the *same URL* back. Without a changing query
 * string the app would keep showing the old image from cache — the upload
 * appears to have silently failed.
 */
export function resolveAssetUrl(
  relativePath: string | null | undefined,
  version?: string | number
): string | null {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;

  const path = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  const bust = version ? `?v=${encodeURIComponent(String(version))}` : "";
  return `${SERVER_ROOT}${path}${bust}`;
}

/**
 * Mirrors the shape in `lib/storage`. `communityActivity` was dropped when the
 * reminder switches were made real — it needed server push, which does not
 * exist. The backend still has a column for it and will simply store 0; the
 * app neither sends nor reads it. (C-01 in PLAN.md.)
 *
 * `symptomTime` is sent but ignored by the current backend, which destructures
 * a fixed set of fields. Harmless, and it means the preference syncs the moment
 * the server learns about it.
 */
export type NotificationSettings = {
  symptomReminder: boolean;
  symptomTime: { hour: number; minute: number };
  cycleReminder: boolean;
  wellnessTips: boolean;
};

export type ShapFeature = {
  feature: string;
  shap_value: number;
  direction: "increases" | "decreases";
  explanation: string;
};

export type Prediction = {
  id: string;
  score: number;
  riskLevel: string | null;
  /** ISO timestamp. */
  predictedAt: string | null;
  topFeatures: ShapFeature[];
};

/**
 * A-05 — SQLite and Postgres disagree on identifier casing, so the same row
 * arrives as `predictedAt` from one and `predictedat` from the other. The
 * workaround (`p.predictedAt ?? p.predictedat`) had leaked into two screens.
 *
 * Normalising here means screens never need to know which database is behind
 * the endpoint, and a third spelling only has to be handled once.
 */
function normalisePrediction(row: any): Prediction {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      if (row?.[key] != null) return row[key];
    }
    return null;
  };

  const rawFeatures = pick("topFeatures", "topfeatures", "top_features");
  let topFeatures: ShapFeature[] = [];
  if (Array.isArray(rawFeatures)) {
    topFeatures = rawFeatures;
  } else if (typeof rawFeatures === "string") {
    // Stored as a JSON column; some drivers hand it back as text.
    try {
      const parsed = JSON.parse(rawFeatures);
      if (Array.isArray(parsed)) topFeatures = parsed;
    } catch {
      /* Malformed attributions are dropped rather than shown as garbage. */
    }
  }

  return {
    id: String(pick("id") ?? ""),
    score: Number(pick("score") ?? 0),
    riskLevel: pick("riskLevel", "risklevel"),
    predictedAt: pick("predictedAt", "predictedat", "predicted_at"),
    topFeatures,
  };
}

class PCOSAPIService {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshing: Promise<boolean> | null = null;
  /** Resolves once the persisted tokens have been read back into memory. */
  private hydration: Promise<void> | null = null;

  /**
   * Loads the stored tokens into memory. Idempotent and safe to await from
   * anywhere — the first caller does the read and everyone else joins it.
   *
   * This is what makes a session survive a restart. Without it the class
   * fields start as null on every launch and the auth gate bounces the user
   * to /login regardless of what is in the keychain.
   */
  private hydrate(): Promise<void> {
    if (!this.hydration) {
      this.hydration = tokenStore.read().then(({ accessToken, refreshToken }) => {
        // Never let a stored value clobber a fresher in-memory one — a login
        // completing while this read is in flight must win.
        if (this.token == null) this.token = accessToken;
        if (this.refreshToken == null) this.refreshToken = refreshToken;
      });
    }
    return this.hydration;
  }

  /** Call once at startup, before the auth gate decides where to send the user. */
  async restoreSession(): Promise<string | null> {
    await this.hydrate();
    return this.token;
  }

  async setTokens(token: string | null, refreshToken: string | null) {
    this.token = token;
    this.refreshToken = refreshToken;
    // Mark hydration as settled: we now hold the authoritative values, and a
    // late read must not overwrite them.
    this.hydration = Promise.resolve();
    await tokenStore.save(token, refreshToken);
  }

  async setToken(token: string | null) {
    this.token = token;
    await tokenStore.saveAccess(token);
  }

  async getToken(): Promise<string | null> {
    await this.hydrate();
    return this.token;
  }

  async getRefreshToken(): Promise<string | null> {
    await this.hydrate();
    return this.refreshToken;
  }

  // Try to refresh tokens using refresh token; ensures single inflight refresh
  private async ensureRefreshed(): Promise<boolean> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const rToken = await this.getRefreshToken();
      if (!rToken) return false;
      try {
        const resp = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rToken }),
        });
        if (!resp.ok) return false;
        const data = await resp.json();
        await this.setTokens(data.token, data.refreshToken);
        return true;
      } catch (err) {
        return false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  // Request wrapper with auth and auto-refresh on 401
  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    let token = await this.getToken();
    const headers = new Headers({
      "Content-Type": "application/json",
    });

    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => headers.set(key, value));
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => headers.set(key, String(value)));
      } else {
        Object.entries(options.headers).forEach(([key, value]) => {
          headers.set(key, String(value));
        });
      }
    }

    if (token) headers.set("Authorization", `Bearer ${token}`);

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (error: any) {
      throw new Error(`Network Error: ${error.message || "Unable to connect"}`);
    }

    if (response.status === 401) {
      // Try refresh once
      const refreshed = await this.ensureRefreshed();
      if (refreshed) {
        token = await this.getToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);
        response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // AUTH
  async signup(email: string, password: string, fullName: string) {
    const data = await this.request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, fullName }),
    });

    if (data.token) {
      await this.setTokens(data.token, data.refreshToken || null);
    }

    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data.token) {
      await this.setTokens(data.token, data.refreshToken || null);
    }

    return data;
  }

  // USER PROFILE
  async getProfile() {
    return this.request("/users/profile");
  }

  async updateProfile(fullName: string, age: string, weight: string, height: string) {
    return this.request("/users/profile", {
      method: "PUT",
      body: JSON.stringify({ fullName, age, weight, height }),
    });
  }

  /**
   * Uploads a profile picture.
   *
   * Sent as multipart rather than through `request()`, which sets a JSON
   * content type — letting `fetch` build the boundary itself is the only way
   * the server can parse it.
   *
   * The server caps this at 5MB and accepts JPEG, PNG and WebP only, so the
   * caller should compress before sending rather than discovering the limit
   * as a 500 after a slow upload on mobile data.
   */
  async uploadAvatar(
    fileUri: string
  ): Promise<{ success: boolean; profilePicture: string }> {
    const token = await this.getToken();

    const extension = (fileUri.split(".").pop() || "jpg").toLowerCase();
    const mimeType =
      extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";

    const form = new FormData();
    form.append("profilePicture", {
      uri: fileUri,
      name: `avatar.${extension === "jpeg" ? "jpg" : extension}`,
      type: mimeType,
    } as any);

    const headers = new Headers();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API_BASE}/users/profile/picture`, {
      method: "PUT",
      body: form,
      headers,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: `Upload failed (${response.status})` }));
      throw new Error(error.error || `Upload failed (${response.status})`);
    }

    return response.json();
  }

  // DATA RIGHTS (G-06)
  /** Everything the server holds about this user, decrypted, as one document. */
  async exportMyData(): Promise<Record<string, unknown>> {
    return this.request("/users/export");
  }

  /**
   * Permanently deletes the account and every record attached to it.
   * Requires the current password — a stolen session must not be enough.
   */
  async deleteMyAccount(password: string) {
    return this.request("/users/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    });
  }

  // NOTIFICATIONS
  /**
   * Registers this device's Expo push token against the signed-in user.
   * Backend: POST /api/users/push-token
   */
  async savePushToken(token: string) {
    return this.request("/users/push-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  /** Backend: GET /api/users/notification-settings */
  async getNotificationSettings(): Promise<NotificationSettings> {
    return this.request("/users/notification-settings");
  }

  /** Backend: PUT /api/users/notification-settings */
  async saveNotificationSettings(settings: NotificationSettings) {
    return this.request("/users/notification-settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  // FORUM
  async getPosts() {
    return this.request("/posts");
  }

  async createPost(content: string, anonymous: boolean) {
    return this.request("/posts", {
      method: "POST",
      body: JSON.stringify({ content, anonymous }),
    });
  }

  async likePost(postId: string) {
    return this.request(`/posts/${postId}/like`, {
      method: "POST",
    });
  }

  async addComment(postId: string, text: string, anonymous: boolean) {
    return this.request(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text, anonymous }),
    });
  }

  async getPostComments(postId: string) {
    return this.request(`/posts/${postId}/comments`);
  }

  async deletePost(postId: string) {
    return this.request(`/posts/${postId}`, {
      method: "DELETE",
    });
  }

  async deleteComment(postId: string, commentId: string) {
    return this.request(`/posts/${postId}/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  // REPORTS
  async uploadReport(fileUri: string, reportType: string) {
    const token = await this.getToken();
    const formData = new FormData();
    const fileName = fileUri.split("/").pop() || `report-${Date.now()}.pdf`;
    const extension = fileName.split(".").pop()?.toLowerCase() || "pdf";
    let mimeType = "application/pdf";

    if (extension === "png") mimeType = "image/png";
    else if (extension === "jpg" || extension === "jpeg") mimeType = "image/jpeg";

    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);
    formData.append("reportType", reportType);

    const headers = new Headers();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}/reports/upload`, {
      method: "POST",
      body: formData,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(error.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  }

  async getReports() {
    return this.request("/reports");
  }

  async deleteReport(reportId: string) {
    return this.request(`/reports/${reportId}`, {
      method: "DELETE",
    });
  }

  // DAILY LOGS (A-02)
  /**
   * Drains the client's write-ahead queue in one round trip. Each operation
   * comes back individually as ok / rejected / retry — see `lib/sync/queue`.
   */
  async syncLogs(
    operations: {
      opId: string;
      kind: string;
      action: string;
      payload: Record<string, unknown>;
    }[]
  ): Promise<{ results: { opId: string; status: "ok" | "rejected" | "retry"; error?: string }[] }> {
    return this.request("/logs/sync", {
      method: "POST",
      body: JSON.stringify({ operations }),
    });
  }

  /** Everything the device needs to rebuild its local cache after a reinstall. */
  async getAllLogs(): Promise<{
    symptoms: any[];
    cycles: any[];
    moods: any[];
  }> {
    return this.request("/logs");
  }

  // SYMPTOMS (assessment snapshot — distinct from the daily logs above)
  async recordSymptoms(payload: Record<string, any>) {
    return this.request("/symptoms/record", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getSymptomHistory() {
    return this.request("/symptoms/history");
  }

  async getLatestSymptoms() {
    return this.request("/symptoms/latest");
  }

  // PREDICTIONS
  async predictPCOSRisk(symptoms: any) {
    return this.request("/predictions/predict", {
      method: "POST",
      body: JSON.stringify({ symptoms }),
    });
  }

  /**
   * Personalised guidance for a completed assessment.
   *
   * Deliberately a separate call from `predictPCOSRisk` — the score must never
   * wait on a language model. `suggestions: null` means generation was
   * unavailable and the caller should use its built-in suggestions; that is a
   * normal outcome, not an error.
   */
  async getRecommendations(answers: Record<string, unknown>): Promise<{
    suggestions: { title: string; body: string; icon: string }[] | null;
    generated: boolean;
  }> {
    return this.request("/predictions/recommendations", {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  }

  async getPredictionHistory(): Promise<Prediction[]> {
    const rows = await this.request("/predictions/history");
    return (Array.isArray(rows) ? rows : []).map(normalisePrediction);
  }

  async getLatestPrediction(): Promise<Prediction | null> {
    try {
      return normalisePrediction(await this.request("/predictions/latest"));
    } catch (error: any) {
      // The endpoint 404s when the user has never been assessed. That is a
      // normal state, not a failure, and callers shouldn't have to tell the
      // difference between it and the server being down.
      if (error?.message?.includes("404") || error?.message?.includes("No predictions")) {
        return null;
      }
      throw error;
    }
  }

  async logout() {
    try {
      const r = await this.getRefreshToken();
      if (!r) return;
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: r }),
      });
    } finally {
      await this.setTokens(null, null);
    }
  }
}

// Export singleton instance
const apiService = new PCOSAPIService();
export default apiService;