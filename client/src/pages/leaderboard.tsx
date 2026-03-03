import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryButtons } from "@/components/category-buttons";
import { Trophy, Star, Crown, Medal, Award } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import type { Pet } from "@shared/schema";

const categoryLabels: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  rabbit: "Rabbit",
  fish: "Fish",
  other: "Other",
};

const rankIcons = [Crown, Medal, Award];

export default function Leaderboard() {
  const [category, setCategory] = useState<string>("");

  useEffect(() => {
    document.title = "Leaderboard - Cutest Pets | NowPetMe";
  }, []);

  const queryParams = category
    ? `?limit=20&category=${category}`
    : "?limit=20";

  const { data: topPets, isLoading } = useQuery<Pet[]>({
    queryKey: ["/api/pets/top", queryParams],
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 pb-16">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-leaderboard-title">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">The cutest pets ranked by their ratings</p>
        </div>
      </div>

      <div className="mb-6">
        <CategoryButtons active={category} onSelect={setCategory} showAll />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      ) : topPets && topPets.length > 0 ? (
        <div className="space-y-2">
          {topPets.map((pet, index) => {
            const avgRating = pet.voteCount > 0 ? (pet.totalScore / pet.voteCount).toFixed(1) : "0.0";
            const RankIcon = rankIcons[index] || null;
            const isTop3 = index < 3;

            return (
              <Link key={pet.id} href={`/pet/${pet.id}`}>
                <div
                  className={`flex items-center gap-3 md:gap-4 p-3 rounded-md cursor-pointer transition-colors hover-elevate ${
                    isTop3 ? "bg-muted/50" : ""
                  }`}
                  data-testid={`leaderboard-row-${pet.id}`}
                >
                  <div className="w-8 text-center shrink-0">
                    {RankIcon ? (
                      <RankIcon
                        className={`w-6 h-6 mx-auto ${
                          index === 0
                            ? "text-amber-500"
                            : index === 1
                            ? "text-gray-400"
                            : "text-amber-700 dark:text-amber-600"
                        }`}
                      />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">#{index + 1}</span>
                    )}
                  </div>

                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-md overflow-hidden shrink-0 bg-muted">
                    <img
                      src={pet.photoUrl}
                      alt={pet.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      data-testid={`img-leaderboard-pet-${pet.id}`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate" data-testid={`text-lb-name-${pet.id}`}>
                        {pet.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {categoryLabels[pet.category]}
                      </Badge>
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">
                          Cutest {categoryLabels[pet.category]} 2026
                        </Badge>
                      )}
                    </div>
                    {pet.breed && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{pet.breed}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-sm" data-testid={`text-lb-rating-${pet.id}`}>{avgRating}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      ({pet.voteCount})
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No rated pets {category ? "in this category " : ""}yet.</p>
          <p className="text-sm mt-1">Pets need at least one vote to appear on the leaderboard.</p>
        </div>
      )}
    </div>
  );
}
