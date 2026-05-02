import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { KeyRound, Eye, EyeOff } from "lucide-react";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const token = new URLSearchParams(window.location.search).get("token") || "";

  useEffect(() => { document.title = "Reset Password - NowPetMe"; }, []);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async (values: Values) => {
    if (!token) {
      toast({ title: "Invalid reset link", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password: values.password });
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      navigate("/login");
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message || "Link may be expired", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-xl font-bold mb-2" data-testid="text-invalid-link">Invalid reset link</h1>
          <p className="text-muted-foreground text-sm mb-4">This link is missing a token. Please request a new one.</p>
          <Link href="/forgot-password">
            <Button data-testid="button-request-new">Request New Link</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-6">
          <KeyRound className="w-10 h-10 mx-auto mb-3 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-reset-title">Set new password</h1>
          <p className="text-muted-foreground text-sm mt-1">Choose a strong password (8+ characters).</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPw ? "text" : "password"} placeholder="New password" {...field} data-testid="input-new-password" />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPw(!showPw)} data-testid="button-toggle-newpw">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type={showPw ? "text" : "password"} placeholder="Confirm password" {...field} data-testid="input-confirm-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" size="lg" disabled={submitting} data-testid="button-reset-submit">
              {submitting ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </Form>
      </Card>
    </div>
  );
}
