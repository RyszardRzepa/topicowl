"use client";

import { useEffect } from "react";
import { Coins, Loader2, Plus, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreditContext } from "@/components/dashboard/credit-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CreditBalanceProps {
  className?: string;
}

export function CreditBalance({ className }: CreditBalanceProps) {
  const { credits, loading, error, refreshCredits } = useCreditContext();

  // Credits will only refresh when explicitly requested or when the component mounts
  // Removed automatic refresh on tab focus to prevent unwanted data refreshing

  if (loading) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm ${className}`}>
        <div className="flex items-center space-x-2">
          <Coins className="h-4 w-4 text-amber-600" />
          <div className="flex items-center space-x-1">
            <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
            <span className="text-muted-foreground text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm ${className}`}>
        <div className="flex items-center space-x-2">
          <Coins className="h-4 w-4 text-red-600" />
          <span className="text-sm text-red-600">Error loading credits</span>
        </div>
      </div>
    );
  }

  const isLowCredits = credits !== null && credits <= 1;
  const hasNoCredits = credits === 0;

  const handleAddCredits = () => {
    // TODO: Implement add credits functionality
    // This could open a modal, redirect to a pricing page, etc.
    console.log("Add credits clicked");
  };

  return (
    <div className={`bg-white border-t border-gray-200 p-3 ${className}`}>
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Coins
            className={`h-4 w-4 ${hasNoCredits ? "text-red-600" : isLowCredits ? "text-amber-600" : "text-green-600"}`}
          />
          <span className="text-sm font-medium">Credits</span>
          <span
            className={`text-sm font-semibold ${hasNoCredits ? "text-red-600" : isLowCredits ? "text-amber-600" : "text-green-600"}`}
          >
            {credits}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Credits are shared across all your projects</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddCredits}
          className="w-full h-7 text-xs"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add Credits
        </Button>
      </div>
    </div>
  );
}
