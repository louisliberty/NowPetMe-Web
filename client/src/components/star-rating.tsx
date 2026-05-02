import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  maxStars?: number;
}

export function StarRating({
  value = 0,
  onChange,
  readOnly = false,
  size = "md",
  maxStars = 10,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const displayValue = hoverValue || value;

  return (
    <div
      className={cn("flex gap-0.5", !readOnly && "cursor-pointer")}
      onMouseLeave={() => !readOnly && setHoverValue(0)}
      data-testid="star-rating"
    >
      {Array.from({ length: maxStars }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= displayValue;

        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            className={cn(
              "transition-all duration-150",
              !readOnly && "cursor-pointer star-bounce-on-hover",
              readOnly && "cursor-default"
            )}
            onClick={() => !readOnly && onChange?.(starValue)}
            onMouseEnter={() => !readOnly && setHoverValue(starValue)}
            data-testid={`star-${starValue}`}
          >
            <Star
              className={cn(
                sizeClasses[size],
                "transition-all duration-150",
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
