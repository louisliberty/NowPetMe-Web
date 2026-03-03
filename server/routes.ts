import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendVerificationEmail } from "./email";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { insertPetSchema, insertVoteSchema, insertCommentSchema, registerSchema, loginSchema } from "@shared/schema";

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
    });
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
      if (!pet) {
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

      const petData = {
        name: req.body.name,
        category: req.body.category,
        breed: req.body.breed || null,
        photoUrl: `/uploads/${req.file.filename}`,
        story: req.body.story || null,
      };

      const parsed = insertPetSchema.safeParse(petData);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid pet data", errors: parsed.error.issues });
      }

      const pet = await storage.createPet(parsed.data, ip, req.session.userId);
      res.status(201).json(pet);
    } catch (error) {
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
      res.json(updatedPet);
    } catch (error) {
      res.status(500).json({ message: "Failed to vote" });
    }
  });

  app.get("/api/pets/:id/comments", async (req, res) => {
    try {
      const petId = parseInt(req.params.id);
      const petComments = await storage.getComments(petId);
      res.json(petComments);
    } catch (error) {
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
      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  return httpServer;
}
