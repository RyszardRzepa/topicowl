"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

export function HeaderLogo() {
  const { isSignedIn } = useAuth();
  
  return (
    <Link 
      href={isSignedIn ? "/dashboard" : "/"} 
      className="text-xl font-semibold text-stone-900 hover:text-stone-700 transition-colors"
    >
      AI SEO Content Machine
    </Link>
  );
}