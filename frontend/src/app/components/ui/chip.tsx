import * as React from "react"
import { cn } from "../../../lib/utils"

interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean
  variant?: "default" | "outline"
}

export function Chip({ className, active, variant = "default", ...props }: ChipProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer",
        variant === "default" && "bg-[#1A1A1F] text-[#9CA3AF] hover:text-[#F5F5F7] hover:bg-[#232329]",
        variant === "outline" && "border border-[#F5F5F7]/20 text-[#9CA3AF] hover:text-[#F5F5F7] hover:border-[#F5F5F7]/50",
        active && "bg-[#E50914] text-white border-transparent hover:bg-[#b80710] shadow-[0_0_10px_rgba(229,9,20,0.4)]",
        className
      )}
      {...props}
    />
  )
}
