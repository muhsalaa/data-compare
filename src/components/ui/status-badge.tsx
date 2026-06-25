import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        active: "bg-[color-mix(in_oklch,var(--color-success),transparent_85%)] text-success",
        paused:
          "bg-[color-mix(in_oklch,var(--color-warning),transparent_85%)] text-warning",
        stopped: "bg-muted text-muted-foreground",
        enabled:
          "bg-[color-mix(in_oklch,var(--color-success),transparent_85%)] text-success",
        disabled: "bg-muted text-muted-foreground",
        healthy:
          "bg-[color-mix(in_oklch,var(--color-success),transparent_85%)] text-success",
        warning:
          "bg-[color-mix(in_oklch,var(--color-warning),transparent_85%)] text-warning",
        critical:
          "bg-[color-mix(in_oklch,var(--color-destructive),transparent_85%)] text-destructive",
        info: "bg-[color-mix(in_oklch,var(--color-info),transparent_85%)] text-info",
      },
    },
    defaultVariants: {
      status: "stopped",
    },
  },
)

export type StatusValue =
  | "active"
  | "paused"
  | "stopped"
  | "enabled"
  | "disabled"
  | "healthy"
  | "warning"
  | "critical"
  | "info"

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: StatusValue
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    >
      {status}
    </span>
  )
}
