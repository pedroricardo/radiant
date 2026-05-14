"use client"

import * as React from "react"

import { cn } from "../../lib/utils"

type VerticalSliderProps = {
	value: number
	onChange: (value: number) => void
	label: string
	className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">

const VerticalSlider = React.forwardRef<HTMLInputElement, VerticalSliderProps>(
	({ value, onChange, label, className, ...props }, ref) => {
		return (
			<div
				className={cn(
					"relative h-[132px] w-[22px] overflow-hidden border-3 border-neo-black bg-neo-paper shadow-neo-badge",
					className,
				)}
			>
				<div className="absolute inset-0 bg-neo-paper" />
				<div
					className="absolute right-0 bottom-0 left-0 bg-neo-mint"
					style={{ height: `${value}%` }}
				/>
				<input
					ref={ref}
					aria-label={label}
					type="range"
					min="0"
					max="100"
					value={value}
					onChange={(event) => onChange(Number(event.target.value))}
					className="preview-slider preview-slider--vertical"
					{...props}
				/>
			</div>
		)
	},
)

VerticalSlider.displayName = "VerticalSlider"

export { VerticalSlider }
