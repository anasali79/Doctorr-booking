import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-slate-200/80 bg-white text-slate-950 shadow-xs transition-all",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5 sm:p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-bold leading-none tracking-tight text-slate-900",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs sm:text-sm text-slate-500", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 sm:p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 sm:p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: React.ReactNode
  description?: React.ReactNode
  variant?: "default" | "warning" | "info" | "success" | "purple"
  icon?: React.ReactNode
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, title, value, description, variant = "default", icon, ...props }, ref) => {
    const variantStyles = {
      default: "border-slate-200 bg-white text-slate-900",
      warning: "border-amber-200 bg-amber-50/50 text-amber-900",
      info: "border-sky-200 bg-sky-50/50 text-sky-900",
      success: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
      purple: "border-purple-200 bg-purple-50/50 text-purple-900",
    }

    const titleColors = {
      default: "text-slate-500",
      warning: "text-amber-700",
      info: "text-sky-700",
      success: "text-emerald-700",
      purple: "text-purple-700",
    }

    const descColors = {
      default: "text-slate-400",
      warning: "text-amber-600",
      info: "text-sky-600",
      success: "text-emerald-600",
      purple: "text-purple-600",
    }

    return (
      <Card
        ref={ref}
        className={cn("p-4 transition-all hover:shadow-sm", variantStyles[variant], className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <span className={cn("text-[11px] font-bold uppercase tracking-wider block", titleColors[variant])}>
            {title}
          </span>
          {icon && <div className="text-slate-400 shrink-0">{icon}</div>}
        </div>
        <div className="text-2xl font-black tabular-nums mt-1">{value}</div>
        {description && (
          <span className={cn("text-[11px] block mt-0.5", descColors[variant])}>
            {description}
          </span>
        )}
      </Card>
    )
  }
)
StatCard.displayName = "StatCard"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, StatCard }
