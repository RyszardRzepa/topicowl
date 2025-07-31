"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { X, ImageIcon, Edit3 } from "lucide-react";
import Image from "next/image";

interface CoverImageDisplayProps {
  coverImageUrl?: string;
  coverImageAlt?: string;
  onImageUpdate: (imageData: { coverImageUrl: string; coverImageAlt: string }) => void;
  isLoading?: boolean;
}

export function CoverImageDisplay({
  coverImageUrl = "",
  coverImageAlt = "",
  onImageUpdate,
  isLoading = false,
}: CoverImageDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState(coverImageUrl);
  const [tempImageAlt, setTempImageAlt] = useState(coverImageAlt);

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

  if (!coverImageUrl && !isEditing) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="rounded-full bg-gray-100 p-6">
              <ImageIcon className="h-12 w-12 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">No cover image</h3>
              <p className="text-sm text-gray-500">
                Add a cover image to make your article more engaging
              </p>
            </div>
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              className="mt-4"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Add Cover Image
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isEditing) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <label
              htmlFor="coverImageUrl"
              className="block text-sm font-medium text-gray-700 mb-2"
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
              className="block text-sm font-medium text-gray-700 mb-2"
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

          {tempImageUrl && (
            <div className="rounded-lg overflow-hidden border">
              <Image
                src={tempImageUrl}
                alt={tempImageAlt || "Cover image preview"}
                width={800}
                height={400}
                className="w-full h-64 object-cover"
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
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="group relative overflow-hidden">
          <Image
            src={coverImageUrl}
            alt={coverImageAlt || "Cover image"}
            width={800}
            height={400}
            className="w-full h-64 lg:h-80 object-cover"
            unoptimized
          />
          
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="bg-white/90 hover:bg-white text-gray-900"
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
        </div>
      </CardContent>
    </Card>
  );
}
