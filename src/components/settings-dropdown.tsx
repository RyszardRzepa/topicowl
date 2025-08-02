"use client";

import { useState } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, User } from "lucide-react";

export function SettingsDropdown() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-stone-600 transition-colors hover:bg-stone-50 hover:text-stone-900">
          <Settings className="mr-3 h-4 w-4" />
          Settings
        </button>
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
  );
}