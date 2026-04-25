# Next Steps (React + Vite)

Simple habit/task app with role‑based views:
- Child: sees tasks, can toggle status, chooses a theme (pink/blue)
- Parent: manage children, assign tasks, approve provider tasks
- Provider: create tasks for parents/users
- User (14+): manage own habit build/break plans

## Running the App

Requirements:
- Node.js (v22 or later)
- npm (v11 or later)
- Python (v3.13 or later)

1. Clone the repo
2. Copy .env-example to .env and fill in any required values. They should be filled with sensible defaults for a development environment, but you may want to customize them.

Frontend:
1. `npm install` – Install dependencies
2. `npm run dev` – Start development server
3. Open the given URL in your browser

Backend:
1. `cd backend`
2. `python -m venv venv` – Create virtual environment
3. `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows) – Activate virtual environment
4. `python -m pip install -r requirements.txt` – Install dependencies
5. `python main.py` – Start backend server

Description of Deployment Artifacts:

This project is organized as a full-stack web application with a React frontend and a Python backend. The root directory contains the main project documentation, frontend configuration files, dependency files, and testing configuration.

- The `src` directory contains the React frontend, including the main app entry point, routing, authentication pages, role-specific pages for children, parents, and providers, reusable components, styling, frontend models, and API helper functions.

- The `backend` directory contains the Python backend. Its main entry point is `backend/main.py`, and its modules handle application features such as login, users, children, friends, tasks, goals, habits, and game functionality.

- The `public` directory stores static frontend assets such as avatar images. Testing files are included in both the frontend and backend folders to help validate the application.

- Overall, the artifact structure separates the application into frontend interface files, backend server logic, public assets, dependencies, configuration files, and tests.

Diagram:

```
404-Found-React/
│
├── README.md                 # Main project documentation
├── package.json              # Frontend dependencies and npm scripts
├── package-lock.json         # Locked frontend dependency versions
├── index.html                # Main HTML file used by Vite
├── vite.config.js            # Vite configuration
├── vitest.config.js          # Frontend testing configuration
├── eslint.config.js          # Frontend linting configuration
│
├── public/                   # Static frontend assets
│   ├── base/                 # Avatar base images
│   ├── eyebrows/             # Avatar eyebrow images
│   └── ...                   # Other public image assets
│
├── src/                      # React frontend source code
│   ├── main.jsx              # Frontend entry point
│   ├── App.jsx               # Main React app structure and routing
│   ├── UserContext.jsx       # Shared user/session context
│   ├── auth/                 # Login, signup, and splash pages
│   ├── pages/                # General application pages
│   ├── Child/                # Child-specific pages
│   ├── Parents/              # Parent-specific pages and dashboards
│   ├── Provider/             # Provider-specific dashboard
│   ├── components/           # Reusable frontend components
│   ├── lib/                  # Frontend utilities and API helpers
│   │   └── api/              # API communication functions
│   ├── models/               # Frontend data models
│   ├── styles/               # Theme and style support
│   └── __tests__/            # Frontend tests
│
├── backend/                  # Python backend source code
│   ├── main.py               # Backend server entry point
│   ├── requirements.txt      # Backend Python dependencies
│   ├── modules/              # Backend API/application modules
│   │   ├── login.py
│   │   ├── user.py
│   │   ├── child.py
│   │   ├── friends.py
│   │   ├── tasks.py
│   │   ├── goals.py
│   │   ├── game.py
│   │   └── habits/
│   ├── state/                # Database and state helper files
│   ├── util/                 # Backend utility files
│   └── tests/                # Backend tests
│
└── tests/                    # Additional project-level tests
