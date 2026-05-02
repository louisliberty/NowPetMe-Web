import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, ArrowLeft } from "lucide-react";

const schema = z.object({ email: z.string().email("Invalid email address") });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => { document.title = "Forgot Password - NowPetMe"; }, []);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", values);
      setSent(true);
      toast({ title: "Check your inbox", description: "If that email is registered, a reset link has been sent." });
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-6">
          <Mail className="w-10 h-10 mx-auto mb-3 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-forgot-title">Forgot password?</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Enter your email and we'll send you a link to reset it.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground" data-testid="text-forgot-sent">
              If that email is registered, a reset link is on its way. The link expires in 1 hour.
            </p>
            <Link href="/login">
              <Button variant="secondary" className="w-full" data-testid="button-back-to-login">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
              </Button>
            </Link>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} data-testid="input-forgot-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" size="lg" disabled={submitting} data-testid="button-forgot-submit">
                {submitting ? "Sending..." : "Send Reset Link"}
              </Button>
              <p className="text-center text-sm">
                <Link href="/login" className="text-muted-foreground hover:text-primary hover:underline" data-testid="link-back-login">
                  <ArrowLeft className="w-3 h-3 inline mr-1" /> Back to Sign In
                </Link>
              </p>
            </form>
          </Form>
        )}
      </Card>
    </div>
  );
}
