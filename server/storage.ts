import { users, pets, votes, comments, commentLikes, commentReactions, achievements, reports, petOfTheDay, ACHIEVEMENT_DEFS, levelFromXp, type User, type Pet, type InsertPet, type Vote, type InsertVote, type Comment, type InsertComment, type CommentWithUser, type PetOfTheDay, type Achievement } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, notInArray, gte, inArray } from "drizzle-orm";

const BAYES_M = 10;

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

  getOrSelectPetOfTheDay(): Promise<{ pet: Pet; isNew: boolean } | undefined>;

  createVote(petId: number, score: number, voterIp: string): Promise<Vote>;
  hasVoted(petId: number, voterIp: string): Promise<boolean>;
  getUploadCount(ip: string): Promise<number>;

  getComments(petId: number, viewerIp: string): Promise<CommentWithUser[]>;
  createComment(petId: number, text: string, commenterIp: string, userId?: number): Promise<Comment>;
  getComment(commentId: number): Promise<Comment | undefined>;
  updateComment(commentId: number, text: string): Promise<Comment>;
  deleteComment(commentId: number): Promise<void>;
  likeComment(commentId: number, voterIp: string): Promise<void>;
  unlikeComment(commentId: number, voterIp: string): Promise<void>;
  hasLikedComment(commentId: number, voterIp: string): Promise<boolean>;
  getCommentLikeCount(commentId: number): Promise<number>;

  addXp(userId: number, delta: number): Promise<{ xp: number; level: number; leveledUp: boolean; newAchievements: string[] }>;
  incrementVotesCast(userId: number): Promise<{ count: number; newAchievements: string[] }>;
  updateVotingStreak(userId: number): Promise<{ streak: number; newAchievements: string[] }>;
  unlockAchievement(userId: number, code: string): Promise<boolean>;
  getAchievements(userId: number): Promise<Achievement[]>;
  createReport(targetType: "pet" | "comment", targetId: number, reporterIp: string, reason?: string): Promise<{ created: boolean; hidden: boolean }>;
  getRandomPet(): Promise<Pet | undefined>;
  getHotPets(limit?: number): Promise<Pet[]>;
  getCommentReactions(commentIds: number[], voterIp: string): Promise<Record<number, { emoji: string; count: number; mine: boolean }[]>>;
  toggleReaction(commentId: number, voterIp: string, emoji: string): Promise<{ added: boolean }>;
  setResetToken(userId: number, token: string, expiresAt: Date): Promise<void>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  updatePassword(userId: number, passwordHash: string): Promise<void>;
  updateUserBio(userId: number, bio: string): Promise<void>;
  getUserPets(userId: number): Promise<Pet[]>;
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

    const conds = [eq(pets.hidden, false)];
    if (category) conds.push(eq(pets.category, category));
    let query = db.select().from(pets).where(and(...conds));

    let orderBy;
    if (sort === "highest" || sort === "top-rated") {
      orderBy = desc(pets.bayesianScore);
    } else if (sort === "most_votes") {
      orderBy = desc(pets.voteCount);
    } else {
      orderBy = desc(pets.createdAt);
    }

    return (query as any).orderBy(orderBy).limit(limit).offset(offset);
  }

  async getTopPets(limit = 5, category?: string): Promise<Pet[]> {
    const conds = [sql`${pets.voteCount} > 0`, eq(pets.hidden, false)];
    if (category) conds.push(eq(pets.category, category));
    return await db.select().from(pets).where(and(...conds)).orderBy(desc(pets.bayesianScore)).limit(limit);
  }

  async getOrSelectPetOfTheDay(): Promise<{ pet: Pet; isNew: boolean } | undefined> {
    const today = new Date().toISOString().slice(0, 10);

    const [existing] = await db.select().from(petOfTheDay).where(eq(petOfTheDay.date, today));
    if (existing) {
      const [pet] = await db.select().from(pets).where(eq(pets.id, existing.petId));
      return pet ? { pet, isNew: false } : undefined;
    }

    const recent = await db.execute(sql`SELECT pet_id FROM pet_of_the_day WHERE date >= CURRENT_DATE - INTERVAL '30 days'`);
    const recentIds = (recent.rows as any[]).map((r) => r.pet_id as number);

    let pickQuery = db.select().from(pets).where(and(sql`${pets.voteCount} > 0`, eq(pets.hidden, false)));
    if (recentIds.length > 0) {
      pickQuery = db.select().from(pets).where(and(sql`${pets.voteCount} > 0`, eq(pets.hidden, false), notInArray(pets.id, recentIds))) as any;
    }
    let candidates = await (pickQuery as any).orderBy(desc(pets.bayesianScore)).limit(1);

    if (!candidates.length) {
      candidates = await db.select().from(pets).where(and(sql`${pets.voteCount} > 0`, eq(pets.hidden, false))).orderBy(desc(pets.bayesianScore)).limit(1);
    }
    if (!candidates.length) return undefined;

    const pick = candidates[0] as Pet;
    try {
      await db.insert(petOfTheDay).values({ petId: pick.id, date: today });
      return { pet: pick, isNew: true };
    } catch {
      const [again] = await db.select().from(petOfTheDay).where(eq(petOfTheDay.date, today));
      if (again) {
        const [pet] = await db.select().from(pets).where(eq(pets.id, again.petId));
        return pet ? { pet, isNew: false } : undefined;
      }
      return { pet: pick, isNew: false };
    }
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

    await this.recalcBayesianScores();
    return vote;
  }

  async recalcBayesianScores(): Promise<void> {
    await db.execute(sql`
      WITH g AS (
        SELECT COALESCE(SUM(total_score)::float / NULLIF(SUM(vote_count), 0), 5.0) AS c
        FROM pets WHERE vote_count > 0
      )
      UPDATE pets SET bayesian_score =
        (vote_count::float / (vote_count + ${BAYES_M})) *
          (CASE WHEN vote_count > 0 THEN total_score::float / vote_count ELSE 0 END)
        + (${BAYES_M}::float / (vote_count + ${BAYES_M})) * (SELECT c FROM g)
    `);
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

  async getComments(petId: number, viewerIp: string): Promise<CommentWithUser[]> {
    const rows = await db.execute(sql`
      SELECT
        c.id, c.pet_id as "petId", c.text, c.commenter_ip as "commenterIp",
        c.user_id as "userId", c.created_at as "createdAt",
        u.username,
        COALESCE(lc.cnt, 0)::int as "likeCount",
        CASE WHEN ml.id IS NOT NULL THEN true ELSE false END as "hasLiked"
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN (
        SELECT comment_id, COUNT(*) as cnt FROM comment_likes GROUP BY comment_id
      ) lc ON lc.comment_id = c.id
      LEFT JOIN comment_likes ml ON ml.comment_id = c.id AND ml.voter_ip = ${viewerIp}
      WHERE c.pet_id = ${petId}
      ORDER BY c.created_at DESC
    `);
    return rows.rows as CommentWithUser[];
  }

  async createComment(petId: number, text: string, commenterIp: string, userId?: number): Promise<Comment> {
    const [comment] = await db.insert(comments).values({ petId, text, commenterIp, userId: userId || null }).returning();
    return comment;
  }

  async getComment(commentId: number): Promise<Comment | undefined> {
    const [comment] = await db.select().from(comments).where(eq(comments.id, commentId));
    return comment;
  }

  async updateComment(commentId: number, text: string): Promise<Comment> {
    const [comment] = await db.update(comments).set({ text }).where(eq(comments.id, commentId)).returning();
    return comment;
  }

  async deleteComment(commentId: number): Promise<void> {
    await db.delete(commentLikes).where(eq(commentLikes.commentId, commentId));
    await db.delete(comments).where(eq(comments.id, commentId));
  }

  async likeComment(commentId: number, voterIp: string): Promise<void> {
    await db.execute(sql`INSERT INTO comment_likes (comment_id, voter_ip) VALUES (${commentId}, ${voterIp}) ON CONFLICT (comment_id, voter_ip) DO NOTHING`);
  }

  async unlikeComment(commentId: number, voterIp: string): Promise<void> {
    await db.delete(commentLikes).where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.voterIp, voterIp)));
  }

  async hasLikedComment(commentId: number, voterIp: string): Promise<boolean> {
    const [existing] = await db.select().from(commentLikes)
      .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.voterIp, voterIp)));
    return !!existing;
  }

  async getCommentLikeCount(commentId: number): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(commentLikes)
      .where(eq(commentLikes.commentId, commentId));
    return Number(result.count);
  }

  // ===== XP / Levels =====
  async addXp(userId: number, delta: number): Promise<{ xp: number; level: number; leveledUp: boolean; newAchievements: string[] }> {
    const [before] = await db.select().from(users).where(eq(users.id, userId));
    if (!before) return { xp: 0, level: 1, leveledUp: false, newAchievements: [] };
    const oldLevel = levelFromXp(before.xp);
    const newXp = before.xp + delta;
    const newLevel = levelFromXp(newXp);
    await db.update(users).set({ xp: newXp }).where(eq(users.id, userId));
    const newAchievements: string[] = [];
    if (newLevel >= 5 && oldLevel < 5) {
      if (await this.unlockAchievement(userId, "level_5")) newAchievements.push("level_5");
    }
    if (newLevel >= 10 && oldLevel < 10) {
      if (await this.unlockAchievement(userId, "level_10")) newAchievements.push("level_10");
    }
    return { xp: newXp, level: newLevel, leveledUp: newLevel > oldLevel, newAchievements };
  }

  async incrementVotesCast(userId: number): Promise<{ count: number; newAchievements: string[] }> {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) return { count: 0, newAchievements: [] };
    const newCount = (u.votesCast || 0) + 1;
    await db.update(users).set({ votesCast: newCount }).where(eq(users.id, userId));
    const newAchievements: string[] = [];
    for (const [threshold, code] of [[10, "vote_10"], [100, "vote_100"]] as const) {
      if (newCount >= threshold) {
        if (await this.unlockAchievement(userId, code)) newAchievements.push(code);
      }
    }
    return { count: newCount, newAchievements };
  }

  // ===== Voting Streak =====
  async updateVotingStreak(userId: number): Promise<{ streak: number; newAchievements: string[] }> {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) return { streak: 0, newAchievements: [] };
    const today = new Date().toISOString().slice(0, 10);
    if (u.lastVoteDate === today) return { streak: u.votingStreak, newAchievements: [] };
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = u.lastVoteDate === yesterday ? u.votingStreak + 1 : 1;
    await db.update(users).set({ votingStreak: newStreak, lastVoteDate: today }).where(eq(users.id, userId));
    const newAchievements: string[] = [];
    for (const [threshold, code] of [[3, "streak_3"], [7, "streak_7"], [30, "streak_30"]] as const) {
      if (newStreak >= threshold) {
        if (await this.unlockAchievement(userId, code)) newAchievements.push(code);
      }
    }
    return { streak: newStreak, newAchievements };
  }

  // ===== Achievements =====
  async unlockAchievement(userId: number, code: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`INSERT INTO achievements (user_id, code) VALUES (${userId}, ${code}) ON CONFLICT (user_id, code) DO NOTHING RETURNING id`);
      return (result.rows?.length ?? 0) > 0;
    } catch { return false; }
  }
  async getAchievements(userId: number): Promise<Achievement[]> {
    return await db.select().from(achievements).where(eq(achievements.userId, userId)).orderBy(desc(achievements.unlockedAt));
  }

  // ===== Reports =====
  async createReport(targetType: "pet" | "comment", targetId: number, reporterIp: string, reason?: string): Promise<{ created: boolean; hidden: boolean }> {
    try {
      await db.execute(sql`INSERT INTO reports (target_type, target_id, reporter_ip, reason) VALUES (${targetType}, ${targetId}, ${reporterIp}, ${reason || null}) ON CONFLICT (target_type, target_id, reporter_ip) DO NOTHING`);
    } catch (e) { console.error(e); }
    if (targetType === "pet") {
      const [{ cnt }] = (await db.execute(sql`SELECT COUNT(*)::int as cnt FROM reports WHERE target_type='pet' AND target_id=${targetId}`)).rows as any[];
      await db.update(pets).set({ reportCount: cnt }).where(eq(pets.id, targetId));
      if (cnt >= 5) {
        await db.update(pets).set({ hidden: true }).where(eq(pets.id, targetId));
        return { created: true, hidden: true };
      }
    }
    return { created: true, hidden: false };
  }

  // ===== Random / Hot =====
  async getRandomPet(): Promise<Pet | undefined> {
    const [pet] = await db.select().from(pets).where(eq(pets.hidden, false)).orderBy(sql`RANDOM()`).limit(1);
    return pet;
  }
  async getHotPets(limit = 12): Promise<Pet[]> {
    const result = await db.execute(sql`
      SELECT p.*, COALESCE(v.recent, 0) AS recent_votes
      FROM pets p
      LEFT JOIN (
        SELECT pet_id, COUNT(*) AS recent FROM votes
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY pet_id
      ) v ON v.pet_id = p.id
      WHERE p.hidden = false
      ORDER BY COALESCE(v.recent, 0) DESC, p.bayesian_score DESC
      LIMIT ${limit}
    `);
    return (result.rows as any[]).map((r) => ({
      id: r.id, name: r.name, category: r.category, breed: r.breed, photoUrl: r.photo_url,
      story: r.story, personalityTags: r.personality_tags || [], totalScore: r.total_score,
      voteCount: r.vote_count, bayesianScore: r.bayesian_score, reportCount: r.report_count,
      hidden: r.hidden, ownerIp: r.owner_ip, ownerId: r.owner_id, createdAt: r.created_at,
    }));
  }

  // ===== Comment Reactions =====
  async getCommentReactions(commentIds: number[], voterIp: string): Promise<Record<number, { emoji: string; count: number; mine: boolean }[]>> {
    if (commentIds.length === 0) return {};
    const rows = await db.execute(sql`
      SELECT comment_id, emoji,
        COUNT(*)::int AS cnt,
        BOOL_OR(voter_ip = ${voterIp}) AS mine
      FROM comment_reactions WHERE comment_id IN (${sql.join(commentIds.map(id => sql`${id}`), sql`, `)})
      GROUP BY comment_id, emoji
    `);
    const grouped: Record<number, { emoji: string; count: number; mine: boolean }[]> = {};
    for (const r of rows.rows as any[]) {
      grouped[r.comment_id] = grouped[r.comment_id] || [];
      grouped[r.comment_id].push({ emoji: r.emoji, count: Number(r.cnt), mine: !!r.mine });
    }
    return grouped;
  }
  async toggleReaction(commentId: number, voterIp: string, emoji: string): Promise<{ added: boolean }> {
    const [existing] = await db.select().from(commentReactions).where(and(
      eq(commentReactions.commentId, commentId),
      eq(commentReactions.voterIp, voterIp),
      eq(commentReactions.emoji, emoji),
    ));
    if (existing) {
      await db.delete(commentReactions).where(eq(commentReactions.id, existing.id));
      return { added: false };
    }
    await db.insert(commentReactions).values({ commentId, voterIp, emoji });
    return { added: true };
  }

  // ===== Password Reset =====
  async setResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await db.update(users).set({ resetToken: token, resetTokenExpiry: expiresAt }).where(eq(users.id, userId));
  }
  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.resetToken, token));
    if (!u || !u.resetTokenExpiry || u.resetTokenExpiry < new Date()) return undefined;
    return u;
  }
  async updatePassword(userId: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash, resetToken: null, resetTokenExpiry: null }).where(eq(users.id, userId));
  }
  async updateUserBio(userId: number, bio: string): Promise<void> {
    await db.update(users).set({ bio }).where(eq(users.id, userId));
  }

  // ===== User Profile =====
  async getUserPets(userId: number): Promise<Pet[]> {
    return await db.select().from(pets).where(and(eq(pets.ownerId, userId), eq(pets.hidden, false))).orderBy(desc(pets.createdAt));
  }
}

export const storage = new DatabaseStorage();
