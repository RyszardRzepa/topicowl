"use client";

import { FileText, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function ArticleEmptyState() {
  const router = useRouter();

  const handleCreateArticle = () => {
    router.push("/dashboard/articles?tab=planning");
  };

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-blue-50 p-3 mb-4">
          <FileText className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No articles yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Get started by creating your first article. Our AI will help you generate high-quality content for your audience.
        </p>
        <Button onClick={handleCreateArticle} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create your first article
        </Button>
      </CardContent>
    </Card>
  );
}