import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MessageCircle } from "lucide-react";
import type { Pet } from "@shared/schema";

const categoryLabels: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  rabbit: "Rabbit",
  fish: "Fish",
  other: "Other",
};

interface PetCardProps {
  pet: Pet;
  rank?: number;
}

export function PetCard({ pet, rank }: PetCardProps) {
  const avgRating = pet.voteCount > 0 ? (pet.totalScore / pet.voteCount).toFixed(1) : "---";

  return (
    <Link href={`/pet/${pet.id}`}>
      <Card
        className="group cursor-pointer hover-elevate overflow-visible transition-all duration-200"
        data-testid={`card-pet-${pet.id}`}
      >
        <div className="relative overflow-hidden rounded-t-md">
          {rank && (
            <div className="absolute top-2 left-2 z-10">
              <Badge variant="default" className="text-xs font-bold">
                #{rank}
              </Badge>
            </div>
          )}
          <div className="absolute top-2 right-2 z-10">
            <Badge variant="secondary" className="text-xs">
              {categoryLabels[pet.category] || pet.category}
            </Badge>
          </div>
          <div className="aspect-square overflow-hidden">
            <img
              src={pet.photoUrl}
              alt={pet.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
              data-testid={`img-pet-${pet.id}`}
            />
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-sm truncate" data-testid={`text-petname-${pet.id}`}>
            {pet.name}
          </h3>
          {pet.breed && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{pet.breed}</p>
          )}
          <div className="flex items-center justify-between gap-1 mt-2">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold" data-testid={`text-rating-${pet.id}`}>
                {avgRating}
              </span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MessageCircle className="w-3 h-3" />
              <span className="text-xs">{pet.voteCount} votes</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
