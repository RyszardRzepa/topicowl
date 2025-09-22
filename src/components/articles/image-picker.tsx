"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Check } from "lucide-react";
import Image from "next/image";
import type {
  ImageSearchResponse,
  ImageSummary,
} from "@/lib/services/image-selection";
import { ScrollArea } from "../ui/scroll-area";

interface ImagePickerProps {
  onImageSelect: (image: ImageSummary) => void;
  selectedImageUrl?: string;
}

export function ImagePicker({
  onImageSelect,
  selectedImageUrl,
}: ImagePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [images, setImages] = useState<ImageSummary[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | undefined>(selectedImageUrl);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    setSelectedUrl(selectedImageUrl);
  }, [selectedImageUrl]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      setErrorMessage(null);
      const response = await fetch("/api/articles/images/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          orientation: "landscape",
          limit: 100,
          aiSelect: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to search images");
      }

      const data = (await response.json()) as ImageSearchResponse;
      if (data.success && data.images?.length) {
        setImages(data.images);
        if (data.selected) {
          setSelectedUrl(data.selected.url);
          onImageSelect(data.selected);
        } else {
          setSelectedUrl(undefined);
        }
      } else {
        setImages([]);
        setSelectedUrl(undefined);
        setErrorMessage(data.error ?? "No image found");
      }
      setHasSearched(true);
    } catch (error) {
      console.error("Error searching images:", error);
      setErrorMessage("Unable to fetch image. Try a different search term.");
      setImages([]);
      setSelectedUrl(undefined);
      setHasSearched(true);
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

  const highlightUrl = selectedUrl ?? selectedImageUrl;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search for an image (e.g., 'technology skyline')"
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

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      {images.length > 0 ? (
        <ScrollArea className="h-[400px] w-full">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {images.map((image) => {
              const isSelected = highlightUrl === image.url;
              return (
                <button
                  key={image.id}
                  type="button"
                  className={`group relative overflow-hidden rounded-lg border-2 transition-all focus:outline-none ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-blue-400"
                  }`}
                  onClick={() => {
                    setSelectedUrl(image.url);
                    onImageSelect(image);
                  }}
                >
                  <div className="relative aspect-square w-full overflow-hidden">
                    <Image
                      src={image.previewUrl}
                      alt={image.alt}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition-transform group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                  <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                    <p className="text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {image.author.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      ) : hasSearched && !isSearching && !errorMessage ? (
        <div className="flex-1 rounded border border-dashed border-muted-foreground/30 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          No images found. Try a different search term.
        </div>
      ) : null}
    </div>
  );
}
