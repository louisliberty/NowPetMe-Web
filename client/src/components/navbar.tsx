import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Heart, Upload, Trophy, Home, Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Upload", path: "/upload", icon: Upload },
  { label: "Leaderboard", path: "/leaderboard", icon: Trophy },
];

export function Navbar() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
          </div>
        )}
      </div>
    </nav>
  );
}
