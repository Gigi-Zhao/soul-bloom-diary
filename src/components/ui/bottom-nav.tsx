import { Link, useLocation } from "react-router-dom";
import { BookHeart, Users, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BottomNav Component
 * iOS-style bottom tab navigation bar with 4 main sections
 * Features smooth transitions and visual feedback
 */
export function BottomNav() {
  const location = useLocation();
  
  // Navigation items configuration
  const navItems = [
    {
      label: "Journals",
      icon: BookHeart,
      path: "/journals",
    },
    {
      label: "Friends",
      icon: Users,
      path: "/friends",
    },
    {
      label: "Moments",
      icon: Sparkles,
      path: "/moments",
    },
    {
      label: "Profile",
      icon: User,
      path: "/profile",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex justify-around items-center h-20 max-w-md mx-auto px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-300",
                isActive ? "text-primary scale-110" : "text-muted-foreground"
              )}
            >
              <Icon 
                className={cn(
                  "h-6 w-6 transition-all duration-300",
                  isActive && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                )} 
              />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
