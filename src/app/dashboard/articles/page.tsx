"use client";
import { ArticlesBoard } from "@/components/articles/ArticleBoard";

export default function ArticlesPage() {
  return (
    <div className="container mx-auto">
      <div className="h-[85vh]">
        <ArticlesBoard />
      </div>
    </div>
  );
}
