import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "outline"
  size?: "default" | "sm" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => {
    const baseClasses = "inline-flex items-center justify-center font-inter text-15 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-notion"
    
    const variantClasses = {
      primary: "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50",
      ghost: "bg-transparent text-stone-700 hover:bg-stone-100",
      danger: "bg-transparent text-red-600 border border-red-200 hover:bg-red-50",
      outline: "bg-transparent border border-stone-200 text-stone-700 hover:bg-stone-50",
    }
    
    const sizeClasses = {
      default: "h-10 px-4",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6 text-base",
    }
    
    return (
      <button
        className={cn(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"

export { Button }