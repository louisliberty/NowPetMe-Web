# NowPetMe

A pet photo rating platform where users upload photos of their pets (dogs, cats, birds, rabbits, fish) and others rate their cuteness on a scale of 1-10. Features leaderboards, categories, voting, comments, and viral sharing.

## Tech Stack
- **Frontend**: React + TypeScript, Tailwind CSS, shadcn/ui components, wouter routing, TanStack Query
- **Backend**: Express.js, multer (file uploads), express-session (auth), bcryptjs (password hashing)
- **Database**: PostgreSQL with Drizzle ORM, connect-pg-simple (session store)
- **Email**: Resend (via Replit connector) for email verification
- **Styling**: Coral (#FF6B6B) primary, teal (#4ECDC4) accent, Plus Jakarta Sans font

## Architecture
- `client/src/pages/` - Page components (home, upload, pet-profile, category, leaderboard, login, register)
- `client/src/components/` - Reusable components (navbar, pet-card, star-rating, category-buttons)
- `client/src/lib/auth.tsx` - AuthProvider context (login, register, logout, user state)
- `client/src/lib/queryClient.ts` - TanStack Query client with apiRequest helper
- `server/routes.ts` - API endpoints (pets, votes, comments, auth)
- `server/storage.ts` - Database CRUD operations (DatabaseStorage class)
- `server/email.ts` - Resend email client for verification emails
- `server/db.ts` - Database connection pool
- `server/seed.ts` - Seed data with 5 sample pets
- `shared/schema.ts` - Drizzle schema + Zod validation

## Database Tables
- **users**: id, username, email, passwordHash, emailVerified, verificationToken, createdAt
- **pets**: id, name, category, breed, photoUrl, story, totalScore, voteCount, ownerIp, ownerId, createdAt
- **votes**: id, petId, voterIp, score, createdAt
- **comments**: id, petId, text, commenterIp, userId, createdAt
- **comment_likes**: id, commentId, voterIp, createdAt (unique constraint on commentId+voterIp)
- **session** (auto-created by connect-pg-simple)

## API Endpoints
### Auth
- `POST /api/auth/register` - Register (body: {username, email, password})
- `POST /api/auth/login` - Login (body: {email, password})
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user (returns 401 if not logged in)
- `GET /api/auth/verify?token=` - Email verification (redirects to /?verified=success|error)
- `POST /api/auth/resend-verification` - Resend verification email (requires auth)

### Pets
- `GET /api/pets` - List pets (query: category, sort, limit, offset)
- `GET /api/pets/top` - Top rated pets (query: limit, category)
- `GET /api/pets/count` - Pet count (query: category)
- `GET /api/pets/:id` - Single pet with hasVoted flag
- `POST /api/pets` - Upload pet (multipart form, **requires auth + verified email**)
- `POST /api/pets/:id/vote` - Vote for pet (body: {score}, **open to all**)
- `GET /api/pets/:id/comments` - Get comments (returns CommentWithUser[] with username, likeCount, hasLiked)
- `POST /api/pets/:id/comments` - Add comment (body: {text}, **requires auth + verified email**)
- `POST /api/comments/:id/like` - Toggle thumbs-up on comment (IP-based, **open to all**)

## Auth Flow
- Visitors can browse, vote, and view freely (no login required)
- Registration requires email + password + username; sends verification email via Resend
- Email verification link redirects to home page with success/error toast
- Upload and commenting require authenticated user with verified email
- Sessions stored in PostgreSQL via connect-pg-simple (30-day expiry)

## Features
- Photo upload with drag & drop, file validation (5MB max)
- 1-10 star rating with IP-based one-vote-per-pet limit
- 5 uploads per day limit per IP
- Category filtering and sorting (newest, highest rated, most votes)
- Leaderboard with rank icons and category filters
- Social sharing (TikTok, Instagram, Facebook, copy link)
- Comments (50 char max) with commenter username display and thumbs-up likes (IP-based toggle)
- Mobile-responsive design
- Per-page SEO titles

## File Uploads
- Stored in `/uploads/` directory
- Served via Express static middleware
- Seed images in `client/public/images/`
