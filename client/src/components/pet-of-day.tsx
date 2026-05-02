import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Crown, Star, ArrowRight } from "lucide-react";
import type { Pet } from "@shared/schema";

const categoryLabels: Record<string, string> = {
  dog: "Dog", cat: "Cat", bird: "Bird", rabbit: "Rabbit", fish: "Fish", other: "Other",
};

export function PetOfDay() {
  const { data: pet, isLoading } = useQuery<Pet | null>({
    queryKey: ["/api/pets/of-the-day"],
  });

  if (isLoading) {
    return <Skeleton className="h-72 rounded-lg" data-testid="skeleton-pet-of-day" />;
  }
  if (!pet) return null;

  const avg = pet.voteCount > 0 ? (pet.totalScore / pet.voteCount).toFixed(1) : "0.0";

  return (
    <div className="potd-shimmer-wrap rounded-lg" data-testid="card-pet-of-day">
      <Card className="potd-card relative overflow-hidden border-2 border-amber-400 bg-gradient-to-br from-amber-50 via-white to-amber-50 dark:from-amber-950/30 dark:via-background dark:to-amber-950/30">
        <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-0">
          <Link href={`/pet/${pet.id}`}>
            <div className="aspect-square sm:aspect-auto sm:h-full overflow-hidden bg-muted cursor-pointer">
              <img
                src={pet.photoUrl}
                alt={pet.name}
                className="w-full h-full object-cover"
                data-testid={`img-pet-of-day-${pet.id}`}
              />
            </div>
          </Link>
          <div className="p-5 sm:p-6 flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-amber-400/20 text-amber-700 dark:text-amber-300 text-xs font-bold mb-3">
              <Crown className="w-4 h-4" /> Pet of the Day
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-1" data-testid="text-potd-name">{pet.name}</h2>
            <p className="text-sm text-muted-foreground mb-3">
              {categoryLabels[pet.category] || pet.category}
              {pet.breed ? ` · ${pet.breed}` : ""}
            </p>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1">
                <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                <span className="text-xl font-bold" data-testid="text-potd-rating">{avg}</span>
                <span className="text-sm text-muted-foreground">/10</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {pet.voteCount} {pet.voteCount === 1 ? "vote" : "votes"}
              </span>
            </div>
            <Link href={`/pet/${pet.id}`}>
              <Button size="sm" data-testid="button-potd-vote">
                Vote Now <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
