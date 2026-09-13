import type { ComponentProps } from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

export type IconButtonProps = ComponentProps<typeof Button> & {
  label: string
}

function IconButton({
  label,
  className,
  size = "icon",
  variant = "outline",
  ...props
}: IconButtonProps) {
  return (
    <Button
      size={size}
      variant={variant}
      aria-label={label}
      className={cn("rounded-md", className)}
      {...props}
    />
  )
}

export { IconButton }
