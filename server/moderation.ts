import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ModerationResult = {
  approved: boolean;
  reason: string;
};

export async function moderateImage(filePath: string): Promise<ModerationResult> {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = filePath.endsWith(".png") ? "image/png" : "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content: `You are an image moderator for a pet photo website called NowPetMe. Analyze the uploaded image and respond with a JSON object: {"approved": true/false, "reason": "brief explanation"}.

Rules:
- APPROVE if the image contains a pet animal (dog, cat, bird, rabbit, fish, hamster, turtle, lizard, etc.)
- REJECT if the image is a selfie or photo of a human without any pet
- REJECT if the image contains offensive, violent, or inappropriate content
- REJECT if the image does not contain any animal at all (e.g. food, objects, landscapes)
- If a human appears WITH a pet, that is acceptable - APPROVE it
- Respond ONLY with the JSON object, no other text.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "low",
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return { approved: false, reason: "Unable to analyze image" };
    }

    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);
    return {
      approved: !!result.approved,
      reason: result.reason || "No reason provided",
    };
  } catch (error) {
    console.error("Image moderation error:", error);
    return { approved: false, reason: "Image moderation service unavailable. Please try again later." };
  }
}
