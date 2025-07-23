import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'default':
        return "bg-stone-100 text-stone-700 border-stone-200";
      case 'secondary':
        return "bg-stone-50 text-stone-600 border-stone-100";
      case 'outline':
        return "bg-transparent text-stone-700 border-stone-200";
      case 'gray':
        return "bg-stone-100 text-stone-500 border-stone-200";
      case 'brown':
        return "text-notion-brown-text bg-notion-brown-bg border-notion-brown-bg";
      case 'orange':
        return "text-notion-orange-text bg-notion-orange-bg border-notion-orange-bg";
      case 'yellow':
        return "text-notion-yellow-text bg-notion-yellow-bg border-notion-yellow-bg";
      case 'green':
        return "text-notion-green-text bg-notion-green-bg border-notion-green-bg";
      case 'blue':
        return "text-notion-blue-text bg-notion-blue-bg border-notion-blue-bg";
      case 'purple':
        return "text-notion-purple-text bg-notion-purple-bg border-notion-purple-bg";
      case 'pink':
        return "text-notion-pink-text bg-notion-pink-bg border-notion-pink-bg";
      case 'red':
        return "text-notion-red-text bg-notion-red-bg border-notion-red-bg";
      default:
        return "bg-stone-100 text-stone-700 border-stone-200";
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-1 text-xs font-medium transition-colors font-inter",
        getVariantClasses(),
        className
      )}
      {...props}
    />
  );
}

export { Badge };