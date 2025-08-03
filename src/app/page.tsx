"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Waitlist } from "@clerk/nextjs";
import { X } from "lucide-react";

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <main className="bg-brand-green relative min-h-screen overflow-hidden text-white">
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        {/* Left side dots */}
        <div className="absolute top-20 left-10 h-2 w-2 rounded-full bg-brand-orange opacity-60"></div>
        <div className="absolute bottom-40 left-20 h-1.5 w-1.5 rounded-full bg-brand-orange opacity-50"></div>
        <div className="absolute top-96 left-16 h-1.5 w-1.5 rounded-full bg-brand-orange opacity-55"></div>
        <div className="absolute bottom-32 left-8 h-2 w-2 rounded-full bg-brand-orange opacity-40"></div>
        <div className="absolute top-44 left-8 h-1 w-1 rounded-full bg-brand-orange opacity-50"></div>
        <div className="absolute top-84 left-32 h-1 w-1 rounded-full bg-brand-orange opacity-25"></div>
        <div className="absolute top-60 left-24 h-1 w-1 rounded-full bg-brand-orange opacity-30"></div>
        <div className="absolute bottom-80 left-12 h-1.5 w-1.5 rounded-full bg-brand-orange opacity-45"></div>
        <div className="absolute top-32 left-28 h-1 w-1 rounded-full bg-brand-orange opacity-35"></div>
        <div className="absolute bottom-60 left-36 h-1 w-1 rounded-full bg-brand-orange opacity-40"></div>
        
        {/* Right side dots */}
        <div className="absolute top-40 right-20 h-1 w-1 rounded-full bg-brand-orange opacity-40"></div>
        <div className="absolute right-10 bottom-20 h-2 w-2 rounded-full bg-brand-orange opacity-60"></div>
        <div className="absolute top-80 right-32 h-1.5 w-1.5 rounded-full bg-brand-orange opacity-45"></div>
        <div className="absolute bottom-60 right-16 h-1 w-1 rounded-full bg-brand-orange opacity-40"></div>
        <div className="absolute top-72 right-20 h-1.5 w-1.5 rounded-full bg-brand-orange opacity-35"></div>
        <div className="absolute top-88 right-8 h-1 w-1 rounded-full bg-brand-orange opacity-55"></div>
        <div className="absolute bottom-16 right-24 h-1.5 w-1.5 rounded-full bg-brand-orange opacity-35"></div>
        <div className="absolute bottom-52 right-32 h-1.5 w-1.5 rounded-full bg-brand-orange opacity-40"></div>
        <div className="absolute top-16 right-28 h-1.5 w-1.5 rounded-full bg-brand-orange opacity-30"></div>
        <div className="absolute bottom-96 right-36 h-1 w-1 rounded-full bg-brand-orange opacity-45"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 flex justify-center">
              <span>🧠 </span>
              Powered by Google Search & Top AI Models
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            Contentbot <br />
            <span className="text-gray-200">Plan → Generate → Schedule Publishing</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-gray-300 md:text-xl">
            Contentbot streamlines your entire content workflow. Plan your
            content strategy, generate high-quality posts, let you schedule them
            perfectly, and publish automatically to your blog, Reddit, and X.
          </p>

          {/* Join Waitlist Button */}
          <div className="mx-auto max-w-md">
            <Button
              onClick={openModal}
              size="lg"
              className="bg-white px-8 py-6 text-lg font-semibold text-black hover:bg-gray-100 shadow-lg"
            >
              Join Waitlist!
            </Button>
          </div>

          {/* Decorative arrow */}
          <div className="mt-8 flex justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              className="text-brand-orange"
              fill="currentColor"
            >
              <path d="M20 5 L35 20 L25 20 L25 35 L15 35 L15 20 L5 20 Z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom decorative elements */}
      <div className="absolute right-0 bottom-0 left-0 h-32 bg-gradient-to-t from-gray-900/20 to-transparent"></div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Modal Content */}
          <div className="relative z-10 mx-4 w-full max-w-md">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Join Contentbot Waitlist
                </h2>
                <Button
                  onClick={closeModal}
                  variant="ghost"
                  size="icon"
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
