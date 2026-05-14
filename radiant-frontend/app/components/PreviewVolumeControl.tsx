"use client"

import { useEffect, useState } from "react"
import { tomorrowFont } from "../lib/fonts"
import { Button } from "./ui/Button"
import { VerticalSlider } from "./ui/VerticalSlider"

type PreviewVolumeControlProps = {
	volume?: number
	defaultVolume?: number
	muted?: boolean
	defaultMuted?: boolean
	onVolumeChange?: (volume: number) => void
	onMutedChange?: (muted: boolean) => void
}

export function PreviewVolumeControl(props: PreviewVolumeControlProps) {
	const isControlledVolume = props.volume !== undefined
	const isControlledMuted = props.muted !== undefined
	const [uncontrolledVolume, setUncontrolledVolume] = useState(props.defaultVolume ?? 72)
	const [uncontrolledMuted, setUncontrolledMuted] = useState(props.defaultMuted ?? false)
	const [lastVolume, setLastVolume] = useState(props.defaultVolume ?? 72)

	const volume = isControlledVolume ? props.volume! : uncontrolledVolume
	const muted = isControlledMuted ? props.muted! : uncontrolledMuted

	useEffect(() => {
		if (!muted && volume > 0) {
			setLastVolume(volume)
		}
	}, [muted, volume])

	const setVolume = (nextVolume: number) => {
		if (!isControlledVolume) {
			setUncontrolledVolume(nextVolume)
		}

		if (nextVolume > 0 && !muted) {
			setLastVolume(nextVolume)
		}

		props.onVolumeChange?.(nextVolume)
	}

	const setMuted = (nextMuted: boolean) => {
		if (!isControlledMuted) {
			setUncontrolledMuted(nextMuted)
		}

		props.onMutedChange?.(nextMuted)
	}

	const toggleMute = () => {
		if (muted) {
			setMuted(false)
			setVolume(lastVolume === 0 ? 72 : lastVolume)
			return
		}

		setLastVolume(volume)
		setMuted(true)
		setVolume(0)
	}

	return (
		<div className="flex h-full flex-col items-center justify-start gap-3 self-start">
			<p
				className={`${tomorrowFont.className} text-xs font-extrabold uppercase text-neo-black  w-12 text-center`}
			>
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
