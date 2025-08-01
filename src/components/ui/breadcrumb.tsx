"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex", className)}>
      <ol className="flex items-center space-x-1 text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-stone-400 mx-1 flex-shrink-0" />
            )}
            {item.current || !item.href ? (
              <span
                className={cn(
                  "font-medium truncate max-w-[200px] sm:max-w-[300px]",
                  item.current
                    ? "text-stone-900"
                    : "text-stone-600"
                )}
                aria-current={item.current ? "page" : undefined}
                title={item.label}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-stone-600 hover:text-stone-900 transition-colors truncate max-w-[200px] sm:max-w-[300px]"
                title={item.label}
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}