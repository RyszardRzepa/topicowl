"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waitlist } from "@clerk/nextjs";
import { X, ArrowRight } from "lucide-react";
import Image from "next/image";

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <main className="relative min-h-screen bg-[#F6F4ED] text-gray-900">
      {/* Navigation */}

      <nav className="relative z-20 w-full">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-6">
          <div className="flex items-center">
            <Image
              src="/logo-text.svg"
              alt="Contentbot"
              width={140}
              height={45}
              className="h-8 w-auto"
            />
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <Button
              onClick={openModal}
              variant="default"
              size="sm"
              className="rounded-full"
            >
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative flex min-h-[80vh] flex-col items-center justify-center px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          {/* Main Headline */}
          <h1 className="mb-6 text-5xl leading-[0.9] font-bold tracking-tight md:text-7xl lg:text-8xl">
            Professional SEO articles
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed font-light text-gray-600 md:text-xl">
            Research-backed, on-brand SEO articles in &lt;24h — ideas, drafting
            & scheduling on autopilot.
          </p>

          {/* Value Proposition Bar */}
          <div className="mb-4 flex flex-wrap justify-center gap-6 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <span className="bg-brand-orange-500 h-1 w-1 rounded-full" />
              Up to 10× cheaper than content agencies
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-brand-orange-500 h-1 w-1 rounded-full" />
              Reddit scheduling
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-brand-orange-500 h-1 w-1 rounded-full" />X
              coming soon
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button onClick={openModal} variant="default" size="lg">
              Get early access
            </Button>
          </div>
        </div>
      </div>

      {/* Abstract decoration similar to Medium's geometric elements */}
      <div className="pointer-events-none absolute top-0 right-0 h-96 w-96 opacity-5">
        <svg viewBox="0 0 400 400" className="h-full w-full">
          <circle
            cx="200"
            cy="100"
            r="80"
            fill="currentColor"
            className="text-brand-orange-500"
          />
          <rect
            x="150"
            y="200"
            width="100"
            height="100"
            fill="currentColor"
            className="text-brand-green-500"
            transform="rotate(45 200 250)"
          />
          <polygon
            points="300,300 350,350 250,350"
            fill="currentColor"
            className="text-gray-400"
          />
        </svg>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="relative z-10 mx-4 w-full max-w-md">
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Get early access
                </h2>
                <Button
                  onClick={closeModal}
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </Button>
              </div>

              {/* Clerk Waitlist Component */}
              <div className="p-6">
                <Waitlist />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
