import type { ToolName } from "@roo-code/types"
import type { ToolUse } from "../shared/tools"

/**
 * Context passed to pre/post hooks.
 * Kept minimal to avoid circular dependencies; extended at call site.
 */
export interface HookContext {
	/** Tool name (e.g. "write_to_file", "edit_file") */
	toolName: ToolName | string
	/** Raw tool use block from the assistant message */
	toolCall: ToolUse
	/** Task cwd for path resolution */
	cwd: string
	/** Task ID for session-scoped state (e.g. active intent) */
	taskId?: string
	/** Callback to push a tool result (used when blocking with structured error) */
	pushToolResult?: (content: string) => void
}

/**
 * Thrown by pre-hooks to block execution without crashing the extension.
 * Caller should push the message and treat as a completed (blocked) tool run.
 */
export class IntentGovernanceError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "IntentGovernanceError"
	}
}

/**
 * Result of a tool execution from the perspective of hooks.
 * Used by post-hooks (e.g. for trace logging).
 */
export interface ToolExecutionResult {
	/** Whether the tool completed without throwing */
	success: boolean
	/** Optional error if success is false */
	error?: Error
}
