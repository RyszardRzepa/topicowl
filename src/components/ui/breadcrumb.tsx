"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
  icon?: string;
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
              <ChevronRight className="mx-1 h-4 w-4 flex-shrink-0 text-stone-400" />
            )}
            {item.current || !item.href ? (
              <span
                className={cn(
                  "flex max-w-[200px] items-center gap-1 truncate font-medium sm:max-w-[300px]",
                  item.current ? "text-stone-900" : "text-stone-600",
                )}
                aria-current={item.current ? "page" : undefined}
                title={item.label}
              >
                {item.icon && <span className="text-xs">{item.icon}</span>}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="flex max-w-[200px] items-center gap-1 truncate text-stone-600 transition-colors hover:text-stone-900 sm:max-w-[300px]"
                title={item.label}
              >
                {item.icon && <span className="text-xs">{item.icon}</span>}
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
