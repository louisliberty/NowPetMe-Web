import { useEffect, useState } from "react";

interface Particle {
  id: number;
  emoji: string;
  left: number;
  drift: number;
  delay: number;
  duration: number;
  size: number;
}

interface VoteBurstProps {
  rating: number;
  onDone: () => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export function VoteBurst({ rating, onDone }: VoteBurstProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      const t = setTimeout(onDone, 200);
      return () => clearTimeout(t);
    }

    let emoji = "🩷";
    let count = 8;
    let direction: "up" | "down" = "up";

    if (rating >= 8) {
      emoji = "🐾";
      count = 14;
      direction = "up";
    } else if (rating >= 4) {
      emoji = "🩷";
      count = 8;
      direction = "up";
    } else if (rating >= 1) {
      emoji = "😢";
      count = 5;
      direction = "down";
    }

    const next: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      emoji,
      left: 20 + Math.random() * 60,
      drift: (Math.random() - 0.5) * 80,
      delay: Math.random() * 200,
      duration: 900 + Math.random() * 500,
      size: 22 + Math.random() * 14,
    }));
    setParticles(next);

    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [rating, onDone]);

  if (!particles.length) return null;

  const animName = particles[0]?.emoji === "😢" ? "vote-burst-down" : "vote-burst-up";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute"
          style={{
            left: `${p.left}%`,
            bottom: animName === "vote-burst-up" ? "20%" : "70%",
            fontSize: `${p.size}px`,
            animation: `${animName} ${p.duration}ms ease-out ${p.delay}ms forwards`,
            ["--drift" as any]: `${p.drift}px`,
            opacity: 0,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
