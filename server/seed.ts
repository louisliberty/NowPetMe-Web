import { db } from "./db";
import { pets } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(pets);

  if (Number(count) > 0) {
    return;
  }

  const seedPets = [
    {
      name: "Buddy",
      category: "dog",
      breed: "Golden Retriever",
      photoUrl: "/images/dog2.jpg",
      story: "Loves belly rubs and chasing squirrels in the park!",
      totalScore: 2314,
      voteCount: 247,
      ownerIp: "seed",
    },
    {
      name: "Whiskers",
      category: "cat",
      breed: "Orange Tabby",
      photoUrl: "/images/cat.jpg",
      story: "Professional napper and treat connoisseur.",
      totalScore: 1890,
      voteCount: 203,
      ownerIp: "seed",
    },
    {
      name: "Rio",
      category: "bird",
      breed: "Blue & Gold Macaw",
      photoUrl: "/images/bird.jpg",
      story: "Can say 'hello' in three languages!",
      totalScore: 1256,
      voteCount: 148,
      ownerIp: "seed",
    },
    {
      name: "Snowball",
      category: "rabbit",
      breed: "Holland Lop",
      photoUrl: "/images/rabbit.jpg",
      story: "Hops around the garden like a fluffy cloud.",
      totalScore: 985,
      voteCount: 112,
      ownerIp: "seed",
    },
    {
      name: "Neptune",
      category: "fish",
      breed: "Betta Fish",
      photoUrl: "/images/fish.jpg",
      story: "The most majestic swimmer in the tank!",
      totalScore: 756,
      voteCount: 89,
      ownerIp: "seed",
    },
  ];

  await db.insert(pets).values(seedPets);
  console.log("Database seeded with sample pets");
}
