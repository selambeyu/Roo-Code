import { readActiveIntentsYaml, getIntentIdsFromParsed } from "../../../hooks/selectActiveIntent"

/**
 * Generates the orchestration handshake section for the system prompt.
 * When .orchestration/active_intents.yaml exists, mandates that the model MUST call
 * select_active_intent with an intent from that file before any write operations.
 * Feeds the prompt with the list of valid intent ids from the YAML.
 */
export async function getOrchestrationHandshakeSection(cwd: string): Promise<string> {
	const intents = await readActiveIntentsYaml(cwd)
	const ids = getIntentIdsFromParsed(intents)
	if (ids.length === 0) {
		return `## Orchestration / Intent handshake

When this workspace contains \`.orchestration/active_intents.yaml\`, you MUST call the \`select_active_intent\` tool with an intent id from that file before making any code changes. No write operations (e.g. write_to_file, apply_diff, edit_file) are allowed until you have done so.`
	}
	const idList = ids.map((id) => `\`${id}\``).join(", ")
	return `## Orchestration / Intent handshake

This workspace has \`.orchestration/active_intents.yaml\`. You MUST call \`select_active_intent\` with one of the following intent ids **before** making any code changes:

${idList}

No write operations (write_to_file, apply_diff, edit_file, search_replace, apply_patch, generate_image) are allowed until you have called \`select_active_intent\` with a valid intent id from the list above.`
}
