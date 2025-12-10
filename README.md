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
2. Create an `.env` file with the SQLite connection string (the database will be created automatically once Prisma is configured in later tasks):
   ```bash
   DATABASE_URL="file:./prisma/dev.db"
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
