import type { HookContext } from "./types"
import type { ToolExecutionResult } from "./types"
import { appendTraceLog } from "./traceLogging"

/**
 * Post-hooks run after a tool has been executed.
 * For successful write operations, appends a trace line to .orchestration/agent_trace.jsonl.
 */
export async function runPostHooks(
	toolCall: unknown,
	result: ToolExecutionResult,
	context: HookContext,
): Promise<void> {
	if (!result.success) return

	const block = toolCall as { id?: string } | undefined
	const toolCallId = block?.id

	await appendTraceLog(context, toolCallId)
}
