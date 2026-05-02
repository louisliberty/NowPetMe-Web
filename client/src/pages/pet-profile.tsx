import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/star-rating";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Star, Link2, Check as CheckIcon, MessageCircle, Clock, Send, ArrowLeft, LogIn, ThumbsUp, User as UserIcon, MoreVertical, Pencil, Trash2, Share2, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { VoteBurst } from "@/components/vote-burst";
import { AnimatedNumber } from "@/components/animated-number";
import { ShareCardModal } from "@/components/share-card-modal";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import type { Pet, CommentWithUser } from "@shared/schema";

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      size="sm"
      onClick={handleCopy}
      className="bg-[#6C63FF] text-white border-[#6C63FF] transition-all duration-200"
      data-testid="button-copy-share-link"
    >
      {copied ? (
        <>
          <CheckIcon className="w-3.5 h-3.5 mr-1.5 text-green-500" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Link2 className="w-3.5 h-3.5 mr-1.5" />
          Copy Link
        </>
      )}
    </Button>
  );
}

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

  const { user } = useAuth();
  const [selectedRating, setSelectedRating] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [burstRating, setBurstRating] = useState<number | null>(null);
  const [starFlash, setStarFlash] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const reportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/reports", { targetType: "pet", targetId: petId, reason: reportReason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Thanks for keeping NowPetMe safe." });
      setReportOpen(false);
      setReportReason("");
    },
    onError: () => toast({ title: "Failed to submit report", variant: "destructive" }),
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ commentId, emoji }: { commentId: number; emoji: string }) => {
      const res = await apiRequest("POST", `/api/comments/${commentId}/reactions`, { emoji });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pets", petId.toString(), "comments"] });
    },
  });

  const REACTION_EMOJIS = ["❤️", "😂", "😮", "🐾", "👏"];

  const { data: pet, isLoading: petLoading } = useQuery<Pet & { hasVoted: boolean }>({
    queryKey: ["/api/pets", petId.toString()],
  });

  useEffect(() => {
    if (pet) {
      document.title = `${pet.name} - ${categoryLabels[pet.category] || "Pet"} | NowPetMe`;
    }
  }, [pet]);

  const { data: petComments, isLoading: commentsLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/pets", petId.toString(), "comments"],
  });

  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const editCommentMutation = useMutation({
    mutationFn: async ({ commentId, text }: { commentId: number; text: string }) => {
      const res = await apiRequest("PATCH", `/api/comments/${commentId}`, { text });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pets", petId.toString(), "comments"] });
      setEditingCommentId(null);
      setEditText("");
      toast({ title: "Comment updated!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await apiRequest("DELETE", `/api/comments/${commentId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pets", petId.toString(), "comments"] });
      toast({ title: "Comment deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const res = await apiRequest("POST", `/api/comments/${commentId}/like`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pets", petId.toString(), "comments"] });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (score: number) => {
      const res = await apiRequest("POST", `/api/pets/${petId}/vote`, { score });
      return { ...(await res.json()), _score: score };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pets", petId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["/api/pets/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pets"] });
      const score = data?._score ?? selectedRating;
      setBurstRating(score);
      if (score >= 8) {
        setStarFlash(true);
        setTimeout(() => setStarFlash(false), 900);
      }
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
          <div className="relative rounded-md overflow-hidden bg-muted">
            <img
              src={pet.photoUrl}
              alt={pet.name}
              className="w-full aspect-square object-cover"
              data-testid="img-pet-hero"
            />
            {burstRating !== null && (
              <VoteBurst rating={burstRating} onDone={() => setBurstRating(null)} />
            )}
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
              <Star className={`w-6 h-6 fill-amber-400 text-amber-400 ${starFlash ? "star-flash" : ""}`} />
              <span className="text-2xl font-bold" data-testid="text-avg-rating">
                <AnimatedNumber value={parseFloat(avgRating)} decimals={1} />
              </span>
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
                size="sm"
                className="bg-black dark:bg-white text-white dark:text-black border-black dark:border-white"
                onClick={() => window.open(`https://www.tiktok.com/`, "_blank")}
                data-testid="button-share-tiktok"
              >
                <SiTiktok className="w-3.5 h-3.5 mr-1.5" /> TikTok
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white border-[#ee2a7b]"
                onClick={() => window.open(`https://www.instagram.com/`, "_blank")}
                data-testid="button-share-instagram"
              >
                <SiInstagram className="w-3.5 h-3.5 mr-1.5" /> Instagram
              </Button>
              <Button
                size="sm"
                className="bg-[#1877F2] text-white border-[#1877F2]"
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank")}
                data-testid="button-share-facebook"
              >
                <SiFacebook className="w-3.5 h-3.5 mr-1.5" /> Facebook
              </Button>
              <CopyLinkButton url={shareUrl} />
              <Button
                size="sm"
                variant="default"
                className="bg-gradient-to-r from-primary to-chart-2 text-white border-0"
                onClick={() => setShareCardOpen(true)}
                data-testid="button-share-card"
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" /> Share Card
              </Button>
            </div>
          </div>
          <ShareCardModal pet={pet} open={shareCardOpen} onOpenChange={setShareCardOpen} />

          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogTrigger asChild>
              <button className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 mt-2" data-testid="button-report-pet">
                <Flag className="w-3 h-3" /> Report this pet
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report pet</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Tell us what's wrong. Pets reported by 5+ people are auto-hidden.</p>
              <Textarea
                placeholder="Reason (optional)"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value.slice(0, 280))}
                maxLength={280}
                rows={3}
                data-testid="textarea-report-reason"
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setReportOpen(false)} data-testid="button-cancel-report">Cancel</Button>
                <Button variant="destructive" onClick={() => reportMutation.mutate()} disabled={reportMutation.isPending} data-testid="button-submit-report">
                  Submit Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Comments
        </h2>

        {user && user.emailVerified ? (
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
        ) : (
          <div className="bg-muted rounded-md p-4 mb-6 text-center">
            <p className="text-sm text-muted-foreground mb-2" data-testid="text-comment-login-prompt">
              {user ? "Verify your email to leave comments" : "Sign in to leave a comment"}
            </p>
            {!user && (
              <Link href="/login">
                <Button size="sm" variant="secondary" data-testid="button-comment-login">
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        )}

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
                className="bg-muted rounded-md px-3 py-2.5 relative"
                data-testid={`comment-${comment.id}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary" data-testid={`comment-username-${comment.id}`}>
                    <UserIcon className="w-3 h-3" />
                    {comment.username || "Anonymous"}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ""}
                  </span>
                  <div className="ml-auto">
                    {user && comment.userId === user.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 rounded hover:bg-background/50 text-muted-foreground" data-testid={`button-comment-menu-${comment.id}`}>
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => { setEditingCommentId(comment.id); setEditText(comment.text); }}
                            data-testid={`button-edit-comment-${comment.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                            data-testid={`button-delete-comment-${comment.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
                {editingCommentId === comment.id ? (
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value.slice(0, 50))}
                      maxLength={50}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editText.trim()) {
                          editCommentMutation.mutate({ commentId: comment.id, text: editText.trim() });
                        }
                        if (e.key === "Escape") {
                          setEditingCommentId(null);
                          setEditText("");
                        }
                      }}
                      autoFocus
                      data-testid={`input-edit-comment-${comment.id}`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!editText.trim() || editCommentMutation.isPending}
                      onClick={() => editCommentMutation.mutate({ commentId: comment.id, text: editText.trim() })}
                      data-testid={`button-save-comment-${comment.id}`}
                    >
                      <CheckIcon className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm" data-testid={`comment-text-${comment.id}`}>{comment.text}</p>
                      <button
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                          comment.hasLiked
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                        }`}
                        onClick={() => likeMutation.mutate(comment.id)}
                        disabled={likeMutation.isPending}
                        data-testid={`button-like-comment-${comment.id}`}
                      >
                        <ThumbsUp className={`w-3.5 h-3.5 ${comment.hasLiked ? "fill-current" : ""}`} />
                        {comment.likeCount > 0 && (
                          <span data-testid={`like-count-${comment.id}`}>{comment.likeCount}</span>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {REACTION_EMOJIS.map((emoji) => {
                        const r = comment.reactions?.find((x) => x.emoji === emoji);
                        const count = r?.count || 0;
                        const mine = !!r?.mine;
                        return (
                          <button
                            key={emoji}
                            onClick={() => reactionMutation.mutate({ commentId: comment.id, emoji })}
                            disabled={reactionMutation.isPending}
                            className={`text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                              mine
                                ? "bg-primary/10 border-primary text-primary"
                                : "bg-background border-border text-muted-foreground hover:border-primary"
                            }`}
                            data-testid={`button-reaction-${comment.id}-${emoji}`}
                          >
                            <span>{emoji}</span>
                            {count > 0 && <span className="ml-1">{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
