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
