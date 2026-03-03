import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/star-rating";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Star, Share2, MessageCircle, Clock, Send, ArrowLeft } from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import type { Pet, Comment } from "@shared/schema";

const categoryLabels: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  rabbit: "Rabbit",
  fish: "Fish",
  other: "Other",
};

export default function PetProfile() {
  const params = useParams<{ id: string }>();
  const petId = parseInt(params.id);
  const { toast } = useToast();

  const [selectedRating, setSelectedRating] = useState(0);
  const [commentText, setCommentText] = useState("");

  const { data: pet, isLoading: petLoading } = useQuery<Pet & { hasVoted: boolean }>({
    queryKey: ["/api/pets", petId.toString()],
  });

  useEffect(() => {
    if (pet) {
      document.title = `${pet.name} - ${categoryLabels[pet.category] || "Pet"} | NowPetMe`;
    }
  }, [pet]);

  const { data: petComments, isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ["/api/pets", petId.toString(), "comments"],
  });

  const voteMutation = useMutation({
    mutationFn: async (score: number) => {
      const res = await apiRequest("POST", `/api/pets/${petId}/vote`, { score });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pets", petId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["/api/pets/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pets"] });
      toast({ title: "Vote recorded!", description: "Thanks for rating this cutie!" });
      setSelectedRating(0);
    },
    onError: (error: Error) => {
      toast({ title: "Can't vote", description: error.message, variant: "destructive" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", `/api/pets/${petId}/comments`, { text });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pets", petId.toString(), "comments"] });
      setCommentText("");
      toast({ title: "Comment added!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  if (petLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="aspect-square max-w-lg rounded-md mb-6" />
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-6 w-32" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4" data-testid="text-pet-not-found">Pet not found</h1>
        <Link href="/">
          <Button data-testid="button-back-home">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  const avgRating = pet.voteCount > 0 ? (pet.totalScore / pet.voteCount).toFixed(1) : "0.0";
  const shareUrl = `${window.location.origin}/pet/${pet.id}`;
  const shareText = `My ${categoryLabels[pet.category]?.toLowerCase() || "pet"} got ${avgRating}/10 on NowPetMe! Check out ${pet.name}!`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 pb-16">
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back
        </Button>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="rounded-md overflow-hidden bg-muted">
            <img
              src={pet.photoUrl}
              alt={pet.name}
              className="w-full aspect-square object-cover"
              data-testid="img-pet-hero"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-pet-name">{pet.name}</h1>
              <Badge variant="secondary">{categoryLabels[pet.category]}</Badge>
            </div>
            {pet.breed && (
              <p className="text-muted-foreground" data-testid="text-pet-breed">{pet.breed}</p>
            )}
          </div>

          <div className="flex items-center gap-3 py-3 border-y">
            <div className="flex items-center gap-1.5">
              <Star className="w-6 h-6 fill-amber-400 text-amber-400" />
              <span className="text-2xl font-bold" data-testid="text-avg-rating">{avgRating}</span>
              <span className="text-muted-foreground">/10</span>
            </div>
            <span className="text-sm text-muted-foreground" data-testid="text-vote-count">
              ({pet.voteCount} {pet.voteCount === 1 ? "vote" : "votes"})
            </span>
          </div>

          {pet.story && (
            <p className="text-sm leading-relaxed" data-testid="text-pet-story">{pet.story}</p>
          )}

          {!pet.hasVoted ? (
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Rate this cutie!</h3>
              <StarRating value={selectedRating} onChange={setSelectedRating} size="md" />
              <Button
                className="w-full"
                disabled={!selectedRating || voteMutation.isPending}
                onClick={() => voteMutation.mutate(selectedRating)}
                data-testid="button-submit-vote"
              >
                {voteMutation.isPending ? "Submitting..." : `Rate ${selectedRating}/10`}
              </Button>
            </Card>
          ) : (
            <Card className="p-4 text-center">
              <p className="text-sm text-muted-foreground" data-testid="text-already-voted">
                You've already voted for {pet.name}!
              </p>
            </Card>
          )}

          <div>
            <h3 className="font-semibold text-sm mb-2">Share</h3>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(`https://www.tiktok.com/`, "_blank")}
                data-testid="button-share-tiktok"
              >
                <SiTiktok className="w-3.5 h-3.5 mr-1.5" /> TikTok
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(`https://www.instagram.com/`, "_blank")}
                data-testid="button-share-instagram"
              >
                <SiInstagram className="w-3.5 h-3.5 mr-1.5" /> Instagram
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank")}
                data-testid="button-share-facebook"
              >
                <SiFacebook className="w-3.5 h-3.5 mr-1.5" /> Share
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast({ title: "Link copied!" });
                }}
                data-testid="button-copy-share-link"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" /> Copy Link
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Comments
        </h2>

        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Leave a comment (50 chars max)"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value.slice(0, 50))}
            maxLength={50}
            onKeyDown={(e) => {
              if (e.key === "Enter" && commentText.trim()) {
                commentMutation.mutate(commentText.trim());
              }
            }}
            data-testid="input-comment"
          />
          <Button
            size="icon"
            disabled={!commentText.trim() || commentMutation.isPending}
            onClick={() => commentMutation.mutate(commentText.trim())}
            data-testid="button-submit-comment"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {commentsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : petComments && petComments.length > 0 ? (
          <div className="space-y-2">
            {petComments.map((comment) => (
              <div
                key={comment.id}
                className="bg-muted rounded-md px-3 py-2.5 flex items-start justify-between gap-2"
                data-testid={`comment-${comment.id}`}
              >
                <p className="text-sm">{comment.text}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No comments yet. Be the first!
          </p>
        )}
      </div>
    </div>
  );
}
