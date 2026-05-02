import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Upload, ImagePlus, X, Check, Copy, LogIn, Mail } from "lucide-react";
import { insertPetSchema, CATEGORIES, PERSONALITY_TAGS } from "@shared/schema";
import type { Pet } from "@shared/schema";

const uploadFormSchema = insertPetSchema.extend({
  name: z.string().min(1, "Pet name is required").max(50),
  category: z.string().min(1, "Category is required"),
  breed: z.string().max(80).optional().or(z.literal("")),
  story: z.string().max(280).optional().or(z.literal("")),
  photoUrl: z.string().optional(),
});

type UploadFormValues = z.infer<typeof uploadFormSchema>;

const categoryLabels: Record<string, string> = {
  dog: "Dog",
  cat: "Cat",
  bird: "Bird",
  rabbit: "Rabbit",
  fish: "Fish",
  other: "Other",
};

export default function UploadPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [createdPet, setCreatedPet] = useState<Pet | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) {
        toast({ title: "Maximum 5 tags", variant: "destructive" });
        return prev;
      }
      return [...prev, tag];
    });
  };

  useEffect(() => {
    document.title = "Upload Your Pet - NowPetMe";
  }, []);

  if (!authLoading && !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full p-8 text-center">
          <LogIn className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2" data-testid="text-login-required">Sign in to upload</h2>
          <p className="text-muted-foreground text-sm mb-6">You need an account to upload your pets. Voting is always free!</p>
          <div className="flex flex-col gap-2">
            <Link href="/login">
              <Button className="w-full" data-testid="button-goto-login">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button variant="secondary" className="w-full" data-testid="button-goto-register">Create Account</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!authLoading && user && !user.emailVerified) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full p-8 text-center">
          <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2" data-testid="text-verify-required">Verify your email</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Please check your inbox at <strong>{user.email}</strong> and click the verification link before uploading.
          </p>
          <Button variant="secondary" onClick={() => navigate("/")} data-testid="button-back-home">
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      name: "",
      category: "",
      breed: "",
      story: "",
      photoUrl: "",
    },
  });

  const handleFile = useCallback((f: File) => {
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB", variant: "destructive" });
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file", variant: "destructive" });
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const uploadMutation = useMutation({
    mutationFn: async (values: UploadFormValues) => {
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("category", values.category);
      if (values.breed) formData.append("breed", values.breed);
      if (values.story) formData.append("story", values.story);
      formData.append("personalityTags", JSON.stringify(selectedTags));
      if (file) formData.append("photo", file);

      const res = await fetch("/api/pets", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Upload failed");
      }
      return res.json() as Promise<Pet>;
    },
    onSuccess: (pet: any) => {
      setCreatedPet(pet);
      queryClient.invalidateQueries({ queryKey: ["/api/pets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pets/top"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      const newAch = (pet?._newAchievements || []) as string[];
      if (newAch.length > 0) {
        toast({ title: "Achievement unlocked!", description: newAch.join(", ") });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: UploadFormValues) => {
    if (!file) {
      toast({ title: "Photo required", description: "Please upload a photo of your pet", variant: "destructive" });
      return;
    }
    uploadMutation.mutate(values);
  };

  if (createdPet) {
    const shareUrl = `${window.location.origin}/pet/${createdPet.id}`;
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2" data-testid="text-upload-success">Your pet is live!</h2>
          <p className="text-muted-foreground mb-6">
            {createdPet.name} is now ready to receive votes. Share the link to get more votes!
          </p>

          <div className="flex items-center gap-2 bg-muted rounded-md p-3 mb-6">
            <span className="text-sm truncate flex-1" data-testid="text-share-url">{shareUrl}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                toast({ title: "Copied!", description: "Link copied to clipboard" });
              }}
              data-testid="button-copy-link"
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate(`/pet/${createdPet.id}`)} data-testid="button-view-pet">
              View Pet Profile
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setCreatedPet(null);
                form.reset();
                setFile(null);
                setPreview(null);
              }}
              data-testid="button-upload-another"
            >
              Upload Another Pet
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-upload-title">Upload Your Pet</h1>
        <p className="text-muted-foreground" data-testid="text-upload-subtitle">Share your adorable pet with the world and see how they rank!</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div
            className={`relative border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="dropzone-photo"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              data-testid="input-photo-file"
            />

            {preview ? (
              <div className="relative inline-block">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-64 rounded-md mx-auto"
                  data-testid="img-preview"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreview(null);
                  }}
                  data-testid="button-remove-photo"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="py-8">
                <ImagePlus className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground mb-1">Drag & drop a photo here, or click to browse</p>
                <p className="text-xs text-muted-foreground/60">JPG, PNG, GIF, WebP - Max 5MB</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pet Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Buddy" maxLength={50} {...field} data-testid="input-pet-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat} data-testid={`option-category-${cat}`}>
                          {categoryLabels[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="breed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Breed (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Golden Retriever" maxLength={80} {...field} data-testid="input-breed" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <label className="text-sm font-medium leading-none">Personality (optional, up to 5)</label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PERSONALITY_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary"
                    }`}
                    data-testid={`tag-toggle-${tag}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            {selectedTags.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">{selectedTags.length}/5 selected</p>
            )}
          </div>

          <FormField
            control={form.control}
            name="story"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fun Fact / Story (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us something fun about your pet..."
                    maxLength={280}
                    className="resize-none"
                    rows={3}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.slice(0, 280))}
                    data-testid="textarea-story"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground text-right">{(field.value || "").length}/280</p>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={uploadMutation.isPending}
            data-testid="button-submit-upload"
          >
            {uploadMutation.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Uploading...
              </span>
            ) : (
              <>
                <Upload className="w-5 h-5 mr-2" />
                Upload Pet
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
