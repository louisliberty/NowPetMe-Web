import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial, boolean, real, date, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  verificationToken: text("verification_token"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  bio: text("bio"),
  xp: integer("xp").notNull().default(0),
  votingStreak: integer("voting_streak").notNull().default(0),
  votesCast: integer("votes_cast").notNull().default(0),
  lastVoteDate: date("last_vote_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pets = pgTable("pets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  breed: text("breed"),
  photoUrl: text("photo_url").notNull(),
  story: text("story"),
  personalityTags: text("personality_tags").array().notNull().default(sql`ARRAY[]::text[]`),
  totalScore: integer("total_score").notNull().default(0),
  voteCount: integer("vote_count").notNull().default(0),
  bayesianScore: real("bayesian_score").notNull().default(0),
  reportCount: integer("report_count").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  ownerIp: text("owner_ip"),
  ownerId: integer("owner_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  bayesianIdx: index("pets_bayesian_idx").on(t.bayesianScore),
  categoryIdx: index("pets_category_idx").on(t.category),
}));

export const petOfTheDay = pgTable("pet_of_the_day", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull(),
  date: date("date").notNull(),
}, (t) => ({
  dateIdx: uniqueIndex("pet_of_the_day_date_idx").on(t.date),
}));

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull(),
  voterIp: text("voter_ip").notNull(),
  score: integer("score").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  petId: integer("pet_id").notNull(),
  text: text("text").notNull(),
  commenterIp: text("commenter_ip"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commentLikes = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull(),
  voterIp: text("voter_ip").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commentReactions = pgTable("comment_reactions", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull(),
  voterIp: text("voter_ip").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("comment_reactions_uniq").on(t.commentId, t.voterIp, t.emoji),
}));

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  code: text("code").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("achievements_user_code_idx").on(t.userId, t.code),
}));

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id").notNull(),
  reporterIp: text("reporter_ip").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniq: uniqueIndex("reports_uniq_idx").on(t.targetType, t.targetId, t.reporterIp),
}));

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30).regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const PERSONALITY_TAGS = ["playful", "lazy", "mischievous", "cuddly", "energetic", "shy", "smart", "goofy", "majestic", "derpy", "sassy", "adventurous"] as const;
export type PersonalityTag = typeof PERSONALITY_TAGS[number];

export const insertPetSchema = createInsertSchema(pets).omit({
  id: true,
  totalScore: true,
  voteCount: true,
  bayesianScore: true,
  reportCount: true,
  hidden: true,
  ownerIp: true,
  ownerId: true,
  createdAt: true,
}).extend({
  personalityTags: z.array(z.enum(PERSONALITY_TAGS)).max(5).optional().default([]),
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  voterIp: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  commenterIp: true,
  userId: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type Pet = typeof pets.$inferSelect;
export type InsertPet = z.infer<typeof insertPetSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type CommentLike = typeof commentLikes.$inferSelect;
export type PetOfTheDay = typeof petOfTheDay.$inferSelect;
export type CommentReaction = typeof commentReactions.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type Report = typeof reports.$inferSelect;

export const ACHIEVEMENT_DEFS: { code: string; label: string; emoji: string; description: string }[] = [
  { code: "first_vote", label: "First Vote", emoji: "🗳️", description: "Cast your first vote" },
  { code: "vote_10", label: "Voter", emoji: "🐾", description: "Cast 10 votes" },
  { code: "vote_100", label: "Super Voter", emoji: "⭐", description: "Cast 100 votes" },
  { code: "first_upload", label: "Pet Parent", emoji: "🐶", description: "Upload your first pet" },
  { code: "first_comment", label: "Conversationalist", emoji: "💬", description: "Post your first comment" },
  { code: "streak_3", label: "On a Roll", emoji: "🔥", description: "Vote 3 days in a row" },
  { code: "streak_7", label: "Dedicated", emoji: "🔥🔥", description: "Vote 7 days in a row" },
  { code: "streak_30", label: "Unstoppable", emoji: "🔥🔥🔥", description: "Vote 30 days in a row" },
  { code: "level_5", label: "Rising Star", emoji: "🌟", description: "Reach level 5" },
  { code: "level_10", label: "Pet Pro", emoji: "🏆", description: "Reach level 10" },
  { code: "potd_owner", label: "Pet of the Day", emoji: "👑", description: "Have a Pet of the Day" },
];

export const XP_PER_VOTE = 5;
export const XP_PER_UPLOAD = 50;
export const XP_PER_COMMENT = 10;
export function xpForLevel(level: number) { return Math.max(0, (level - 1) * (level - 1) * 50); }
export function levelFromXp(xp: number) { return Math.max(1, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 50))); }

export const reportSchema = z.object({
  targetType: z.enum(["pet", "comment"]),
  targetId: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});
export const forgotPasswordSchema = z.object({ email: z.string().email() });
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});
export const updateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
});

export type CommentReactionSummary = { emoji: string; count: number; mine: boolean };

export type CommentWithUser = Comment & {
  username: string | null;
  likeCount: number;
  reactions?: CommentReactionSummary[];
  hasLiked: boolean;
};

export const CATEGORIES = ["dog", "cat", "bird", "rabbit", "fish", "other"] as const;
export type Category = typeof CATEGORIES[number];
