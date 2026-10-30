// Types and constants shared by the React app. They describe the JSON returned by the PHP API
// (php-api/public/api). Keep CATEGORIES and PERSONALITY_TAGS in sync with php-api/public/api/lib/Rules.php.
import { z } from "zod";

export const CATEGORIES = ["dog", "cat", "bird", "rabbit", "fish", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PERSONALITY_TAGS = [
  "playful", "lazy", "mischievous", "cuddly", "energetic", "shy",
  "smart", "goofy", "majestic", "derpy", "sassy", "adventurous",
] as const;
export type PersonalityTag = (typeof PERSONALITY_TAGS)[number];

export type Pet = {
  id: number;
  name: string;
  category: string;
  breed: string | null;
  photoUrl: string;
  story: string | null;
  personalityTags: string[];
  totalScore: number;
  voteCount: number;
  bayesianScore: number;
  reportCount: number;
  hidden: boolean;
  ownerId: number | null;
  createdAt: string | null;
  recentVotes?: number;
};

export type CommentReactionSummary = { emoji: string; count: number; mine: boolean };

export type CommentWithUser = {
  id: number;
  petId: number;
  text: string;
  userId: number | null;
  createdAt: string | null;
  username: string | null;
  likeCount: number;
  hasLiked: boolean;
  reactions?: CommentReactionSummary[];
};

// Validation for the upload form (the server validates again).
export const insertPetSchema = z.object({
  name: z.string(),
  category: z.string(),
  breed: z.string().nullable().optional(),
  story: z.string().nullable().optional(),
  photoUrl: z.string().optional(),
  personalityTags: z.array(z.enum(PERSONALITY_TAGS)).max(5).optional().default([]),
});
