import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PetCard } from "@/components/pet-card";
import { CategoryButtons } from "@/components/category-buttons";
import { Dog, Cat, Bird, Rabbit, Fish, Shapes, Heart, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import type { Pet } from "@shared/schema";

const categoryMeta: Record<string, { label: string; icon: any }> = {
  dog: { label: "Dogs", icon: Dog },
  cat: { label: "Cats", icon: Cat },
  bird: { label: "Birds", icon: Bird },
  rabbit: { label: "Rabbits", icon: Rabbit },
  fish: { label: "Fish", icon: Fish },
  other: { label: "Other", icon: Shapes },
};

type SortOption = "newest" | "highest" | "most_votes";

export default function CategoryPage() {
  const params = useParams<{ category: string }>();
  const category = params.category;
  const meta = categoryMeta[category];
  const [sort, setSort] = useState<SortOption>("newest");
  const [limit, setLimit] = useState(12);

  const { data: pets, isLoading } = useQuery<Pet[]>({
    queryKey: ["/api/pets", `?category=${category}&sort=${sort}&limit=${limit}`],
  });

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/pets/count", `?category=${category}`],
  });

  useEffect(() => {
    if (meta) {
      document.title = `${meta.label} - Cutest ${meta.label} | PetRateHub`;
    }
  }, [meta]);

  if (!meta) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Category not found</h1>
        <Link href="/">
          <Button><ArrowLeft className="w-4 h-4 mr-2" /> Back to Home</Button>
        </Link>
      </div>
    );
  }

  const Icon = meta.icon;
  const totalCount = countData?.count || 0;
  const hasMore = pets && pets.length < totalCount;

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "newest", label: "Newest" },
    { value: "highest", label: "Highest Rated" },
    { value: "most_votes", label: "Most Votes" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8 pb-16">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-category-title">{meta.label}</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "pet" : "pets"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 my-6">
        {sortOptions.map((opt) => (
          <Button
            key={opt.value}
            variant={sort === opt.value ? "default" : "secondary"}
            size="sm"
            onClick={() => { setSort(opt.value); setLimit(12); }}
            data-testid={`button-sort-${opt.value}`}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square rounded-md" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : pets && pets.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pets.map((pet, i) => (
              <PetCard key={pet.id} pet={pet} rank={sort === "highest" ? i + 1 : undefined} />
            ))}
          </div>
          {hasMore && (
            <div className="text-center mt-8">
              <Button
                variant="secondary"
                onClick={() => setLimit((l) => l + 12)}
                data-testid="button-load-more"
              >
                Load More
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No {meta.label.toLowerCase()} uploaded yet.</p>
          <Link href="/upload">
            <Button variant="secondary" className="mt-4" data-testid="button-upload-first">
              Upload the first {meta.label.toLowerCase().replace(/s$/, "")}!
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
