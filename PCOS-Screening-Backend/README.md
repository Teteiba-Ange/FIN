# PCOS Screening Backend

A robust Node.js/Express backend for the PCOS Screening and Monitoring Application. This backend handles authentication, user profiles, symptom tracking, report storage, community forums, and PCOS risk predictions.

## Features

- **Authentication**: JWT-based user authentication with secure password hashing
- **User Profiles**: User data management (age, weight, height, medical info)
- **Symptom Recording**: Store and track PCOS-related symptoms over time
- **Report Management**: Upload, store, and manage medical reports (PDF/images)
- **Community Forum**: Post creation, comments, likes, and anonymous posting
- **PCOS Risk Prediction**: Integration with trained ML models for risk assessment
- **Data Persistence**: SQLite database for offline-first capability
- **File Upload**: Secure file handling with validation

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3
- **Authentication**: JWT (jsonwebtoken)
- **Security**: bcryptjs for password hashing
- **File Handling**: Multer

## Installation

1. **Clone the repository and navigate to backend folder:**
   ```bash
   cd PCOS-Screening-Backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Update `.env` with your configuration:**
   ```
   PORT=5000
   NODE_ENV=development
   JWT_SECRET=your_super_secret_jwt_key_change_in_production
   JWT_EXPIRE=7d
   DATABASE_PATH=./data/pcos.db
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=10485760
   ```

## Running the Server

**Development Mode (with hot reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The server will start on `http://localhost:5000` by default.

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/login` | Login user and get JWT token |

**Signup Example:**
```json
POST /api/auth/signup
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Doe"
}
```

**Login Example:**
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### User Profile

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| GET | `/api/users/profile` | Get user profile | Yes |
| PUT | `/api/users/profile` | Update user profile | Yes |

**Update Profile Example:**
```json
PUT /api/users/profile
{
  "fullName": "Jane Doe",
  "age": 28,
  "weight": 65.5,
  "height": 165
}
```

### Symptom Recording

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/api/symptoms/record` | Record user symptoms | Yes |
| GET | `/api/symptoms/latest` | Get latest symptom record | Yes |
| GET | `/api/symptoms/history` | Get symptom history | Yes |

**Record Symptoms Example:**
```json
POST /api/symptoms/record
{
  "cycleRegularity": "Irregular",
  "avgCycleLength": 35,
  "lastPeriod": "2024-05-01",
  "symptoms": ["acne", "hair_growth"],
  "exerciseHabit": "Moderate",
  "fastFoodFrequency": "1-2x/week",
  "maritalStatus": "Single",
  "familyHistory": ["diabetes"],
  "medicalBackground": "Family history of diabetes",
  "medicalTags": ["Insulin Resistance"]
}
```

### Report Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/api/reports/upload` | Upload a medical report | Yes |
| GET | `/api/reports` | Get user's reports | Yes |
| DELETE | `/api/reports/:reportId` | Delete a report | Yes |

**Upload Report:**
```
POST /api/reports/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: <binary file data>
```

### Community Forum

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/api/posts` | Create a new post | Yes |
| GET | `/api/posts` | Get all posts | No |
| POST | `/api/posts/:postId/like` | Like a post | No |
| POST | `/api/posts/:postId/comments` | Add comment to post | Yes |
| GET | `/api/posts/:postId/comments` | Get post comments | No |

**Create Post Example:**
```json
POST /api/posts
{
  "content": "Has anyone tried keto diet for PCOS?",
  "anonymous": false
}
```

**Add Comment Example:**
```json
POST /api/posts/:postId/comments
{
  "text": "Yes, I've had great results with keto!",
  "anonymous": false
}
```

### PCOS Risk Prediction

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---|
| POST | `/api/predictions/predict` | Get PCOS risk prediction | Yes |
| GET | `/api/predictions/latest` | Get latest prediction | Yes |
| GET | `/api/predictions/history` | Get prediction history | Yes |

**Predict Risk Example:**
```json
POST /api/predictions/predict
{
  "symptoms": {
    "cycleRegularity": "Irregular",
    "acne": true,
    "hairGrowth": true,
    "weight": 72,
    "bmi": 27.4
  }
}
```

## Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <token>
```

The token is returned during login/signup and is valid for 7 days by default.

## Database Schema

### Users
- id (UUID)
- email (unique)
- password (hashed)
- fullName
- age, weight, height
- createdAt, updatedAt

### Symptoms
- id (UUID)
- userId (foreign key)
- cycleRegularity, avgCycleLength, lastPeriod
- symptoms (JSON array)
- exerciseHabit, fastFoodFrequency, maritalStatus
- familyHistory, medicalBackground, medicalTags (JSON)
- recordedDate

### Reports
- id (UUID)
- userId (foreign key)
- fileName, fileUrl
- uploadedAt

### Posts
- id (UUID)
- userId (foreign key)
- username, content
- anonymous (boolean)
- likes, createdAt, updatedAt

### Comments
- id (UUID)
- postId, userId (foreign keys)
- username, text
- anonymous (boolean)
- createdAt

### Predictions
- id (UUID)
- userId (foreign key)
- score (risk percentage)
- riskLevel (Low/Moderate/High)
- predictedAt

## File Upload Configuration

- **Max file size**: 10MB (configurable in .env)
- **Allowed types**: PDF, JPEG, PNG
- **Storage location**: `./uploads` directory

## ML Model Integration

The prediction endpoint is ready to integrate with the trained ML model. Update `src/controllers/predictionController.js` with actual model inference logic:

```javascript
// Import your trained model
const model = require('../../path/to/trained/model');

const predictPCOSRisk = async (req, res) => {
  // Use model to make prediction
  const prediction = model.predict(symptoms);
  // ... rest of logic
};
```

## Error Handling

The API returns standard HTTP status codes:

- **200**: Success
- **201**: Created
- **400**: Bad request
- **401**: Unauthorized
- **404**: Not found
- **409**: Conflict (e.g., email already exists)
- **500**: Server error

## Health Check

Check if the server is running:

```
GET /health
```

Response:
```json
{
  "status": "Backend is running",
  "timestamp": "2024-05-07T10:30:00.000Z"
}
```

## Security Best Practices

1. Change `JWT_SECRET` in production
2. Use HTTPS in production
3. Validate all user inputs
4. Implement rate limiting for authentication endpoints
5. Use environment variables for sensitive data
6. Keep dependencies updated

## Troubleshooting

**Port already in use:**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

**Database locked:**
- Ensure only one instance is running
- Delete `pcos.db` and restart if corrupted

**File upload fails:**
- Check upload directory permissions
- Verify `MAX_FILE_SIZE` setting

## Development

The backend uses:
- **Nodemon** for hot reloading during development
- **SQLite** for local development database

Install dev dependencies:
```bash
npm install --save-dev nodemon
```

## Next Steps

1. Integrate actual ML model for PCOS predictions
2. Add email notifications
3. Implement data export functionality
4. Add API documentation (Swagger/OpenAPI)
5. Set up CI/CD pipeline
6. Add comprehensive test suite

## License

ISC

## Support

For issues or questions, please refer to the project documentation or contact the development team.
