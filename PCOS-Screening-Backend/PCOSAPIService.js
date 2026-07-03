// Frontend API Service Example
// This file can be used in the React Native app to interact with the backend

const API_BASE = "http://localhost:5000/api";

class PCOSAPIService {
  constructor() {
    this.token = null;
  }

  // Save token to AsyncStorage and update header
  async setToken(token) {
    this.token = token;
    // AsyncStorage.setItem("authToken", token);
  }

  // Get stored token
  async getToken() {
    if (this.token) return this.token;
    // return AsyncStorage.getItem("authToken");
    return null;
  }

  // Request wrapper with auth
  async request(endpoint, options = {}) {
    const token = await this.getToken();
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // AUTH
  async signup(email, password, fullName) {
    const data = await this.request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, fullName }),
    });

    if (data.token) {
      await this.setToken(data.token);
    }

    return data;
  }

  async login(email, password) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (data.token) {
      await this.setToken(data.token);
    }

    return data;
  }

  // USER PROFILE
  async getProfile() {
    return this.request("/users/profile");
  }

  async updateProfile(fullName, age, weight, height) {
    return this.request("/users/profile", {
      method: "PUT",
      body: JSON.stringify({ fullName, age, weight, height }),
    });
  }

  // SYMPTOMS
  async recordSymptoms(symptomData) {
    return this.request("/symptoms/record", {
      method: "POST",
      body: JSON.stringify(symptomData),
    });
  }

  async getSymptomHistory() {
    return this.request("/symptoms/history");
  }

  async getLatestSymptoms() {
    return this.request("/symptoms/latest");
  }

  // REPORTS
  async uploadReport(fileUri) {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      type: "application/pdf",
      name: `report_${Date.now()}.pdf`,
    });

    const token = await this.getToken();
    const response = await fetch(`${API_BASE}/reports/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    return response.json();
  }

  async getReports() {
    return this.request("/reports");
  }

  async deleteReport(reportId) {
    return this.request(`/reports/${reportId}`, {
      method: "DELETE",
    });
  }

  // POSTS & COMMUNITY
  async createPost(content, anonymous = false) {
    return this.request("/posts", {
      method: "POST",
      body: JSON.stringify({ content, anonymous }),
    });
  }

  async getPosts() {
    return this.request("/posts");
  }

  async likePost(postId) {
    return this.request(`/posts/${postId}/like`, {
      method: "POST",
    });
  }

  async addComment(postId, text, anonymous = false) {
    return this.request(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text, anonymous }),
    });
  }

  async getPostComments(postId) {
    return this.request(`/posts/${postId}/comments`);
  }

  // PREDICTIONS
  async predictPCOSRisk(symptoms) {
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
}

// Export singleton instance
const apiService = new PCOSAPIService();
module.exports = apiService;

// USAGE EXAMPLES:
/*
import apiService from './PCOSAPIService';

// Signup
const result = await apiService.signup('user@email.com', 'password', 'John Doe');

// Login
const result = await apiService.login('user@email.com', 'password');

// Get profile
const profile = await apiService.getProfile();

// Record symptoms
await apiService.recordSymptoms({
  cycleRegularity: 'Irregular',
  avgCycleLength: 35,
  lastPeriod: '2024-05-01',
  symptoms: ['acne', 'hair_growth'],
  // ... other fields
});

// Get PCOS prediction
const prediction = await apiService.predictPCOSRisk({
  cycleRegularity: 'Irregular',
  // ... symptom data
});

// Create forum post
await apiService.createPost('Has anyone tried...?', false);

// Upload report
await apiService.uploadReport('file://path/to/report.pdf');
*/
