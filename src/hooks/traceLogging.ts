import * as vscode from "vscode"
import { createHash } from "node:crypto"
import type { HookContext } from "./types"
import { getActiveIntent } from "./activeIntentState"

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

function getWritePathAndContent(context: HookContext): { file_path: string; content: string } | null {
	const name = context.toolName as string
	if (!WRITE_TOOL_NAMES.has(name)) return null
	const block = context.toolCall as { nativeArgs?: Record<string, unknown>; params?: Record<string, unknown> }
	const args = block.nativeArgs ?? block.params ?? {}

	let file_path: string | undefined
	let content: string
	if (name === "write_to_file") {
		file_path = args.path as string
		content = (args.content as string) ?? ""
	} else if (name === "apply_diff") {
		file_path = args.path as string
		content = (args.diff as string) ?? ""
	} else if (name === "generate_image") {
		file_path = (args.path as string) ?? ""
		content = ""
	} else if (name === "edit" || name === "search_and_replace" || name === "search_replace" || name === "edit_file") {
		file_path = (args.file_path ?? args.path) as string
		content = (args.new_string as string) ?? ""
	} else if (name === "apply_patch") {
		const patch = args.patch as string
		const m = typeof patch === "string" ? patch.match(/\*\*\*\s+(?:Update File|Add File):\s*(\S+)/) : null
		file_path = m ? m[1] : ""
		content = typeof patch === "string" ? patch : ""
	} else {
		return null
	}
	if (!file_path) return null
	return { file_path, content: content ?? "" }
}

function sha256Hex(text: string): string {
	return createHash("sha256").update(text, "utf8").digest("hex")
}

/**
 * Append a trace entry to .orchestration/agent_trace.jsonl for write operations.
 * Structure: { id, timestamp, intent_id, file_path, content_hash }
 */
export async function appendTraceLog(context: HookContext, toolCallId: string | undefined): Promise<void> {
	const name = context.toolName as string
	if (!WRITE_TOOL_NAMES.has(name)) return

	const pathAndContent = getWritePathAndContent(context)
	if (!pathAndContent) return

	const taskId = context.taskId
	const active = taskId ? getActiveIntent(taskId) : null
	const intent_id = active?.id ?? ""

	const id = toolCallId ?? `trace-${Date.now()}`
	const timestamp = new Date().toISOString()
	const content_hash = sha256Hex(pathAndContent.content)

	const line =
		JSON.stringify({
			id,
			timestamp,
			intent_id,
			file_path: pathAndContent.file_path,
			content_hash,
		}) + "\n"

	const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(context.cwd))
	if (!folder) return

	const uri = vscode.Uri.joinPath(folder.uri, ".orchestration", "agent_trace.jsonl")
	try {
		let existing = ""
		try {
			const buf = await vscode.workspace.fs.readFile(uri)
			existing = new TextDecoder().decode(buf)
		} catch {
			// File may not exist yet
		}
		const encoder = new TextEncoder()
		await vscode.workspace.fs.writeFile(uri, encoder.encode(existing + line))
	} catch {
		// Best-effort: do not fail the tool run
	}
}
