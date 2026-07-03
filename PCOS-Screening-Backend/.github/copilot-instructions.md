# PCOS Backend Project Instructions

## Project Overview
A comprehensive Node.js/Express backend for the PCOS Screening mobile application supporting authentication, user profiles, symptom tracking, medical report storage, community forums, and PCOS risk predictions.

## Setup Checklist

- [x] Project structure scaffolded
- [x] Dependencies configured (Express, SQLite, JWT, Multer, bcryptjs)
- [x] Database schema designed and initialized
- [x] Authentication system (signup/login with JWT)
- [x] User profile management
- [x] Symptom recording and history
- [x] Medical report upload and storage
- [x] Community forum (posts, comments, likes)
- [x] PCOS prediction endpoint (ready for ML model)
- [x] Error handling middleware
- [x] File upload validation
- [x] README documentation

## Installation & Running

1. Navigate to backend: `cd PCOS-Screening-Backend`
2. Install dependencies: `npm install`
3. Copy environment: `cp .env.example .env`
4. Start development: `npm run dev`
5. Server runs on `http://localhost:5000`

## API Structure

### Authentication Routes
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login with JWT token

### Protected Routes (require JWT)
- User Profile: `/api/users/profile`
- Symptoms: `/api/symptoms/*`
- Reports: `/api/reports/*`
- Posts (create): `POST /api/posts`
- Predictions: `/api/predictions/*`

### Public Routes
- Posts (list): `GET /api/posts`
- Comments (list): `GET /api/posts/:postId/comments`
- Health check: `GET /health`

## Key Features

✅ JWT-based authentication
✅ SQLite offline-first database
✅ Secure password hashing (bcryptjs)
✅ File upload with validation
✅ Anonymous posting support
✅ Symptom history tracking
✅ PCOS risk prediction ready
✅ Error handling

## Next Integration Steps

1. **Frontend Integration**: Update React Native app to call these API endpoints
2. **ML Model Integration**: Add trained model to `/predictions/predict` endpoint
3. **Database Scaling**: Consider PostgreSQL for production
4. **Authentication Enhancement**: Add refresh tokens, email verification
5. **Testing**: Implement Jest test suite
6. **Deployment**: Set up Docker, deploy to server

## Database

- Type: SQLite
- Location: `./data/pcos.db`
- Auto-initialized on first run
- Tables: users, symptoms, reports, posts, comments, predictions

## File Uploads

- Location: `./uploads` directory
- Max size: 10MB
- Allowed types: PDF, JPEG, PNG
- Files are validated and stored securely

## Environment Variables

Required in `.env`:
```
PORT=5000
JWT_SECRET=change_in_production
DATABASE_PATH=./data/pcos.db
UPLOAD_DIR=./uploads
```

## Code Organization

```
src/
├── server.js                 # Main entry point
├── config/
│   └── database.js          # SQLite setup
├── middleware/
│   └── auth.js              # JWT verification
├── controllers/
│   ├── authController.js    # Login/Signup
│   ├── userController.js    # Profile management
│   ├── symptomController.js # Symptom recording
│   ├── reportController.js  # File uploads
│   ├── postController.js    # Forum functionality
│   └── predictionController.js # ML predictions
├── routes/
│   ├── auth.js
│   ├── users.js
│   ├── symptoms.js
│   ├── reports.js
│   ├── posts.js
│   └── predictions.js
└── utils/
    └── helpers.js           # Utility functions
```

## Deployment Considerations

- Change JWT_SECRET in production
- Use environment-specific configs
- Enable HTTPS
- Add rate limiting
- Implement logging
- Set up database backups
- Use process manager (PM2)

## Support & Documentation

See README.md for detailed API documentation and examples.
