import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const pets = pgTable("pets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  breed: text("breed"),
  photoUrl: text("photo_url").notNull(),
  story: text("story"),
  totalScore: integer("total_score").notNull().default(0),
  voteCount: integer("vote_count").notNull().default(0),
  ownerIp: text("owner_ip"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPetSchema = createInsertSchema(pets).omit({
  id: true,
  totalScore: true,
  voteCount: true,
  ownerIp: true,
  createdAt: true,
});

export const insertVoteSchema = createInsertSchema(votes).omit({
  id: true,
  voterIp: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  commenterIp: true,
  createdAt: true,
});

export type Pet = typeof pets.$inferSelect;
export type InsertPet = z.infer<typeof insertPetSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;

export const CATEGORIES = ["dog", "cat", "bird", "rabbit", "fish", "other"] as const;
export type Category = typeof CATEGORIES[number];
