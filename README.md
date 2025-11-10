# German Learning App

A web application for learning German vocabulary with interactive fill-in-the-blank exercises.

## Features

- ✅ User authentication (Sign up / Sign in)
- ✅ Level selection (A1-L1 to B1-L12)
- ✅ Progress tracking per level
- ✅ Reset progress functionality
- ✅ Fill-in-the-blank questions
- ✅ Automatic retry for incorrect answers
- ✅ Beautiful, modern UI with Tailwind CSS

## Progress Maintenance (Supabase)

Two helper scripts make it easy to clear and reseed quiz progress while debugging Supabase sync issues. Both scripts read `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` from `.env.local`, so make sure those values are present before running them.

### Reset all progress

```bash
npm run progress:reset
```

This deletes every row in `user_progress` and prints how many records were removed.

### Seed sample progress for a user

```bash
npm run progress:seed -- --email=user@example.com --level=B1-L3 --passed=5 --failed=1
```

- `--email` (required): Supabase auth email to update  
- `--level` (required): Unit id such as `A1-L2` or `B1-L3`  
- `--passed` (default 5): Number of questions to mark as passed  
- `--failed` (default 0): Number of questions to mark as failed  

The script removes any existing progress for the selected user and level, then inserts fresh rows so the levels page and quiz screens can be verified immediately.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup (Recommended)

The app supports both in-memory storage (default) and PostgreSQL database. For production or to use advanced features like grammar categories, set up PostgreSQL:

#### Option A: Using Supabase (Recommended - Free tier available)

1. Create a project at [Supabase](https://supabase.com)
2. Get your connection string from Supabase Dashboard
3. Run the migration: 
   - Go to SQL Editor in Supabase Dashboard
   - Copy contents of `database/migrations/001_initial_schema.sql`
   - Run the SQL script

#### Option B: Local PostgreSQL

```bash
# Create database
createdb german_learning

# Run migration
psql -d german_learning -f database/migrations/001_initial_schema.sql

# Verify setup
psql -d german_learning -f database/verify_setup.sql
```

#### Option C: Docker

```bash
# Start PostgreSQL
docker run --name german-learning-db \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=german_learning \
  -p 5432:5432 \
  -d postgres:15

# Run migration
psql -h localhost -U postgres -d german_learning -f database/migrations/001_initial_schema.sql
```

#### Environment Variables

Add to `.env.local`:

```env
# Database (if using PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/german_learning

# Supabase (alternative)
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

### 3. Load Vocabulary Data

Before using the app, you need to load the vocabulary data from the text file:

```bash
# Option 1: Use the API endpoint (recommended)
# After starting the server, visit: http://localhost:3000/api/load-data
# Or use curl:
curl -X POST http://localhost:3000/api/load-data

# Option 2: Run the parser script directly
npx ts-node scripts/parse-vocabulary.ts
```

### 4. Set Environment Variables

Create a `.env.local` file in the root directory:

```env
JWT_SECRET=your-secret-key-here-change-in-production

# Database (if using PostgreSQL/Supabase)
DATABASE_URL=postgresql://user:password@localhost:5432/german_learning
# OR
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
```

If you don't set JWT_SECRET, a default key will be used (not recommended for production).

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

The app supports both in-memory storage (development) and PostgreSQL database (production). 

### Current Status

- **In-memory storage**: Default, works out of the box for development
- **PostgreSQL database**: Recommended for production, enables advanced features

### Schema Overview

See `database/migrations/001_initial_schema.sql` for the complete schema. Key tables:

- **users**: User accounts and authentication
- **categories**: Grammar categories (Articles, Cases, Prepositions, etc.)
- **units**: Learning units (A1-L1, A1-L2, etc.)
- **unit_categories**: Links categories to units
- **questions**: All questions with support for multiple question types
- **user_progress**: User progress tracking per question, category, and unit

### Enhanced Features with Database

- ✅ Multiple question types (fill-in-blank, multiple choice, sentence ordering, etc.)
- ✅ Grammar categories (Articles, Cases, Prepositions, etc.)
- ✅ Category-based progress tracking
- ✅ Structured learning paths per unit
- ✅ Analytics views for progress insights

See `database/migrations/README.md` for detailed setup instructions.

## Free Hosting Options

### Option 1: Vercel + Supabase (Recommended)

1. **Frontend (Vercel)**:
   - Push your code to GitHub
   - Connect your repository to [Vercel](https://vercel.com)
   - Deploy automatically

2. **Backend/Database (Supabase)**:
   - Sign up at [Supabase](https://supabase.com) (free tier available)
   - Create a new project
   - Run the SQL schema from above
   - Update your API routes to use Supabase client

### Option 2: Netlify + Firebase

1. **Frontend (Netlify)**:
   - Connect GitHub repository to [Netlify](https://netlify.com)
   - Build command: `npm run build`
   - Publish directory: `.next`

2. **Backend (Firebase)**:
   - Use Firebase Authentication
   - Use Firestore for database

### Option 3: Railway or Render

- Both offer free tiers for full-stack applications
- Can host both frontend and backend together

## Project Structure



```
german/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── questions/    # Question endpoints
│   │   └── progress/     # Progress tracking endpoints
│   ├── auth/             # Auth pages (signin/signup)
│   ├── levels/           # Level selection page
│   └── quiz/             # Quiz pages
├── lib/
│   ├── auth.tsx          # Authentication context
│   ├── db.ts             # Database utilities
│   └── users.ts          # User management
├── scripts/
│   └── parse-vocabulary.ts  # Vocabulary parser
└── VHS-Lernportal Vocabualry.txt  # Source data
```

## How It Works

1. **Sign Up/Sign In**: Users create an account or sign in
2. **Select Level**: Choose from A1-L1 to B1-L12
3. **Practice**: Fill in the blanks in German sentences
4. **Progress Tracking**: 
   - Correct answers are marked as "passed"
   - Incorrect answers are marked as "failed" and will be shown again
   - Questions are prioritized: failed > pending > passed
5. **Reset**: Users can reset their progress for any level

## Development Notes

- The app uses in-memory storage by default (data is lost on server restart)
- For production, replace the database utilities in `lib/db.ts` with actual database calls
- Authentication uses JWT tokens stored in localStorage
- The vocabulary parser extracts questions from the tab-separated text file

## License

MIT

# germanabc
