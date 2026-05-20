import type { Radio } from "@radiant/client"
import { Metric } from "effect"

export const radioStartsTotal = Metric.counter("radio_starts_total", {
	description: "Number of radio runtime bootstraps",
	incremental: true,
})

export const radioStreamClonesTotal = Metric.counter("radio_stream_clones_total", {
	description: "Number of listener stream clones created",
	incremental: true,
})

export const radioListenerConnectionsTotal = Metric.counter("radio_listener_connections_total", {
	description: "Total number of listener HTTP connections",
	incremental: true,
})

export const radioListenerConnectionsActive = Metric.gauge("radio_listener_connections_active", {
	description: "Current number of active listener HTTP connections",
})

export const radioPlayoutSyncsTotal = Metric.counter("radio_playout_syncs_total", {
	description: "Number of playout syncs applied to radios",
	incremental: true,
})

export const radioMultiplexerSetClusterTotal = Metric.counter(
	"radio_multiplexer_set_cluster_total",
	{
		description: "Number of cluster changes applied to radio multiplexers",
		incremental: true,
	},
)

export const radioMetric = <Type, In, Out>(
	metric: Metric.Metric<Type, In, Out>,
	radioId: Radio.RadioId,
): Metric.Metric<Type, In, Out> => Metric.tagged(metric, "radioId", radioId)
