import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PetCard } from "@/components/pet-card";
import { CategoryButtons } from "@/components/category-buttons";
import { PetOfDay } from "@/components/pet-of-day";
import { Heart, Upload, Trophy, ArrowRight, Sparkles, Flame, Shuffle } from "lucide-react";
import { useLocation } from "wouter";
import type { Pet } from "@shared/schema";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function Home() {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleSurprise = async () => {
    try {
      const res = await fetch("/api/pets/random");
      if (!res.ok) {
        toast({ title: "No pets to surprise you with yet!", variant: "destructive" });
        return;
      }
      const pet: Pet = await res.json();
      navigate(`/pet/${pet.id}`);
    } catch {
      toast({ title: "Couldn't find a random pet", variant: "destructive" });
    }
  };

  useEffect(() => {
    document.title = "NowPetMe - Prove Your Pet's the Cutest!";
    const params = new URLSearchParams(window.location.search);
    const verified = params.get("verified");
    if (verified === "success") {
      toast({ title: "Email verified!", description: "You can now upload pets and leave comments." });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.history.replaceState({}, "", "/");
    } else if (verified === "error") {
      toast({ title: "Verification failed", description: "The link may be invalid or expired.", variant: "destructive" });
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const { data: topPets, isLoading: topLoading } = useQuery<Pet[]>({
    queryKey: ["/api/pets/top", "?limit=10"],
  });

  const { data: recentPets, isLoading: recentLoading } = useQuery<Pet[]>({
    queryKey: ["/api/pets", "?sort=newest&limit=8"],
  });

  const { data: hotPets, isLoading: hotLoading } = useQuery<Pet[]>({
    queryKey: ["/api/pets/hot", "?limit=8"],
  });

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/20 py-16 md:py-24">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-accent/10 blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            <span>The #1 Pet Cuteness Rating Platform</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 leading-tight">
            Prove Your Pet's
            <br />
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              the Cutest!
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Upload your furry friend's best photo, let the world vote, and climb the leaderboards. Every pet deserves their moment in the spotlight.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">
            <Link href="/upload">
              <Button size="lg" data-testid="button-hero-upload">
                <Upload className="w-5 h-5 mr-2" />
                Upload Your Pet
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="secondary" size="lg" data-testid="button-hero-leaderboard">
                <Trophy className="w-5 h-5 mr-2" />
                View Leaderboard
              </Button>
            </Link>
            <Button variant="outline" size="lg" onClick={handleSurprise} data-testid="button-surprise-me">
              <Shuffle className="w-5 h-5 mr-2" />
              Surprise Me
            </Button>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pt-12 pb-4">
        <PetOfDay />
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Top Rated Pets
            </h2>
            <p className="text-sm text-muted-foreground mt-1">The cutest pets on the platform right now</p>
          </div>
          <Link href="/leaderboard">
            <Button variant="ghost" size="sm" data-testid="link-view-leaderboard">
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        {topLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : topPets && topPets.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {topPets.map((pet, i) => (
              <PetCard key={pet.id} pet={pet} rank={i + 1} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No rated pets yet. Be the first to upload!</p>
          </div>
        )}
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500" />
              Hot This Week
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Pets with the most votes in the last 7 days</p>
          </div>
        </div>
        {hotLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square rounded-md" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : hotPets && hotPets.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {hotPets.slice(0, 8).map((pet) => <PetCard key={pet.id} pet={pet} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No hot pets yet — start voting!</p>
        )}
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold mb-4">Browse by Category</h2>
        <CategoryButtons />
      </section>

      <section className="max-w-6xl mx-auto px-4 py-8 pb-16">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-2xl font-bold">Vote Now</h2>
            <p className="text-sm text-muted-foreground mt-1">Recently uploaded pets waiting for your vote</p>
          </div>
        </div>

        {recentLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square rounded-md" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : recentPets && recentPets.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {recentPets.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No pets uploaded yet. Be the first!</p>
          </div>
        )}
      </section>
    </div>
  );
}
