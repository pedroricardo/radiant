import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { groteskFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"

const badgeVariants = cva(
	`inline-flex items-center border-3 border-neo-black px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.2em] shadow-neo-badge select-none ${groteskFont.className}`,
	{
		variants: {
			variant: {
				default: "bg-neo-mint text-neo-black",
				paper: "bg-neo-paper text-neo-black",
				live: "bg-neo-red text-white",
				mint: "bg-neo-mint text-neo-black",
				orange: "bg-neo-orange text-neo-black",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
)

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {
	asChild?: boolean
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
	({ className, variant, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "div"
		return <Comp ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
	}
)

Badge.displayName = "Badge"

export { Badge, badgeVariants }
