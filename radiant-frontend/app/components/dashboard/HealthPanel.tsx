import { MetricRow } from "./MetricRow"
import { Panel } from "./Panel"

export function HealthPanel() {
	return (
		<Panel title="Stream Health" kicker="Runtime" className="lg:col-span-5">
			<div className="grid gap-3">
				<MetricRow label="Listener cache" value="30s" />
				<MetricRow label="Back pressure" value="Stable" />
				<MetricRow label="Stream sync" value="Locked" emphasis="inverse" />
				<MetricRow label="Encoder" value="ICY MP3" />
			</div>
		</Panel>
	)
}
