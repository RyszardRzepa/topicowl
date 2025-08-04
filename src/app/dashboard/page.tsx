"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/articles");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-gray-600">Redirecting...</div>
    </div>
  );
}