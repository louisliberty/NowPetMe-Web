import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendVerificationEmail, sendPetOfTheDayEmail, sendPasswordResetEmail } from "./email";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { insertPetSchema, insertVoteSchema, insertCommentSchema, registerSchema, loginSchema, reportSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema, ACHIEVEMENT_DEFS, levelFromXp, xpForLevel, XP_PER_VOTE, XP_PER_UPLOAD, XP_PER_COMMENT, PERSONALITY_TAGS } from "@shared/schema";
import { moderateImage } from "./moderation";

const uploadsDir = path.resolve("uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + "petrathub-salt").digest("hex").slice(0, 16);
}

function getClientIp(req: any): string {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
}

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "You must be logged in to do this" });
  }
  next();
}

function getBaseUrl(req: Request): string {
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  }
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/uploads", (req, res, next) => {
    const filePath = path.join(uploadsDir, path.basename(req.path));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid data" });
      }

      const { username, email, password } = parsed.data;

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ message: "This username is already taken" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const verificationToken = crypto.randomBytes(32).toString("hex");

      const user = await storage.createUser(username, email, passwordHash, verificationToken);

      try {
        await sendVerificationEmail(email, verificationToken, getBaseUrl(req));
      } catch (emailErr) {
        console.error("Failed to send verification email:", emailErr);
      }

      req.session.userId = user.id;
      res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        xp: user.xp,
        level: levelFromXp(user.xp),
        xpForNextLevel: xpForLevel(levelFromXp(user.xp) + 1),
        xpForCurrentLevel: xpForLevel(levelFromXp(user.xp)),
        votingStreak: user.votingStreak,
        bio: user.bio,
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid data" });
      }

      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.userId = user.id;
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        xp: user.xp,
        level: levelFromXp(user.xp),
        xpForNextLevel: xpForLevel(levelFromXp(user.xp) + 1),
        xpForCurrentLevel: xpForLevel(levelFromXp(user.xp)),
        votingStreak: user.votingStreak,
        bio: user.bio,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      xp: user.xp,
      level: levelFromXp(user.xp),
      xpForNextLevel: xpForLevel(levelFromXp(user.xp) + 1),
      xpForCurrentLevel: xpForLevel(levelFromXp(user.xp)),
      votingStreak: user.votingStreak,
      bio: user.bio,
    });
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid email" });
      const user = await storage.getUserByEmail(parsed.data.email);
      if (user) {
        const token = crypto.randomBytes(32).toString("hex");
        const expiry = new Date(Date.now() + 60 * 60 * 1000);
        await storage.setResetToken(user.id, token, expiry);
        try { await sendPasswordResetEmail(user.email, token, getBaseUrl(req)); }
        catch (e) { console.error("Reset email failed:", e); }
      }
      res.json({ message: "If that email exists, a reset link has been sent." });
    } catch (e) {
      console.error("forgot-password error:", e);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid data" });
      const user = await storage.getUserByResetToken(parsed.data.token);
      if (!user) return res.status(400).json({ message: "Invalid or expired reset link" });
      const hash = await bcrypt.hash(parsed.data.password, 10);
      await storage.updatePassword(user.id, hash);
      res.json({ message: "Password updated. You can now log in." });
    } catch (e) {
      console.error("reset-password error:", e);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/users/:username", async (req, res) => {
    try {
      const user = await storage.getUserByUsername(req.params.username);
      if (!user) return res.status(404).json({ message: "User not found" });
      const [userPets, achievements] = await Promise.all([
        storage.getUserPets(user.id),
        storage.getAchievements(user.id),
      ]);
      const totalVotesReceived = userPets.reduce((s, p) => s + p.voteCount, 0);
      res.json({
        username: user.username,
        bio: user.bio,
        xp: user.xp,
        level: levelFromXp(user.xp),
        xpForNextLevel: xpForLevel(levelFromXp(user.xp) + 1),
        xpForCurrentLevel: xpForLevel(levelFromXp(user.xp)),
        votingStreak: user.votingStreak,
        createdAt: user.createdAt,
        pets: userPets,
        achievements: achievements.map((a) => {
          const def = ACHIEVEMENT_DEFS.find((d) => d.code === a.code);
          return { code: a.code, unlockedAt: a.unlockedAt, label: def?.label || a.code, emoji: def?.emoji || "⭐", description: def?.description || "" };
        }),
        totalVotesReceived,
        petCount: userPets.length,
      });
    } catch (e) {
      console.error("get user error:", e);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/me", requireAuth, async (req, res) => {
    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid data" });
      if (parsed.data.bio !== undefined) await storage.updateUserBio(req.session.userId!, parsed.data.bio);
      res.json({ message: "Updated" });
    } catch (e) { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/auth/verify", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.redirect("/?verified=error");
      }

      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.redirect("/?verified=error");
      }

      await storage.verifyUser(user.id);
      const verified = await storage.getUserById(user.id);
      if (!verified?.emailVerified) {
        return res.redirect("/?verified=error");
      }
      return res.redirect("/?verified=success");
    } catch (error) {
      console.error("Verify error:", error);
      return res.redirect("/?verified=error");
    }
  });

  app.post("/api/auth/resend-verification", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.emailVerified) return res.json({ message: "Email already verified" });

      const token = crypto.randomBytes(32).toString("hex");
      await storage.updateVerificationToken(user.id, token);
      await sendVerificationEmail(user.email, token, getBaseUrl(req));
      res.json({ message: "Verification email sent" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification email" });
    }
  });

  app.get("/api/pets", async (req, res) => {
    try {
      const { category, sort, limit, offset } = req.query;
      const pets = await storage.getPets({
        category: category as string | undefined,
        sort: sort as string | undefined,
        limit: limit ? parseInt(limit as string) : 12,
        offset: offset ? parseInt(offset as string) : 0,
      });
      res.json(pets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pets" });
    }
  });

  app.get("/api/pets/count", async (req, res) => {
    try {
      const { category } = req.query;
      const count = await storage.getPetCount(category as string | undefined);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Failed to get count" });
    }
  });

  app.get("/api/pets/random", async (_req, res) => {
    try {
      const pet = await storage.getRandomPet();
      if (!pet) return res.status(404).json({ message: "No pets available" });
      res.json(pet);
    } catch (e) { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/pets/hot", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
      const pets = await storage.getHotPets(limit);
      res.json(pets);
    } catch (e) { res.status(500).json({ message: "Failed to fetch hot pets" }); }
  });

  app.post("/api/reports", async (req, res) => {
    try {
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid report" });
      const ip = hashIp(getClientIp(req));
      const result = await storage.createReport(parsed.data.targetType, parsed.data.targetId, ip, parsed.data.reason);
      res.json(result);
    } catch (e) {
      console.error("report error:", e);
      res.status(500).json({ message: "Failed to submit report" });
    }
  });

  app.post("/api/comments/:id/reactions", async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      const emoji = (req.body?.emoji || "").toString();
      if (!["❤️", "😂", "😮", "🐾", "👏"].includes(emoji)) {
        return res.status(400).json({ message: "Invalid emoji" });
      }
      const ip = hashIp(getClientIp(req));
      const result = await storage.toggleReaction(commentId, ip, emoji);
      res.json(result);
    } catch (e) { res.status(500).json({ message: "Failed" }); }
  });

  app.get("/api/pets/of-the-day", async (req, res) => {
    try {
      const result = await storage.getOrSelectPetOfTheDay();
      if (!result) return res.json(null);
      const { pet, isNew } = result;
      if (isNew && pet.ownerId) {
        await storage.unlockAchievement(pet.ownerId, "potd_owner");
        const owner = await storage.getUserById(pet.ownerId);
        if (owner?.email && owner.emailVerified) {
          const avg = pet.voteCount > 0 ? (pet.totalScore / pet.voteCount).toFixed(1) : "0.0";
          sendPetOfTheDayEmail(owner.email, pet.name, pet.id, avg, pet.voteCount, getBaseUrl(req)).catch((e) => console.error("POTD email failed:", e));
        }
      }
      res.json(pet);
    } catch (error) {
      console.error("POTD error:", error);
      res.status(500).json({ message: "Failed to fetch pet of the day" });
    }
  });

  app.get("/api/pets/top", async (req, res) => {
    try {
      const { limit, category } = req.query;
      const pets = await storage.getTopPets(
        limit ? parseInt(limit as string) : 10,
        category as string | undefined
      );
      res.json(pets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch top pets" });
    }
  });

  app.get("/api/pets/:id", async (req, res) => {
    try {
      const pet = await storage.getPet(parseInt(req.params.id));
      if (!pet || pet.hidden) {
        return res.status(404).json({ message: "Pet not found" });
      }
      const ip = hashIp(getClientIp(req));
      const hasVoted = await storage.hasVoted(pet.id, ip);
      res.json({ ...pet, hasVoted });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pet" });
    }
  });

  app.post("/api/pets", requireAuth, upload.single("photo"), async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user || !user.emailVerified) {
        return res.status(403).json({ message: "Please verify your email before uploading" });
      }

      const ip = hashIp(getClientIp(req));
      const uploadCount = await storage.getUploadCount(ip);
      if (uploadCount >= 5) {
        return res.status(429).json({ message: "Upload limit reached (5 per day)" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Photo is required" });
      }

      const moderation = await moderateImage(req.file.path);
      if (!moderation.approved) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: `Photo rejected: ${moderation.reason}` });
      }

      let tags: string[] = [];
      try {
        const raw = req.body.personalityTags;
        if (typeof raw === "string" && raw.length) tags = JSON.parse(raw);
        else if (Array.isArray(raw)) tags = raw;
      } catch {}
      tags = tags.filter((t) => (PERSONALITY_TAGS as readonly string[]).includes(t)).slice(0, 5);

      const petData = {
        name: req.body.name,
        category: req.body.category,
        breed: req.body.breed || null,
        photoUrl: `/uploads/${req.file.filename}`,
        story: req.body.story || null,
        personalityTags: tags,
      };

      const parsed = insertPetSchema.safeParse(petData);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid pet data", errors: parsed.error.issues });
      }

      const pet = await storage.createPet(parsed.data, ip, req.session.userId);

      const xpResult = await storage.addXp(req.session.userId!, XP_PER_UPLOAD);
      const newAch: string[] = [...xpResult.newAchievements];
      if (await storage.unlockAchievement(req.session.userId!, "first_upload")) newAch.push("first_upload");

      res.status(201).json({ ...pet, _xp: xpResult, _newAchievements: newAch });
    } catch (error) {
      console.error("Create pet error:", error);
      res.status(500).json({ message: "Failed to create pet" });
    }
  });

  app.post("/api/pets/:id/vote", async (req, res) => {
    try {
      const petId = parseInt(req.params.id);
      const voteData = insertVoteSchema.extend({
        score: insertVoteSchema.shape.score.refine((v) => v >= 1 && v <= 10, "Score must be between 1 and 10"),
      }).safeParse({ petId, score: req.body.score });

      if (!voteData.success) {
        return res.status(400).json({ message: voteData.error.issues[0]?.message || "Invalid vote data" });
      }

      const { score } = voteData.data;

      const pet = await storage.getPet(petId);
      if (!pet) {
        return res.status(404).json({ message: "Pet not found" });
      }

      const ip = hashIp(getClientIp(req));
      const alreadyVoted = await storage.hasVoted(petId, ip);
      if (alreadyVoted) {
        return res.status(409).json({ message: "You already voted for this pet" });
      }

      await storage.createVote(petId, score, ip);
      const updatedPet = await storage.getPet(petId);

      let xpResult: any = null;
      let streakResult: any = null;
      const newAchievements: string[] = [];
      if (req.session.userId) {
        xpResult = await storage.addXp(req.session.userId, XP_PER_VOTE);
        streakResult = await storage.updateVotingStreak(req.session.userId);
        const voteMilestones = await storage.incrementVotesCast(req.session.userId);
        newAchievements.push(...xpResult.newAchievements, ...streakResult.newAchievements, ...voteMilestones.newAchievements);
        if (await storage.unlockAchievement(req.session.userId, "first_vote")) newAchievements.push("first_vote");
      }

      res.json({ ...updatedPet, _xp: xpResult, _streak: streakResult, _newAchievements: newAchievements });
    } catch (error) {
      console.error("Vote error:", error);
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  app.get("/api/pets/:id/comments", async (req, res) => {
    try {
      const petId = parseInt(req.params.id);
      const ip = hashIp(getClientIp(req));
      const petComments = await storage.getComments(petId, ip);
      const ids = petComments.map((c) => c.id);
      const reactionsByComment = await storage.getCommentReactions(ids, ip);
      res.json(petComments.map((c) => ({ ...c, reactions: reactionsByComment[c.id] || [] })));
    } catch (error) {
      console.error("Fetch comments error:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/pets/:id/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUserById(req.session.userId!);
      if (!user || !user.emailVerified) {
        return res.status(403).json({ message: "Please verify your email before commenting" });
      }

      const petId = parseInt(req.params.id);
      const commentData = insertCommentSchema.extend({
        text: insertCommentSchema.shape.text.refine((v) => v.length >= 1 && v.length <= 50, "Comment must be 1-50 characters"),
      }).safeParse({ petId, text: req.body.text });

      if (!commentData.success) {
        return res.status(400).json({ message: commentData.error.issues[0]?.message || "Invalid comment" });
      }

      const pet = await storage.getPet(petId);
      if (!pet) {
        return res.status(404).json({ message: "Pet not found" });
      }

      const ip = hashIp(getClientIp(req));
      const comment = await storage.createComment(petId, commentData.data.text, ip, req.session.userId);

      const newAchievements: string[] = [];
      const xpResult = await storage.addXp(req.session.userId!, XP_PER_COMMENT);
      newAchievements.push(...xpResult.newAchievements);
      if (await storage.unlockAchievement(req.session.userId!, "first_comment")) newAchievements.push("first_comment");

      res.status(201).json({ ...comment, _xp: xpResult, _newAchievements: newAchievements });
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  app.patch("/api/comments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }
      const comment = await storage.getComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
      if (comment.userId !== req.session.userId) {
        return res.status(403).json({ message: "You can only edit your own comments" });
      }
      const text = req.body.text?.trim();
      if (!text || text.length < 1 || text.length > 50) {
        return res.status(400).json({ message: "Comment must be 1-50 characters" });
      }
      const updated = await storage.updateComment(commentId, text);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update comment" });
    }
  });

  app.delete("/api/comments/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }
      const comment = await storage.getComment(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
      if (comment.userId !== req.session.userId) {
        return res.status(403).json({ message: "You can only delete your own comments" });
      }
      await storage.deleteComment(commentId);
      res.json({ message: "Comment deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });

  app.post("/api/comments/:id/like", async (req, res) => {
    try {
      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ message: "Invalid comment ID" });
      }
      const ip = hashIp(getClientIp(req));
      const alreadyLiked = await storage.hasLikedComment(commentId, ip);

      if (alreadyLiked) {
        await storage.unlikeComment(commentId, ip);
      } else {
        await storage.likeComment(commentId, ip);
      }

      const likeCount = await storage.getCommentLikeCount(commentId);
      const hasLiked = await storage.hasLikedComment(commentId, ip);
      res.json({ likeCount, hasLiked });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  return httpServer;
}
