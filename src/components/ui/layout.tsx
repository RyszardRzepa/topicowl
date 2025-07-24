import React from "react";
import { cn } from "@/lib/utils";

interface ContentContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  fullWidth?: boolean;
}

export function ContentContainer({ 
  className, 
  fullWidth = false, 
  children, 
  ...props 
}: ContentContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto px-4",
        fullWidth ? "max-w-1180" : "max-w-680",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface PageLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  fullWidth?: boolean;
}

export function PageLayout({ 
  className, 
  title, 
  description, 
  fullWidth = false, 
  children, 
  ...props 
}: PageLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-white", className)} {...props}>
      <ContentContainer fullWidth={fullWidth}>
        {title && (
          <header className="py-8 border-b border-stone-200 mb-8">
            <h1 className="text-2xl font-semibold text-stone-700 font-inter mb-2">
              {title}
            </h1>
            {description && (
              <p className="text-stone-500 font-inter">{description}</p>
            )}
          </header>
        )}
        <main>{children}</main>
      </ContentContainer>
    </div>
  );
}
