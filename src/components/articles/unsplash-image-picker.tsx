"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Check } from "lucide-react";
import Image from "next/image";
import type { ImageSearchResponse, UnsplashImage } from "@/app/api/articles/images/search/route";

interface UnsplashImagePickerProps {
  onImageSelect: (image: UnsplashImage) => void;
  selectedImageId?: string;
}

export function UnsplashImagePicker({ 
  onImageSelect, 
  selectedImageId 
}: UnsplashImagePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch("/api/articles/images/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          count: 18,
          orientation: "landscape",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to search images");
      }

      const data = await response.json() as ImageSearchResponse;
      if (data.success) {
        setImages(data.data.images);
        setSearchPerformed(true);
      }
    } catch (error) {
      console.error("Error searching images:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      e.preventDefault();
      void handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search for images (e.g., 'technology', 'business meeting', 'nature')"
            className="pl-10"
            disabled={isSearching}
          />
        </div>
        <Button 
          onClick={handleSearch} 
          disabled={isSearching || !searchQuery.trim()}
          size="default"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Search Results */}
      {searchPerformed && (
        <div>
          {images.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              No images found. Try a different search term.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-600">
                Found {images.length} images. Click to select:
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 transition-all hover:border-blue-400 ${
                      selectedImageId === image.id
                        ? "border-blue-500 ring-2 ring-blue-200"
                        : "border-gray-200"
                    }`}
                    onClick={() => onImageSelect(image)}
                  >
                    <div className="aspect-video">
                      <Image
                        src={image.urls.small}
                        alt={image.altDescription ?? image.description ?? "Unsplash image"}
                        width={400}
                        height={300}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        unoptimized
                      />
                    </div>
                    
                    {/* Selection indicator */}
                    {selectedImageId === image.id && (
                      <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                        <Check className="h-4 w-4" />
                      </div>
                    )}

                    {/* Image info overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                        by {image.user.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Attribution notice */}
      {images.length > 0 && (
        <p className="text-xs text-gray-500">
          Images provided by{" "}
          <a
            href="https://unsplash.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-700"
          >
            Unsplash
          </a>
        </p>
      )}
    </div>
  );
}
