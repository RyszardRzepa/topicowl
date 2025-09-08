"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { X, ImageIcon, Edit3, Link, Search } from "lucide-react";
import Image from "next/image";
import { ImagePicker } from "./image-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CombinedImage } from "@/lib/services/image-selection-service";

interface CoverImageDisplayProps {
  coverImageUrl?: string;
  coverImageAlt?: string;
  onImageUpdate: (imageData: {
    coverImageUrl: string;
    coverImageAlt: string;
  }) => void;
  isLoading?: boolean;
  articleStatus?: string;
}

export function CoverImageDisplay({
  coverImageUrl = "",
  coverImageAlt = "",
  onImageUpdate,
  isLoading = false,
  articleStatus,
}: CoverImageDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState(coverImageUrl);
  const [tempImageAlt, setTempImageAlt] = useState(coverImageAlt);
  const [imageInputMode, setImageInputMode] = useState<"url" | "search">("url");
  const [selectedImage, setSelectedImage] = useState<CombinedImage | null>(
    null,
  );

  const handleSave = () => {
    onImageUpdate({
      coverImageUrl: tempImageUrl,
      coverImageAlt: tempImageAlt,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempImageUrl(coverImageUrl);
    setTempImageAlt(coverImageAlt);
    setIsEditing(false);
    setImageInputMode("url");
    setSelectedImage(null);
  };

  const handleRemove = () => {
    onImageUpdate({
      coverImageUrl: "",
      coverImageAlt: "",
    });
    setTempImageUrl("");
    setTempImageAlt("");
    setIsEditing(false);
  };

  const handleImageSelect = (image: CombinedImage) => {
    setSelectedImage(image);
    setTempImageUrl(image.urls.regular);
    setTempImageAlt(
      image.altDescription ??
        image.description ??
        `Photo by ${image.user.name}`,
    );
  };

  if (!coverImageUrl && !isEditing) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="rounded-full bg-gray-100 p-6">
              <ImageIcon className="h-12 w-12 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                No cover image
              </h3>
              <p className="text-sm text-gray-500">
                Add a cover image to make your article more engaging
              </p>
            </div>
            {articleStatus !== "published" && (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="mt-4"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Add Cover Image
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          {/* Mode Toggle */}
          <div className="mb-4 flex justify-center gap-2">
            <Button
              type="button"
              variant={imageInputMode === "url" ? "default" : "outline"}
              size="sm"
              onClick={() => setImageInputMode("url")}
            >
              <Link className="mr-1 h-4 w-4" />
              URL
            </Button>
            <Button
              type="button"
              variant={imageInputMode === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => setImageInputMode("search")}
            >
              <Search className="mr-1 h-4 w-4" />
              Search
            </Button>
          </div>

          {imageInputMode === "url" ? (
            <>
              <div>
                <label
                  htmlFor="coverImageUrl"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Image URL
                </label>
                <Input
                  id="coverImageUrl"
                  type="url"
                  value={tempImageUrl}
                  onChange={(e) => setTempImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div>
                <label
                  htmlFor="coverImageAlt"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Alt Text
                </label>
                <Input
                  id="coverImageAlt"
                  value={tempImageAlt}
                  onChange={(e) => setTempImageAlt(e.target.value)}
                  placeholder="Describe the image for accessibility"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-700">
                Search Images
              </label>
              <ImagePicker
                onImageSelect={handleImageSelect}
                selectedImageId={selectedImage?.id}
              />

              {/* Show alt text input for selected image */}
              {selectedImage && (
                <div className="mt-4">
                  <label
                    htmlFor="coverImageAlt"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Alt Text
                  </label>
                  <Input
                    id="coverImageAlt"
                    value={tempImageAlt}
                    onChange={(e) => setTempImageAlt(e.target.value)}
                    placeholder="Describe the image for accessibility"
                  />
                </div>
              )}
            </div>
          )}

          {tempImageUrl && (
            <div className="overflow-hidden rounded-lg border">
              <Image
                src={tempImageUrl}
                alt={tempImageAlt || "Cover image preview"}
                width={800}
                height={400}
                className="h-64 w-full object-cover"
                unoptimized
              />
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card>
        <CardContent className="p-0">
          <div className="group relative overflow-hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <Image
                  src={coverImageUrl}
                  alt={coverImageAlt || "Cover image"}
                  width={800}
                  height={400}
                  className="h-64 w-full cursor-pointer object-cover lg:h-80"
                  unoptimized
                />
              </TooltipTrigger>
              {selectedImage &&
              (selectedImage.description ?? selectedImage.altDescription) ? (
                <TooltipContent className="max-w-sm">
                  <div className="space-y-2">
                    {selectedImage.description && (
                      <div>
                        <p className="text-sm font-medium">Description:</p>
                        <p className="text-muted-foreground text-xs">
                          {selectedImage.description}
                        </p>
                      </div>
                    )}
                    {selectedImage.altDescription &&
                      selectedImage.altDescription !==
                        selectedImage.description && (
                        <div>
                          <p className="text-sm font-medium">Alt text:</p>
                          <p className="text-muted-foreground text-xs">
                            {selectedImage.altDescription}
                          </p>
                        </div>
                      )}
                    <div>
                      <p className="text-sm font-medium">Source:</p>
                      <p className="text-muted-foreground text-xs">
                        Photo by {selectedImage.user.name} on{" "}
                        {selectedImage.source === "unsplash"
                          ? "Unsplash"
                          : "Pexels"}
                      </p>
                    </div>
                  </div>
                </TooltipContent>
              ) : (
                coverImageAlt && (
                  <TooltipContent className="max-w-sm">
                    <div>
                      <p className="text-sm font-medium">Alt text:</p>
                      <p className="text-muted-foreground text-xs">
                        {coverImageAlt}
                      </p>
                    </div>
                  </TooltipContent>
                )
              )}
            </Tooltip>

            {/* Hover overlay */}
            {articleStatus !== "published" && (
              <div className="bg-opacity-50 absolute inset-0 flex items-center justify-center space-x-3 bg-black opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="bg-white/90 text-gray-900 hover:bg-white"
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  className="bg-red-600/90 hover:bg-red-600"
                >
                  <X className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
