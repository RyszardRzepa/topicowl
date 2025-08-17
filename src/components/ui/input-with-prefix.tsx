import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputWithPrefixProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
}

const InputWithPrefix = React.forwardRef<
  HTMLInputElement,
  InputWithPrefixProps
>(({ className, prefix = "https://", ...props }, ref) => {
  return (
    <div className="border-border bg-input ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full items-center rounded-md border py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50">
      <div className="text-muted-foreground border-input bg-muted shrink-0 rounded-l-md border-r px-3 py-2 text-sm select-none">
        {prefix}
      </div>
      <input
        className={cn(
          "placeholder:text-muted-foreground block min-w-0 flex-1 bg-transparent py-2 pr-3 pl-3 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    </div>
  );
});
InputWithPrefix.displayName = "InputWithPrefix";

export { InputWithPrefix };
