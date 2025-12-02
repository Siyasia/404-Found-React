# Next Steps (React + Vite)

Simple habit/task app with role‑based views:
- Child: sees tasks, can toggle status, chooses a theme (pink/blue)
- Parent: manage children, assign tasks, approve provider tasks
- Provider: create tasks for parents/users
- User (14+): manage own habit build/break plans

## Getting Started
```bash
npm install
npm run dev      # start local dev server
npm run test     # run vitest tests
```

## Main Scripts
- `dev` – Vite dev server
- `build` – Production build
- `test` – Vitest (React Testing Library)

## Testing
Helpers in `tests/test-utils.jsx`. Core flows covered:
- App navigation links render
- Auth (login flows + validation)
- Parent dashboard (add child, assign, toggle)

Run in watch mode: `npm run test`.

## Future Improvements (Optional)
- Replace localStorage with API
- Add accessibility audits
- More child themes or dynamic palette


