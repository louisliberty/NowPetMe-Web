import { users, pets, votes, comments, type User, type Pet, type InsertPet, type Vote, type InsertVote, type Comment, type InsertComment } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  createUser(username: string, email: string, passwordHash: string, verificationToken: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  verifyUser(id: number): Promise<void>;
  updateVerificationToken(id: number, token: string): Promise<void>;

  getPet(id: number): Promise<Pet | undefined>;
  getPets(options?: { category?: string; sort?: string; limit?: number; offset?: number }): Promise<Pet[]>;
  getTopPets(limit?: number, category?: string): Promise<Pet[]>;
  createPet(pet: InsertPet, ownerIp: string, ownerId?: number): Promise<Pet>;
  getPetCount(category?: string): Promise<number>;

  createVote(petId: number, score: number, voterIp: string): Promise<Vote>;
  hasVoted(petId: number, voterIp: string): Promise<boolean>;
  getUploadCount(ip: string): Promise<number>;

  getComments(petId: number): Promise<Comment[]>;
  createComment(petId: number, text: string, commenterIp: string, userId?: number): Promise<Comment>;
}

export class DatabaseStorage implements IStorage {
  async createUser(username: string, email: string, passwordHash: string, verificationToken: string): Promise<User> {
    const [user] = await db.insert(users).values({ username, email, passwordHash, verificationToken }).returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    return user;
  }

  async verifyUser(id: number): Promise<void> {
    await db.update(users).set({ emailVerified: true, verificationToken: null }).where(eq(users.id, id));
  }

  async updateVerificationToken(id: number, token: string): Promise<void> {
    await db.update(users).set({ verificationToken: token }).where(eq(users.id, id));
  }

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

  async createPet(pet: InsertPet, ownerIp: string, ownerId?: number): Promise<Pet> {
    const [created] = await db.insert(pets).values({ ...pet, ownerIp, ownerId: ownerId || null }).returning();
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

  async createComment(petId: number, text: string, commenterIp: string, userId?: number): Promise<Comment> {
    const [comment] = await db.insert(comments).values({ petId, text, commenterIp, userId: userId || null }).returning();
    return comment;
  }
}

export const storage = new DatabaseStorage();
