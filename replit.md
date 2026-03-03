# PetRateHub

A pet photo rating platform where users upload photos of their pets (dogs, cats, birds, rabbits, fish) and others rate their cuteness on a scale of 1-10. Features leaderboards, categories, voting, comments, and viral sharing.

## Tech Stack
- **Frontend**: React + TypeScript, Tailwind CSS, shadcn/ui components, wouter routing, TanStack Query
- **Backend**: Express.js, multer (file uploads)
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Coral (#FF6B6B) primary, teal (#4ECDC4) accent, Plus Jakarta Sans font

## Architecture
- `client/src/pages/` - Page components (home, upload, pet-profile, category, leaderboard)
- `client/src/components/` - Reusable components (navbar, pet-card, star-rating, category-buttons)
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database CRUD operations (DatabaseStorage class)
- `server/db.ts` - Database connection pool
- `server/seed.ts` - Seed data with 5 sample pets
- `shared/schema.ts` - Drizzle schema + Zod validation

## Database Tables
- **pets**: id, name, category, breed, photoUrl, story, totalScore, voteCount, ownerIp, createdAt
- **votes**: id, petId, voterIp, score, createdAt
- **comments**: id, petId, text, commenterIp, createdAt

## API Endpoints
- `GET /api/pets` - List pets (query: category, sort, limit, offset)
- `GET /api/pets/top` - Top rated pets (query: limit, category)
- `GET /api/pets/count` - Pet count (query: category)
- `GET /api/pets/:id` - Single pet with hasVoted flag
- `POST /api/pets` - Upload pet (multipart form with photo)
- `POST /api/pets/:id/vote` - Vote for pet (body: {score})
- `GET /api/pets/:id/comments` - Get comments
- `POST /api/pets/:id/comments` - Add comment (body: {text})

## Features
- Photo upload with drag & drop, file validation (5MB max)
- 1-10 star rating with IP-based one-vote-per-pet limit
- 5 uploads per day limit per IP
- Category filtering and sorting (newest, highest rated, most votes)
- Leaderboard with rank icons and category filters
- Social sharing (X/Twitter, Facebook, WhatsApp, copy link)
- Comments (50 char max)
- Mobile-responsive design
- Per-page SEO titles

## File Uploads
- Stored in `/uploads/` directory
- Served via Express static middleware
- Seed images in `client/public/images/`
