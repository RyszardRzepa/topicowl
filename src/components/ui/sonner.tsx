"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-stone-950 group-[.toaster]:border-stone-200 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-stone-500",
          actionButton:
            "group-[.toast]:bg-stone-900 group-[.toast]:text-stone-50",
          cancelButton:
            "group-[.toast]:bg-stone-100 group-[.toast]:text-stone-500",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
