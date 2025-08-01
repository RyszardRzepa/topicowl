"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Waitlist } from "@clerk/nextjs";
import { X } from "lucide-react";

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 h-2 w-2 rounded-full bg-white opacity-20"></div>
        <div className="absolute top-40 right-20 h-1 w-1 rounded-full bg-white opacity-30"></div>
        <div className="absolute bottom-40 left-20 h-1.5 w-1.5 rounded-full bg-white opacity-25"></div>
        <div className="absolute right-10 bottom-20 h-2 w-2 rounded-full bg-white opacity-20"></div>
        <div className="absolute top-60 left-1/4 h-1 w-1 rounded-full bg-white opacity-40"></div>
        <div className="absolute top-80 right-1/3 h-1.5 w-1.5 rounded-full bg-white opacity-30"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 text-sm text-gray-300">
            <span className="text-orange-400">🧠 </span>
            Powered by Google Search & Top AI Models
          </div>

          {/* Main Headline */}
          <h1 className="mb-6 text-3xl leading-tight font-bold md:text-6xl">
            Contentbot <br />
            Plan → Generate → Schedule Publishing
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-12 max-w-2xl text-lg leading-relaxed text-gray-400">
            Contentbot streamlines your entire content workflow. Plan your
            content strategy, generate high-quality posts, let you schedule them
            perfectly, and publish automatically to your blog, Reddit, and X.
          </p>

          {/* Join Waitlist Button */}
          <div className="mx-auto max-w-md">
            <Button
              onClick={openModal}
              className="bg-white px-8 py-4 text-lg font-semibold text-black hover:bg-gray-100"
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
              className="text-gray-600"
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
            <div className="overflow-hidden rounded-lg bg-white shadow-xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Join Contentbot Waitlist
                </h2>
                <button
                  onClick={closeModal}
                  className="rounded-full p-1 transition-colors hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
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
