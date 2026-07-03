// API Service for React Native PCOS App
import { Platform } from "react-native";
import Constants from "expo-constants";

const getApiBase = () => {
  const API_PORT = process.env.API_PORT || "5000";
  
  if (Platform.OS === "android") {
    // Android emulator
    return `http://10.0.2.2:${API_PORT}/api`;
  }

  const debuggerHost =
    typeof Constants.manifest === "object" && Constants.manifest?.debuggerHost
      ? (Constants.manifest.debuggerHost as string).split(":")[0]
      : undefined;

  if (debuggerHost && debuggerHost !== "localhost" && debuggerHost !== "127.0.0.1") {
    return `http://${debuggerHost}:${API_PORT}/api`;
  }

  return `http://127.0.0.1:${API_PORT}/api`;
};

const API_BASE = getApiBase();

class PCOSAPIService {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  // Save tokens (access + refresh)
  async setTokens(token: string | null, refreshToken: string | null) {
    this.token = token;
    this.refreshToken = refreshToken;
    // Persist with AsyncStorage in real app
    // await AsyncStorage.setItem('authToken', token || '');
    // await AsyncStorage.setItem('refreshToken', refreshToken || '');
  }

  async setToken(token: string | null) {
    this.token = token;
  }

  async getToken(): Promise<string | null> {
    return this.token;
  }

  async getRefreshToken(): Promise<string | null> {
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

  // SYMPTOMS
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

  async getPredictionHistory() {
    return this.request("/predictions/history");
  }

  async getLatestPrediction() {
    return this.request("/predictions/latest");
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