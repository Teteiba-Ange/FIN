# API Configuration for Frontend Integration

This file contains the endpoints and configuration needed to integrate the React Native app with the backend.

## Backend Base URL
```
http://localhost:5000/api
```

## Frontend Integration Points

### 1. Authentication Module
```javascript
const API_BASE = "http://localhost:5000/api";

// Signup
POST /auth/signup
Body: { email, password, fullName }
Response: { user, token }

// Login
POST /auth/login
Body: { email, password }
Response: { user, token }
```

### 2. User Management
```javascript
// Get profile (requires token)
GET /users/profile
Headers: { Authorization: "Bearer TOKEN" }

// Update profile
PUT /users/profile
Headers: { Authorization: "Bearer TOKEN" }
Body: { fullName, age, weight, height }
```

### 3. Symptom Recording
```javascript
// Record symptoms
POST /symptoms/record
Headers: { Authorization: "Bearer TOKEN" }
Body: {
  cycleRegularity, avgCycleLength, lastPeriod,
  symptoms: [], exerciseHabit, fastFoodFrequency,
  maritalStatus, familyHistory: [], medicalBackground, medicalTags: []
}

// Get symptom history
GET /symptoms/history
Headers: { Authorization: "Bearer TOKEN" }

// Get latest symptoms
GET /symptoms/latest
Headers: { Authorization: "Bearer TOKEN" }
```

### 4. Report Upload
```javascript
// Upload report
POST /reports/upload
Headers: { Authorization: "Bearer TOKEN", Content-Type: multipart/form-data }
Form Data: { file: <File> }

// Get reports
GET /reports
Headers: { Authorization: "Bearer TOKEN" }

// Delete report
DELETE /reports/:reportId
Headers: { Authorization: "Bearer TOKEN" }
```

### 5. Community Forum
```javascript
// Create post
POST /posts
Headers: { Authorization: "Bearer TOKEN" }
Body: { content, anonymous }

// Get all posts
GET /posts

// Like post
POST /posts/:postId/like

// Add comment
POST /posts/:postId/comments
Headers: { Authorization: "Bearer TOKEN" }
Body: { text, anonymous }

// Get comments
GET /posts/:postId/comments
```

### 6. PCOS Predictions
```javascript
// Get prediction
POST /predictions/predict
Headers: { Authorization: "Bearer TOKEN" }
Body: { symptoms: {} }

// Get history
GET /predictions/history
Headers: { Authorization: "Bearer TOKEN" }

// Get latest
GET /predictions/latest
Headers: { Authorization: "Bearer TOKEN" }
```

## Token Management

Tokens are returned from login/signup responses. Store them securely in AsyncStorage:

```javascript
// Save token
await AsyncStorage.setItem("authToken", token);

// Retrieve token for API calls
const token = await AsyncStorage.getItem("authToken");
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }
});
```

## Error Handling

All endpoints return standard HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad request
- 401: Unauthorized (missing/invalid token)
- 404: Not found
- 409: Conflict (email exists)
- 500: Server error

Response format for errors:
```json
{ "error": "Error message" }
```

## CORS Configuration

Backend is configured with CORS enabled. No additional headers needed for development.

## File Upload

Report uploads support:
- Max size: 10MB
- Types: PDF, JPEG, PNG

Use FormData for file uploads:
```javascript
const formData = new FormData();
formData.append("file", {
  uri: "file://path/to/file",
  type: "application/pdf",
  name: "report.pdf"
});

await fetch(`${API_BASE}/reports/upload`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData
});
```

## Development Testing

Use these curl commands to test endpoints:

```bash
# Signup
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass","fullName":"User"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"pass"}'

# Get posts
curl http://localhost:5000/api/posts
```
