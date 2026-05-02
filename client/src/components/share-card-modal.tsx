import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Link2, Check } from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook, SiX } from "react-icons/si";
import type { Pet } from "@shared/schema";

const categoryEmoji: Record<string, string> = {
  dog: "🐕", cat: "🐈", bird: "🐦", rabbit: "🐇", fish: "🐠", other: "🐾",
};
const categoryLabel: Record<string, string> = {
  dog: "Dog", cat: "Cat", bird: "Bird", rabbit: "Rabbit", fish: "Fish", other: "Other",
};

interface ShareCardModalProps {
  pet: Pet;
  rank?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const WIDTH = 1080;
const HEIGHT = 1920;

export function ShareCardModal({ pet, rank, open, onOpenChange }: ShareCardModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(true);

  const avgRating = pet.voteCount > 0 ? (pet.totalScore / pet.voteCount).toFixed(1) : "0.0";
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/pet/${pet.id}` : "";
  const shareText = `Vote for ${pet.name} on NowPetMe!`;

  useEffect(() => {
    if (!open) return;
    setGenerating(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      drawCard(ctx, img, pet, avgRating, rank);
      setPreviewUrl(canvas.toDataURL("image/png"));
      setGenerating(false);
    };
    img.onerror = () => {
      drawCard(ctx, null, pet, avgRating, rank);
      setPreviewUrl(canvas.toDataURL("image/png"));
      setGenerating(false);
    };
    img.src = pet.photoUrl;
  }, [open, pet, avgRating, rank]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `${pet.name.replace(/\s+/g, "-")}-nowpetme.png`;
    a.click();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-share-card">
        <DialogHeader>
          <DialogTitle>Share {pet.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="w-full aspect-[9/16] bg-muted rounded-md overflow-hidden flex items-center justify-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Share card preview" className="w-full h-full object-contain" data-testid="img-share-preview" />
            ) : (
              <span className="text-muted-foreground text-sm">Generating...</span>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="grid grid-cols-2 gap-2 w-full">
            <Button onClick={handleDownload} disabled={generating || !previewUrl} data-testid="button-download-card">
              <Download className="w-4 h-4 mr-1.5" /> Download PNG
            </Button>
            <Button variant="secondary" onClick={handleCopy} data-testid="button-copy-card-link">
              {copied ? <><Check className="w-4 h-4 mr-1.5 text-green-500" /> Copied!</> : <><Link2 className="w-4 h-4 mr-1.5" /> Copy Link</>}
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap justify-center w-full">
            <Button size="icon" variant="ghost" onClick={() => window.open("https://www.instagram.com/", "_blank")} data-testid="button-share-card-instagram" title="Instagram">
              <SiInstagram className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => window.open("https://www.tiktok.com/", "_blank")} data-testid="button-share-card-tiktok" title="TikTok">
              <SiTiktok className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank")} data-testid="button-share-card-facebook" title="Facebook">
              <SiFacebook className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank")} data-testid="button-share-card-x" title="X / Twitter">
              <SiX className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  pet: Pet,
  avgRating: string,
  rank?: number
) {
  // Gradient background — coral to teal
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, "#FF6B6B");
  grad.addColorStop(1, "#4ECDC4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Subtle paw print watermark pattern
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.font = "100px serif";
  ctx.fillStyle = "#ffffff";
  for (let y = 0; y < HEIGHT; y += 220) {
    for (let x = 0; x < WIDTH; x += 220) {
      ctx.fillText("🐾", x + ((y / 220) % 2) * 110, y + 100);
    }
  }
  ctx.restore();

  // Pet photo box
  const photoSize = 760;
  const photoX = (WIDTH - photoSize) / 2;
  const photoY = 320;
  const radius = 48;

  // Drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  roundRectPath(ctx, photoX, photoY, photoSize, photoSize, radius);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();

  // Photo (clipped)
  if (img) {
    ctx.save();
    roundRectPath(ctx, photoX, photoY, photoSize, photoSize, radius);
    ctx.clip();
    const ar = img.width / img.height;
    let dw = photoSize, dh = photoSize, dx = photoX, dy = photoY;
    if (ar > 1) {
      dw = photoSize * ar;
      dx = photoX - (dw - photoSize) / 2;
    } else {
      dh = photoSize / ar;
      dy = photoY - (dh - photoSize) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  // Top — Pet of the Day style label / rank
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "700 56px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("NowPetMe", WIDTH / 2, 160);

  ctx.font = "500 36px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("Vote for me!", WIDTH / 2, 220);

  // Name
  ctx.fillStyle = "#fff";
  ctx.font = "800 100px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(truncate(ctx, pet.name, WIDTH - 120), WIDTH / 2, photoY + photoSize + 140);

  // Category badge
  const catLabel = `${categoryEmoji[pet.category] || "🐾"} ${categoryLabel[pet.category] || pet.category}`;
  ctx.font = "600 42px 'Plus Jakarta Sans', sans-serif";
  const cw = ctx.measureText(catLabel).width + 60;
  const cx = (WIDTH - cw) / 2;
  const cy = photoY + photoSize + 180;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  roundRectPath(ctx, cx, cy, cw, 70, 35);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(catLabel, WIDTH / 2, cy + 50);

  // Stars + rating
  const starsY = photoY + photoSize + 320;
  const fullStars = Math.round(parseFloat(avgRating) / 2);
  let starsStr = "";
  for (let i = 0; i < 5; i++) starsStr += i < fullStars ? "★" : "☆";
  ctx.font = "700 84px serif";
  ctx.fillStyle = "#FFD93D";
  ctx.fillText(starsStr, WIDTH / 2, starsY);

  ctx.fillStyle = "#fff";
  ctx.font = "800 96px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(`${avgRating} / 10`, WIDTH / 2, starsY + 110);

  ctx.font = "500 40px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText(`${pet.voteCount} ${pet.voteCount === 1 ? "vote" : "votes"}`, WIDTH / 2, starsY + 170);

  // Rank badge if top 10
  if (rank && rank <= 10) {
    const rText = `#${rank} on NowPetMe 🏆`;
    ctx.font = "700 48px 'Plus Jakarta Sans', sans-serif";
    const rw = ctx.measureText(rText).width + 80;
    const rx = (WIDTH - rw) / 2;
    const ry = starsY + 220;
    ctx.fillStyle = "#FFD93D";
    roundRectPath(ctx, rx, ry, rw, 84, 42);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.fillText(rText, WIDTH / 2, ry + 58);
  }

  // Footer
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "600 38px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("nowpetme.com", WIDTH / 2, HEIGHT - 80);
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 0 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}
