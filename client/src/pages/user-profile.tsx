import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PetCard } from "@/components/pet-card";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Trophy, Flame, Star, Pencil, Check, X } from "lucide-react";
import type { Pet } from "@shared/schema";

type UserProfile = {
  username: string;
  bio: string | null;
  xp: number;
  level: number;
  xpForNextLevel: number;
  xpForCurrentLevel: number;
  votingStreak: number;
  pets: Pet[];
  achievements: { code: string; unlockedAt: string; label: string; emoji: string; description: string }[];
  totalVotesReceived: number;
  petCount: number;
};

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/users", params.username],
  });

  useEffect(() => {
    if (profile) document.title = `@${profile.username} - NowPetMe`;
  }, [profile]);

  const isOwnProfile = !!user && profile?.username === user.username;

  const saveBio = useMutation({
    mutationFn: async (bio: string) => {
      await apiRequest("PATCH", "/api/users/me", { bio });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", params.username] });
      setEditing(false);
      toast({ title: "Profile updated!" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Skeleton className="h-32 mb-6" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2" data-testid="text-user-not-found">User not found</h1>
        <Link href="/"><Button>Back home</Button></Link>
      </div>
    );
  }

  const xpInLevel = profile.xp - profile.xpForCurrentLevel;
  const xpNeeded = profile.xpForNextLevel - profile.xpForCurrentLevel;
  const pct = Math.min(100, (xpInLevel / xpNeeded) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 pb-16">
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary" data-testid="avatar-user">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold" data-testid="text-profile-username">@{profile.username}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap text-sm">
              <Badge variant="default" data-testid="badge-level">
                <Star className="w-3 h-3 mr-1 fill-current" /> Level {profile.level}
              </Badge>
              {profile.votingStreak > 0 && (
                <Badge variant="secondary" data-testid="badge-streak">
                  <Flame className="w-3 h-3 mr-1 text-orange-500" /> {profile.votingStreak} day streak
                </Badge>
              )}
              <span className="text-muted-foreground" data-testid="text-pet-count">{profile.petCount} pets</span>
              <span className="text-muted-foreground" data-testid="text-total-votes">{profile.totalVotesReceived} votes received</span>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{profile.xp} XP</span>
                <span>{xpNeeded - xpInLevel} XP to level {profile.level + 1}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-chart-2 transition-all" style={{ width: `${pct}%` }} data-testid="bar-xp" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value.slice(0, 500))}
                placeholder="Tell others about your pets..."
                maxLength={500}
                rows={3}
                className="resize-none"
                data-testid="textarea-bio"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveBio.mutate(bioDraft)} disabled={saveBio.isPending} data-testid="button-save-bio">
                  <Check className="w-4 h-4 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} data-testid="button-cancel-bio">
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <p className="text-sm text-muted-foreground flex-1" data-testid="text-bio">
                {profile.bio || (isOwnProfile ? "Add a bio to tell others about your pets!" : "No bio yet.")}
              </p>
              {isOwnProfile && (
                <Button size="sm" variant="ghost" onClick={() => { setBioDraft(profile.bio || ""); setEditing(true); }} data-testid="button-edit-bio">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {profile.achievements.length > 0 && (
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" /> Achievements ({profile.achievements.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {profile.achievements.map((a) => (
              <div key={a.code} className="bg-muted rounded-md p-3 text-center hover-elevate" title={a.description} data-testid={`achievement-${a.code}`}>
                <div className="text-3xl mb-1">{a.emoji}</div>
                <div className="text-xs font-semibold">{a.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{a.description}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-bold mb-4">Pets ({profile.pets.length})</h2>
        {profile.pets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-pets">No pets uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {profile.pets.map((p) => <PetCard key={p.id} pet={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
