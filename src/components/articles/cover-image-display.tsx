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
import type { ImageSummary } from "@/lib/services/image-selection";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [selectedImage, setSelectedImage] = useState<ImageSummary | null>(null);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [dialogSelection, setDialogSelection] = useState<ImageSummary | null>(
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
    setSelectedImage(null);
  };

  const applyImageSelection = (image: ImageSummary) => {
    setSelectedImage(image);
    setTempImageUrl(image.url);
    setTempImageAlt(image.alt);
  };

  const closeSearchDialog = (open: boolean) => {
    setIsSearchDialogOpen(open);
    if (!open) {
      setDialogSelection(selectedImage);
    }
  };

  const handleDialogSelect = () => {
    if (!dialogSelection) return;
    applyImageSelection(dialogSelection);
    setIsSearchDialogOpen(false);
  };

  const openUrlMode = () => {
    setImageInputMode("url");
  };

  const openSearchMode = () => {
    setImageInputMode("search");
    setDialogSelection(selectedImage);
    setIsSearchDialogOpen(true);
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
              onClick={openUrlMode}
            >
              <Link className="mr-1 h-4 w-4" />
              URL
            </Button>
            <Button
              type="button"
              variant={imageInputMode === "search" ? "default" : "outline"}
              size="sm"
              onClick={openSearchMode}
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
              <Dialog
                open={isSearchDialogOpen}
                onOpenChange={closeSearchDialog}
              >
                <DialogContent className="flex max-h-[90vh] w-xl flex-col gap-4 overflow-hidden">
                  <div className="shrink-0">
                    <DialogHeader>
                      <DialogTitle>Select a cover image</DialogTitle>
                    </DialogHeader>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <ImagePicker
                      onImageSelect={setDialogSelection}
                      selectedImageUrl={dialogSelection?.url}
                    />
                  </div>
                  <DialogFooter className="justify-end border-t pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSearchDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleDialogSelect}
                      disabled={!dialogSelection}
                    >
                      Select
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

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
              {selectedImage ? (
                <TooltipContent className="max-w-sm">
                  <div className="text-muted-foreground space-y-2 text-xs">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Alt text
                      </p>
                      <p>{selectedImage.alt}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Photographer
                      </p>
                      <p>{selectedImage.author.name}</p>
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
