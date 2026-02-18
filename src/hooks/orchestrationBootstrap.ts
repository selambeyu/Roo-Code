import * as vscode from "vscode"

const ORCHESTRATION_DIR = ".orchestration"
const FILES: Record<string, string> = {
	active_intents: `# Active intents for intent-governed orchestration
# The model MUST call select_active_intent with one of these ids before making code changes.
# Each intent can have: id, constraints, scope (or owned_scope)

- id: default
  constraints: "General edits within the project. Follow existing patterns and tests."
  scope: ""
`,
	agent_trace: "",
	intent_map: `# Intent map
# Map intent identifiers to constraints and scope.
`,
	CLAUDE: `# Orchestration instructions for the agent
# This file is used by the intent-governed orchestration layer.
`,
}

const AGENT_TRACE_FILENAME = "agent_trace.jsonl"

/**
 * Ensures .orchestration/ exists in the workspace and contains
 * active_intents.yaml, agent_trace.jsonl, intent_map.md, CLAUDE.md.
 * Uses workspace FS APIs only (no absolute paths).
 * Called on extension activation.
 */
export async function ensureOrchestrationSidecar(): Promise<void> {
	const folders = vscode.workspace.workspaceFolders
	if (!folders?.length) {
		return
	}

	for (const folder of folders) {
		try {
			const dirUri = vscode.Uri.joinPath(folder.uri, ORCHESTRATION_DIR)
			await vscode.workspace.fs.createDirectory(dirUri)

			// active_intents.yaml
			const activeIntentsUri = vscode.Uri.joinPath(dirUri, "active_intents.yaml")
			await writeIfMissing(activeIntentsUri, FILES.active_intents)

			// agent_trace.jsonl
			const agentTraceUri = vscode.Uri.joinPath(dirUri, AGENT_TRACE_FILENAME)
			await writeIfMissing(agentTraceUri, FILES.agent_trace)

			// intent_map.md
			const intentMapUri = vscode.Uri.joinPath(dirUri, "intent_map.md")
			await writeIfMissing(intentMapUri, FILES.intent_map)

			// CLAUDE.md
			const claudeUri = vscode.Uri.joinPath(dirUri, "CLAUDE.md")
			await writeIfMissing(claudeUri, FILES.CLAUDE)
		} catch (err) {
			// Best-effort: do not fail activation
			console.warn(`[orchestration] Failed to bootstrap .orchestration for ${folder.uri.fsPath}:`, err)
		}
	}
}

async function writeIfMissing(uri: vscode.Uri, content: string): Promise<void> {
	try {
		await vscode.workspace.fs.stat(uri)
		// File exists, do not overwrite
	} catch {
		const encoder = new TextEncoder()
		await vscode.workspace.fs.writeFile(uri, encoder.encode(content))
	}
}
