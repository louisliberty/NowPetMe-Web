import { pets, votes, comments, type Pet, type InsertPet, type Vote, type InsertVote, type Comment, type InsertComment } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, sql } from "drizzle-orm";

export interface IStorage {
  getPet(id: number): Promise<Pet | undefined>;
  getPets(options?: { category?: string; sort?: string; limit?: number; offset?: number }): Promise<Pet[]>;
  getTopPets(limit?: number, category?: string): Promise<Pet[]>;
  createPet(pet: InsertPet, ownerIp: string): Promise<Pet>;
  getPetCount(category?: string): Promise<number>;

  createVote(petId: number, score: number, voterIp: string): Promise<Vote>;
  hasVoted(petId: number, voterIp: string): Promise<boolean>;
  getUploadCount(ip: string): Promise<number>;

  getComments(petId: number): Promise<Comment[]>;
  createComment(petId: number, text: string, commenterIp: string): Promise<Comment>;
}

export class DatabaseStorage implements IStorage {
  async getPet(id: number): Promise<Pet | undefined> {
    const [pet] = await db.select().from(pets).where(eq(pets.id, id));
    return pet;
  }

  async getPets(options?: { category?: string; sort?: string; limit?: number; offset?: number }): Promise<Pet[]> {
    const { category, sort = "newest", limit = 12, offset = 0 } = options || {};

    let query = db.select().from(pets);

    if (category) {
      query = query.where(eq(pets.category, category)) as any;
    }

    let orderBy;
    if (sort === "highest") {
      orderBy = sql`CASE WHEN ${pets.voteCount} > 0 THEN CAST(${pets.totalScore} AS FLOAT) / ${pets.voteCount} ELSE 0 END DESC`;
    } else if (sort === "most_votes") {
      orderBy = desc(pets.voteCount);
    } else {
      orderBy = desc(pets.createdAt);
    }

    return (query as any).orderBy(orderBy).limit(limit).offset(offset);
  }

  async getTopPets(limit = 5, category?: string): Promise<Pet[]> {
    let query = db.select().from(pets).where(sql`${pets.voteCount} > 0`);

    if (category) {
      query = query.where(and(sql`${pets.voteCount} > 0`, eq(pets.category, category))) as any;
    }

    return (query as any)
      .orderBy(sql`CASE WHEN ${pets.voteCount} > 0 THEN CAST(${pets.totalScore} AS FLOAT) / ${pets.voteCount} ELSE 0 END DESC`)
      .limit(limit);
  }

  async createPet(pet: InsertPet, ownerIp: string): Promise<Pet> {
    const [created] = await db.insert(pets).values({ ...pet, ownerIp }).returning();
    return created;
  }

  async getPetCount(category?: string): Promise<number> {
    let query;
    if (category) {
      query = db.select({ count: sql<number>`count(*)` }).from(pets).where(eq(pets.category, category));
    } else {
      query = db.select({ count: sql<number>`count(*)` }).from(pets);
    }
    const [result] = await query;
    return Number(result.count);
  }

  async createVote(petId: number, score: number, voterIp: string): Promise<Vote> {
    const [vote] = await db.insert(votes).values({ petId, score, voterIp }).returning();

    await db.update(pets)
      .set({
        totalScore: sql`${pets.totalScore} + ${score}`,
        voteCount: sql`${pets.voteCount} + 1`,
      })
      .where(eq(pets.id, petId));

    return vote;
  }

  async hasVoted(petId: number, voterIp: string): Promise<boolean> {
    const [existing] = await db.select().from(votes)
      .where(and(eq(votes.petId, petId), eq(votes.voterIp, voterIp)));
    return !!existing;
  }

  async getUploadCount(ip: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(pets)
      .where(and(
        eq(pets.ownerIp, ip),
        sql`${pets.createdAt} >= ${today}`
      ));
    return Number(result.count);
  }

  async getComments(petId: number): Promise<Comment[]> {
    return db.select().from(comments)
      .where(eq(comments.petId, petId))
      .orderBy(desc(comments.createdAt));
  }

  async createComment(petId: number, text: string, commenterIp: string): Promise<Comment> {
    const [comment] = await db.insert(comments).values({ petId, text, commenterIp }).returning();
    return comment;
  }
}

export const storage = new DatabaseStorage();
