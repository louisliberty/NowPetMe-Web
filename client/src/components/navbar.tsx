import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Upload, Trophy, Home, Menu, X, LogIn, LogOut, User, Flame, Star } from "lucide-react";
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
              <img src="/logo.svg" alt="" className="w-9 h-9" width={36} height={36} />
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
                    {typeof user.level === "number" && (
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold flex items-center gap-1" data-testid="text-user-level">
                        <Star className="w-3 h-3 fill-current" /> Lv {user.level}
                      </span>
                    )}
                    {user.votingStreak !== undefined && user.votingStreak > 0 && (
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1" data-testid="text-user-streak">
                        <Flame className="w-3 h-3" /> {user.votingStreak}
                      </span>
                    )}
                    <Link href={`/user/${user.username}`} data-testid="link-user-profile">
                      <Button variant="ghost" size="sm">
                        <User className="w-3.5 h-3.5 mr-1" />
                        {user.username}
                      </Button>
                    </Link>
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
                    <Link href={`/user/${user.username}`} data-testid="link-mobile-user-profile">
                      <Button variant="ghost" className="w-full justify-start" onClick={() => setMobileOpen(false)}>
                        <User className="w-3.5 h-3.5 mr-2" />
                        {user.username}
                        {typeof user.level === "number" && <span className="ml-auto text-xs text-primary">Lv {user.level}</span>}
                      </Button>
                    </Link>
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
