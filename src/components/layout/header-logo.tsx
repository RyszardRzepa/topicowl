"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

export function HeaderLogo() {
  const { isSignedIn } = useAuth();
  
  return (
    <Link 
      href={isSignedIn ? "/dashboard" : "/"} 
      className="text-xl font-semibold text-brand-white hover:text-brand-orange transition-colors"
    >
      Contentbot
    </Link>
  );
}