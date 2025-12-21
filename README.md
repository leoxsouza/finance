# Personal Finance Manager

Simple Next.js 14 + TypeScript application for envelope budgeting, income tracking, and dashboards.

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create an `.env` file with the SQLite connection string (or your remote database):
   ```bash
   DATABASE_URL="file:./prisma/dev.db"
   ```
3. Generate a bcrypt hash for your login password:
   ```bash
   node -e "console.log(require('bcryptjs').hashSync('your-password', 12))"
   ```
4. Add the authentication env vars (see `.env.example` for all keys):
   ```bash
   AUTH_USER_EMAIL="me@example.com"
   AUTH_USER_PASSWORD_HASH="<paste hash from step 3>"
   NEXTAUTH_SECRET="<openssl rand -base64 32>"
   NEXTAUTH_URL="http://localhost:3000"
   ```

## Development

Run the development server:
```bash
npm run dev
```
The app will be available at http://localhost:3000 and supports hot reload.

## Production build

1. Build the app:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm start
   ```

## Tests (placeholder)

Vitest is configured but no suites exist yet. When tests are added you can run:
```bash
npm test
```
