"use client"

import { useState } from "react"
import { tomorrowFont } from "../lib/fonts"
import { VerticalSlider } from "./ui/VerticalSlider"
import { Button } from "./ui/Button"

export function PreviewVolumeControl() {
	const [volume, setVolume] = useState(72)
	const [lastVolume, setLastVolume] = useState(72)
	const muted = volume === 0

	const toggleMute = () => {
		if (muted) {
			setVolume(lastVolume === 0 ? 72 : lastVolume)
			return
		}

		setLastVolume(volume)
		setVolume(0)
	}

	return (
		<div className="flex h-full flex-col items-center justify-start gap-3 self-start">
			<p className={`${tomorrowFont.className} text-xs font-extrabold uppercase text-neo-black  w-12 text-center`}>
				{volume}%
			</p>

			<VerticalSlider value={volume} onChange={setVolume} label="Preview volume" />

			<Button
				type="button"
				size="icon"
				variant="secondary"
				onClick={toggleMute}
				aria-label={muted ? "Unmute preview" : "Mute preview"}
			>
				<svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
					{muted ? (
						<path d="M16.5 12a3.5 3.5 0 0 1-2 3.16v-1.9L12.24 11H16.5v1Zm3.2 6.3-1.4 1.4-4.53-4.53L12 14.4l-5 4V14H3v-4h4L12 5.6v4.57l7.7 8.13Z" />
					) : (
						<path d="M3 10v4h4l5 4V6L7 10H3Zm13.5 2a3.5 3.5 0 0 0-2-3.16v6.32A3.5 3.5 0 0 0 16.5 12Z" />
					)}
				</svg>
			</Button>
		</div>
	)
}
