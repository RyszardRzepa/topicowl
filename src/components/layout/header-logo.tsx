"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

export function HeaderLogo() {
  const { isSignedIn } = useAuth();

  return (
    <Link
      href={isSignedIn ? "/dashboard" : "/"}
      className="text-brand-white hover:text-brand-orange text-xl font-semibold transition-colors"
    >
      Contentbot
    </Link>
  );
}
