"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function SettingsDropdown() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const isActive = pathname?.startsWith("/dashboard/settings");

  return (
    <div className="w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={isActive ? "default" : "ghost"}
            className={cn(
              "h-auto w-full justify-start py-2.5 text-sm",
              isActive
                ? "font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Settings className="mr-3 h-5 w-5 flex-shrink-0" />
            <span className="truncate">Settings</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 rounded-lg"
          side="right"
          align="end"
          sideOffset={4}
        >
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-3 py-2 text-left text-sm">
              <User className="h-4 w-4" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {user?.emailAddresses[0]?.emailAddress ?? "User"}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/settings" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Account Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
