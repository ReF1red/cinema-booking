import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-[#E50914] text-white hover:bg-[#b80710] shadow-[0_0_15px_rgba(229,9,20,0.3)] hover:shadow-[0_0_20px_rgba(229,9,20,0.5)]",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-[#F5F5F7]/20 bg-transparent hover:bg-[#F5F5F7]/10 text-[#F5F5F7]",
        secondary: "bg-[#1A1A1F] text-[#F5F5F7] hover:bg-[#232329] border border-[#F5F5F7]/10",
        ghost: "hover:bg-[#1A1A1F] hover:text-[#F5F5F7]",
        link: "text-[#FFC857] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-md px-4",
        lg: "h-14 rounded-xl px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
