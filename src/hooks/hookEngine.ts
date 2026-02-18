import type { HookContext, ToolExecutionResult } from "./types"
import { runPreHooks as runPreHooksImpl } from "./preHooks"
import { runPostHooks as runPostHooksImpl } from "./postHooks"

/**
 * Hook engine: runs pre- and post-execution hooks around tool execution.
 * Used by presentAssistantMessage to wrap tool.handle() without changing tool logic.
 */

export async function runPreHooks(toolCall: unknown, context: HookContext): Promise<void> {
	await runPreHooksImpl(toolCall, context)
}

export async function runPostHooks(
	toolCall: unknown,
	result: ToolExecutionResult,
	context: HookContext,
): Promise<void> {
	await runPostHooksImpl(toolCall, result, context)
}
