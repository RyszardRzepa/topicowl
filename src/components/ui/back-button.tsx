"use client";

import { useRouter } from "next/navigation";
import { Button } from "./button";
import { ChevronLeft } from "lucide-react";

interface BackButtonProps {
  label?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function BackButton({
  label = "Back to Articles",
  variant = "outline",
  size = "sm",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <Button variant={variant} size={size} onClick={handleBack} className="mb-4">
      <ChevronLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
