# Final_Year_Project-PCOS-
# 🌸 PMOS — Polycystic Ovarian Syndrome Management App

> An intelligent mobile application designed to help women track, understand, and manage Polycystic Ovarian Syndrome (PCOS) through symptom monitoring, cycle tracking, and personalised health insights.

---

## 📖 Table of Contents

- [About the Project](#about-the-project)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Screenshots](#screenshots)
- [Contributing](#contributing)
- [Acknowledgements](#acknowledgements)
- [License](#license)

---

## 📌 About the Project

PMOS (Polycystic Ovarian Syndrome Management System) is a final year design science research project developed at the **University of Ghana, School of Computer Science**.

PCOS affects approximately 1 in 10 women of reproductive age globally, yet many go undiagnosed or unsupported due to limited access to personalised health tools. PMOS bridges this gap by providing a user-friendly mobile platform where women can:

- Log and monitor their PCOS-related symptoms over time
- Track menstrual cycles and identify irregularities
- Record hormonal and lab results for personal reference
- Access curated educational content about PCOS management
- Receive reminders for medication, appointments, and cycle events

This project was built following the **Design Science Research Methodology (DSRM)**, producing a working artifact evaluated against real user needs.

---

## ✨ Features

- 🔐 **Secure User Authentication** — Register and log in with encrypted credentials
- 📅 **Menstrual Cycle Tracker** — Log cycle dates and identify patterns over time
- 🩺 **Symptom Logger** — Record daily symptoms such as fatigue, acne, mood changes, and more
- 🧪 **Lab & Hormone Result Tracker** — Store and view hormonal test results (e.g., LH, FSH, testosterone levels)
- 📊 **Health Dashboard** — Visual summaries and trends of your health data
- 📚 **Educational Content Module** — Articles and guides on diet, exercise, and PCOS management
- 🔔 **Smart Reminders** — Push notifications for medications and upcoming cycle events
- 👤 **User Profile Management** — Update personal health information and preferences

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native |
| Backend | Node.js / Express |
| Database | SQLite |
| Authentication | JWT (JSON Web Tokens) |
| API Communication | REST API (Axios) |
| Version Control | Git & GitHub |
| IDE | VS Code |

---

## 🚀 Getting Started

Follow the steps below to set up and run the project locally on your machine.

### Prerequisites

Ensure you have the following installed before proceeding:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [React Native CLI](https://reactnative.dev/docs/environment-setup)
- [Git](https://git-scm.com/)
- Android Studio (for Android emulation) or Xcode (for iOS — Mac only)
- A physical Android/iOS device or emulator set up and running

---

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/your-username/pmos-app.git
cd pmos-app
```

**2. Install frontend dependencies**

```bash
cd frontend
npm install
```

**3. Install backend dependencies**

```bash
cd backend
npm install
```

---

### Running the App

**Step 1 — Start the backend server**

```bash
cd backend
node server.js
```

Or if you have nodemon installed for auto-reloading:

```bash
cd backend
npx nodemon server.js
```

The server will start on `http://localhost:5000` (or whichever port is configured in your `.env` file).

**Step 2 — Start the React Native app**

Open a new terminal window and run:

```bash
cd frontend
npx react-native start
```

Then in another terminal:

```bash
# For Android
npx react-native run-android

# For iOS (Mac only)
npx react-native run-ios
```

> ⚠️ Make sure your Android emulator is running or your physical device is connected via USB with USB debugging enabled before running the above command.

---

## 📁 Project Structure

```
pmos-app/
│
├── frontend/                        # React Native mobile app
│   ├── src/
│   │   ├── screens/                 # App screens (Login, Dashboard, Tracker, etc.)
│   │   ├── components/              # Reusable UI components
│   │   ├── navigation/              # React Navigation configuration
│   │   ├── services/                # API call functions (Axios)
│   │   └── assets/                  # Images, icons, and fonts
│   ├── App.js                       # Root component
│   └── package.json                 # Frontend dependencies
│
├── backend/                         # Node.js / Express server
│   ├── routes/                      # API route definitions
│   ├── controllers/                 # Request handling logic
│   ├── models/                      # SQLite database models
│   ├── middleware/                  # Auth middleware (JWT verification)
│   ├── database/
│   │   └── pmos.db                  # SQLite database file
│   ├── server.js                    # Entry point for the backend
│   └── package.json                 # Backend dependencies
│
├── .env.example                     # Sample environment variable file
├── README.md                        # Project documentation (this file)
└── LICENSE
```

---

## 🔐 Environment Variables

Create a `.env` file inside the `backend/` directory and configure the following variables. A sample file `.env.example` is provided for reference.

```env
# Server
PORT=5000
NODE_ENV=development

# JWT Authentication
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRY=7d

# Database
DB_PATH=./database/pmos.db
```

> ⚠️ Never commit your `.env` file to version control. Ensure it is listed in your `.gitignore` file.

---

## 🗄 Database Setup

This project uses **SQLite** as its database — no external database server installation is required. SQLite stores all data in a single local file (`pmos.db`), making it lightweight and easy to set up.

**Initialize the database**

```bash
cd backend
node database/init.js
```

This will create the `pmos.db` file and set up all the required tables automatically.

**To view or inspect the database**, you can use a free tool like [DB Browser for SQLite](https://sqlitebrowser.org/) to open and explore the `pmos.db` file directly.

---

## 📸 Screenshots

| Home / Dashboard | Symptom Logger | Cycle Tracker |
|---|---|---|
| *(Add screenshot here)* | *(Add screenshot here)* | *(Add screenshot here)* |

---

## 🤝 Contributing

This project was developed as part of an academic final year project. Contributions, suggestions, and feedback are welcome.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "Add: your feature description"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

---

## 🙏 Acknowledgements

- **University of Ghana, School of Engineering Sciences** — for the academic support and resources
- Our **project supervisor** — for the invaluable guidance throughout this research
- All **predecessors** who contributed to earlier versions of this project
- The women whose experiences with PCOS inspired and shaped the design of this system

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">Built with 💜 at the University of Ghana</p>
