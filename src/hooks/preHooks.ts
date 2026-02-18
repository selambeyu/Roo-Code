import type { HookContext } from "./types"
import { IntentGovernanceError } from "./types"
import { getActiveIntent } from "./activeIntentState"

/** Tool names that modify files and require an active intent (intent handshake). */
const WRITE_TOOL_NAMES = new Set([
	"write_to_file",
	"apply_diff",
	"edit",
	"search_and_replace",
	"search_replace",
	"edit_file",
	"apply_patch",
	"generate_image",
])

const NO_INTENT_MESSAGE = `Orchestration: No active intent. You MUST call select_active_intent before making any code changes. Set an intent from .orchestration/active_intents.yaml.`

const SCOPE_VIOLATION_MESSAGE = `Scope violation: intent is not allowed to modify this file.`

/** Normalize path to posix and strip leading ./ for consistent prefix check. */
function normalizePathForScope(p: string): string {
	return p.replace(/\\/g, "/").replace(/^\.\//, "")
}

/** owned_scope is a path prefix (e.g. "src/auth/"). Empty scope allows all. */
function pathMatchesScope(relativePath: string, ownedScope: string): boolean {
	if (!ownedScope || !ownedScope.trim()) {
		return true
	}
	const norm = normalizePathForScope(relativePath)
	const scope = normalizePathForScope(ownedScope.trim())
	const scopeWithSlash = scope.endsWith("/") ? scope : scope + "/"
	return norm === scope || norm.startsWith(scopeWithSlash) || norm.startsWith(scope + "/")
}

/**
 * Extract the primary target file path from a write tool call (nativeArgs or params).
 * Returns undefined if not a write tool or path cannot be determined.
 */
function getWriteTargetPath(context: HookContext): string | undefined {
	const block = context.toolCall as {
		name: string
		nativeArgs?: Record<string, unknown>
		params?: Record<string, unknown>
	}
	const args = block.nativeArgs ?? block.params ?? {}
	const name = context.toolName as string

	if (name === "write_to_file" || name === "apply_diff" || name === "generate_image") {
		const p = args.path ?? args.file_path
		return typeof p === "string" ? p : undefined
	}
	if (name === "edit" || name === "search_and_replace" || name === "search_replace" || name === "edit_file") {
		const p = args.file_path ?? args.path
		return typeof p === "string" ? p : undefined
	}
	if (name === "apply_patch") {
		const patch = args.patch
		if (typeof patch !== "string") return undefined
		// Parse first path from unified patch (e.g. "*** Update File: path" or "*** Add File: path")
		const m = patch.match(/\*\*\*\s+(?:Update File|Add File):\s*(\S+)/)
		return m ? m[1] : undefined
	}
	return undefined
}

/**
 * Pre-hooks run before a tool is executed.
 * For write operations: enforces intent handshake (no write without active intent) and
 * scope guard (target path must match intent's owned_scope). Does not crash the extension.
 *
 * Fail-closed: no intent → no write; invalid scope → no write. Never allow silent execution.
 */
export async function runPreHooks(_toolCall: unknown, context: HookContext): Promise<void> {
	const toolName = context.toolName
	if (!WRITE_TOOL_NAMES.has(toolName as string)) {
		return
	}

	const taskId = context.taskId
	const active = taskId ? getActiveIntent(taskId) : null
	if (!active) {
		const structuredError = `<error blocked="intent_governance">${NO_INTENT_MESSAGE}</error>`
		context.pushToolResult?.(structuredError)
		throw new IntentGovernanceError(NO_INTENT_MESSAGE)
	}

	const ownedScope = active.scope ?? active.owned_scope ?? ""
	const targetPath = getWriteTargetPath(context)
	if (targetPath !== undefined && !pathMatchesScope(targetPath, ownedScope)) {
		const structuredError = `<error blocked="scope_violation">${SCOPE_VIOLATION_MESSAGE}</error>`
		context.pushToolResult?.(structuredError)
		throw new IntentGovernanceError(SCOPE_VIOLATION_MESSAGE)
	}
}
