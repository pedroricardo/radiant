import * as React from "react"

import { groteskFont } from "../../lib/fonts"
import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					`flex h-11 w-full border-3 border-neo-black bg-white px-3 py-2 text-sm text-neo-black shadow-neo-badge outline-none placeholder:text-black/45 disabled:cursor-not-allowed disabled:opacity-50 ${groteskFont.className}`,
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)
Input.displayName = "Input"

export { Input }
