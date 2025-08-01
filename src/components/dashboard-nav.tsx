"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

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
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center px-3 py-2.5 sm:py-2 rounded-md transition-colors text-sm sm:text-base",
              isActive
                ? "bg-stone-100 text-stone-900 font-medium"
                : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
            )}
          >
            <div className="mr-3 flex-shrink-0">
              {item.icon}
            </div>
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}