import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import UploadPage from "@/pages/upload";
import PetProfile from "@/pages/pet-profile";
import CategoryPage from "@/pages/category";
import Leaderboard from "@/pages/leaderboard";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/upload" component={UploadPage} />
      <Route path="/pet/:id" component={PetProfile} />
      <Route path="/category/:category" component={CategoryPage} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground">
            <Navbar />
            <main>
              <Router />
            </main>
          </div>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
