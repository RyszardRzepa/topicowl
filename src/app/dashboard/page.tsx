"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/articles");
  }, [router]);

  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="text-gray-600">Redirecting...</div>
    </div>
  );
}
