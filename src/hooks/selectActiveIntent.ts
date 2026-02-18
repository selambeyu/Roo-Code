import * as vscode from "vscode"
import * as yaml from "yaml"

export interface ResolvedIntent {
	id: string
	constraints: string
	scope: string
}

/**
 * Read .orchestration/active_intents.yaml from the workspace containing cwd.
 * Returns parsed list of intents (array of { id?, constraints?, scope?, owned_scope? }).
 */
export async function readActiveIntentsYaml(cwd: string): Promise<unknown[]> {
	const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(cwd))
	if (!folder) {
		return []
	}
	const uri = vscode.Uri.joinPath(folder.uri, ".orchestration", "active_intents.yaml")
	try {
		const buf = await vscode.workspace.fs.readFile(uri)
		const text = new TextDecoder().decode(buf)
		const parsed = yaml.parse(text)
		if (Array.isArray(parsed)) {
			return parsed
		}
		if (
			parsed &&
			typeof parsed === "object" &&
			"intents" in parsed &&
			Array.isArray((parsed as { intents: unknown }).intents)
		) {
			return (parsed as { intents: unknown[] }).intents
		}
		return []
	} catch {
		return []
	}
}

/**
 * Extract all intent ids from the parsed list (for system prompt and validation).
 * Supports id or intent_id field.
 */
export function getIntentIdsFromParsed(intents: unknown[]): string[] {
	const ids: string[] = []
	for (const entry of intents) {
		if (!entry || typeof entry !== "object") continue
		const obj = entry as Record<string, unknown>
		const id = (obj.id ?? obj.intent_id) as string | undefined
		if (id != null && String(id).trim()) ids.push(String(id).trim())
	}
	return ids
}

/**
 * Find an intent by id in the parsed list. Supports id or intent_id field.
 * scope is taken from scope or owned_scope.
 */
export function findIntentById(intents: unknown[], intentId: string): ResolvedIntent | null {
	for (const entry of intents) {
		if (!entry || typeof entry !== "object") continue
		const obj = entry as Record<string, unknown>
		const id = (obj.id ?? obj.intent_id) as string | undefined
		if (id !== intentId) continue
		const constraints = String(obj.constraints ?? "")
		const scope = String(obj.owned_scope ?? obj.scope ?? "")
		return { id: String(id), constraints, scope }
	}
	return null
}

/**
 * Build the XML response for select_active_intent.
 */
export function buildIntentContextXml(resolved: ResolvedIntent): string {
	return `<intent_context>
  <id>${escapeXml(resolved.id)}</id>
  <constraints>${escapeXml(resolved.constraints)}</constraints>
  <scope>${escapeXml(resolved.scope)}</scope>
</intent_context>`
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;")
}
