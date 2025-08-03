"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navigationItems = [
  {
    href: "/dashboard/articles",
    label: "Articles",
    icon: (
      <FileText className="w-5 h-5" />
    ),
  },
  {
    href: "/dashboard/reddit",
    label: "Reddit",
    icon: (
      <MessageSquare className="w-5 h-5" />
    ),
  },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-4 sm:mt-6 space-y-1 sm:space-y-2">
      {navigationItems.map((item) => {
        const isActive = 
          pathname === item.href || 
          (item.href === "/dashboard/articles" && pathname === "/dashboard");
        
        return (
          <Button
            key={item.href}
            asChild
            variant={isActive ? "default" : "ghost"}
            className={cn(
              "w-full justify-start text-sm sm:text-base h-auto py-2.5 sm:py-2",
              isActive 
                ? "font-medium" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Link href={item.href}>
              <div className="mr-3 flex-shrink-0">
                {item.icon}
              </div>
              <span className="truncate">{item.label}</span>
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}