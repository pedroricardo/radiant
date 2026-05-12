"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "../../lib/utils"

const Switch = React.forwardRef<
	React.ElementRef<typeof SwitchPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
	<SwitchPrimitive.Root
		ref={ref}
		className={cn(
			"peer inline-flex h-8 w-14 items-center border-3 border-neo-black bg-surface-muted px-1 shadow-neo-badge outline-none data-[state=checked]:bg-signal-live",
			className
		)}
		{...props}
	>
		<SwitchPrimitive.Thumb className="block h-4 w-4 border-2 border-neo-black bg-white transition-transform data-[state=checked]:translate-x-4" />
	</SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
