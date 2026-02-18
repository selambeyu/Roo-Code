import type OpenAI from "openai"

const DESCRIPTION = `Select the active intent for this session before making any code changes. Call this first when the user has specified an intent (e.g. from a ticket or .orchestration/active_intents.yaml). Required by the orchestration layer before write operations.`

export default {
	type: "function",
	function: {
		name: "select_active_intent",
		description: DESCRIPTION,
		strict: true,
		parameters: {
			type: "object",
			properties: {
				intent_id: {
					type: "string",
					description: "Identifier of the intent (must match an entry in .orchestration/active_intents.yaml)",
				},
			},
			required: ["intent_id"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
