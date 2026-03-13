import { type HTMLAttributes } from "react";

type Variant = "default" | "secondary" | "destructive" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-amber/10 text-amber border-amber/20",
  secondary: "bg-secondary text-secondary-foreground border-secondary",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  outline: "border-border text-foreground",
};

export function Badge({
  className = "",
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider uppercase ${variantStyles[variant]} ${className}`}
      {...props}
    />
  );
}
