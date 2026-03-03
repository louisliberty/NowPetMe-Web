import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  const handleResend = async () => {
    setResending(true);
    try {
      await apiRequest("POST", "/api/auth/resend-verification");
      toast({ title: "Verification email sent!", description: "Check your inbox for the new link." });
    } catch {
      toast({ title: "Failed to resend", description: "Please try again later.", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800" data-testid="banner-verify-email">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200 truncate">
            <span className="hidden sm:inline">Please verify your email at <strong>{user.email}</strong> to upload pets and comment. </span>
            <span className="sm:hidden">Verify your email to unlock all features. </span>
            <button
              onClick={handleResend}
              disabled={resending}
              className="underline font-medium hover:no-underline"
              data-testid="button-resend-verification"
            >
              {resending ? "Sending..." : "Resend email"}
            </button>
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 shrink-0"
          data-testid="button-dismiss-banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
