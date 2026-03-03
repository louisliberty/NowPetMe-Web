import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Heart, Upload, Trophy, Home, Menu, X, LogIn, LogOut, User } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Upload", path: "/upload", icon: Upload },
  { label: "Leaderboard", path: "/leaderboard", icon: Trophy },
];

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout, isLoading } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logged out" });
    } catch {
      toast({ title: "Logout failed", variant: "destructive" });
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between gap-2 h-16">
          <Link href="/" data-testid="link-home-logo">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold tracking-tight">NowPetMe</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={location === item.path ? "secondary" : "ghost"}
                  size="sm"
                  data-testid={`link-nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-4 h-4 mr-1.5" />
                  {item.label}
                </Button>
              </Link>
            ))}

            {!isLoading && (
              <>
                {user ? (
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-sm text-muted-foreground flex items-center gap-1" data-testid="text-username">
                      <User className="w-3.5 h-3.5" />
                      {user.username}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      data-testid="button-logout"
                    >
                      <LogOut className="w-4 h-4 mr-1.5" />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 ml-2">
                    <Link href="/login">
                      <Button variant="ghost" size="sm" data-testid="link-nav-login">
                        <LogIn className="w-4 h-4 mr-1.5" />
                        Login
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button size="sm" data-testid="link-nav-register">
                        Sign Up
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-1">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={location === item.path ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setMobileOpen(false)}
                  data-testid={`link-mobile-nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Button>
              </Link>
            ))}

            {!isLoading && (
              <>
                {user ? (
                  <>
                    <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-1" data-testid="text-mobile-username">
                      <User className="w-3.5 h-3.5" />
                      {user.username}
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => { handleLogout(); setMobileOpen(false); }}
                      data-testid="button-mobile-logout"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setMobileOpen(false)}
                        data-testid="link-mobile-login"
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Login
                      </Button>
                    </Link>
                    <Link href="/register">
                      <Button
                        className="w-full justify-start"
                        onClick={() => setMobileOpen(false)}
                        data-testid="link-mobile-register"
                      >
                        Sign Up
                      </Button>
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
