"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waitlist } from "@clerk/nextjs";
import { X, ArrowRight, Check } from "lucide-react";
import Image from "next/image";

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <main className="relative min-h-screen bg-[#F6F4ED] text-gray-900">
      {/* Navigation - Kept minimal, added mobile CTA for better UX */}
      <nav className="relative z-20 w-full">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-6">
          <div className="flex items-center">
            <Image
              src="/logo-text.svg"
              alt="TopicOwl Logo"
              width={140}
              height={45}
              className="h-8 w-auto"
            />
          </div>
          <div className="flex items-center gap-6">
            <Button onClick={openModal} variant="default" size="sm">
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-6 pt-4 pb-12 sm:py-20">
        {/* Main Content - Takes more space */}
        <div className="relative z-10 mx-auto max-w-4xl text-center lg:text-left">
          {/* Main Headline */}
          <h1 className="mb-6 text-4xl leading-tight font-bold tracking-tight md:text-7xl lg:text-7xl">
            Quality content marketing on{" "}
            <span className="relative">
              <span className="relative z-10">autopilot</span>
              <span className="absolute inset-x-0 bottom-0 h-2 bg-yellow-400 opacity-60 md:bottom-2 md:h-4"></span>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed font-light text-gray-600 md:text-xl lg:mx-0">
            AI that researches, writes, and fact-checks your content. <br />{" "}
            Optimized for{" "}
            <span className="font-semibold">SEO & AI ranking</span>.
          </p>

          {/* Value Proposition List - Refined for clarity and flow */}
          <div className="mx-auto mt-8 max-w-2xl space-y-4 text-left sm:grid sm:grid-cols-2 sm:space-y-0 sm:gap-x-8 sm:gap-y-4 lg:mx-0">
            <div className="flex items-start gap-3">
              <Check className="mt-1 h-5 w-5 flex-shrink-0 text-black" />
              <p className="font-medium">Human quality content</p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="mt-1 h-5 w-5 flex-shrink-0 text-black" />
              <p className="font-medium">14× cheaper than agencies</p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="mt-1 h-5 w-5 flex-shrink-0 text-black" />
              <p className="font-medium">Schedule to blog, reddit</p>
            </div>
            <div className="flex items-start gap-3">
              <Check className="mt-1 h-5 w-5 flex-shrink-0 text-black" />
              <div className="flex items-center gap-2">
                <p className="font-medium">X/Threads/Bsky</p>
                <Badge variant="outline" className="text-xs">
                  Coming soon
                </Badge>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
            <Button
              onClick={openModal}
              variant="default"
              size="lg"
              className="group"
            >
              Get early access
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>

        {/* Absolutely Positioned Illustration - Larger and closer to right edge */}
        <div className="absolute right-0 bottom-0 hidden h-[300px] w-[400px] lg:top-1/2 lg:-mr-20 lg:block lg:h-[500px] lg:w-[600px] lg:-translate-y-1/2">
          <Image
            src="/landingpage-ilu.svg"
            alt="Illustration of automated content creation solving manual hassle"
            width={600}
            height={500}
            className="h-full w-full object-contain opacity-80 lg:opacity-100"
            priority
          />
        </div>
      </div>

      {/* Modal - Kept as-is, but added ARIA labels for accessibility */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
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
                  aria-label="Close modal"
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
