"use client";
import { ArticlesCalendar } from "@/components/articles/ArticlesCalendar";

export default function ArticlesPage() {
  return (
    <div className="container mx-auto">
      <div className="h-[85vh]">
        <ArticlesCalendar />
      </div>
    </div>
  );
}
