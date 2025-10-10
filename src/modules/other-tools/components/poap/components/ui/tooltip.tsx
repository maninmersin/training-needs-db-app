"use client"

import * as React from "react"
// import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "../../lib/utils"

function TooltipProvider({ children, ...props }: any) {
  return <div {...props}>{children}</div>
}

function Tooltip({ children, ...props }: any) {
  return <TooltipProvider>{children}</TooltipProvider>
}

function TooltipTrigger({ children, ...props }: any) {
  return <div {...props}>{children}</div>
}

function TooltipContent({ className, children, ...props }: any) {
  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground z-50 w-fit rounded-md px-3 py-1.5 text-xs",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
