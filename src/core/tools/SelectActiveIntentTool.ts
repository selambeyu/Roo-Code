import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import type { ToolUse } from "../../shared/tools"
import { readActiveIntentsYaml, findIntentById, buildIntentContextXml } from "../../hooks/selectActiveIntent"
import { setActiveIntent } from "../../hooks/activeIntentState"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectActiveIntentTool extends BaseTool<"select_active_intent"> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { handleError, pushToolResult } = callbacks

		try {
			if (!intent_id?.trim()) {
				task.consecutiveMistakeCount++
				task.recordToolError("select_active_intent")
				pushToolResult(await task.sayAndCreateMissingParamError("select_active_intent", "intent_id"))
				return
			}

			task.consecutiveMistakeCount = 0

			const intents = await readActiveIntentsYaml(task.cwd)
			const resolved = findIntentById(intents, intent_id.trim())

			if (!resolved) {
				task.recordToolError("select_active_intent")
				callbacks.pushToolResult(
					formatResponse.toolError(`Intent "${intent_id}" not found in .orchestration/active_intents.yaml.`),
				)
				return
			}

			setActiveIntent(task.taskId, {
				id: resolved.id,
				constraints: resolved.constraints,
				scope: resolved.scope,
				owned_scope: resolved.scope,
			})

			const xml = buildIntentContextXml(resolved)
			pushToolResult(xml)
		} catch (error) {
			await handleError("selecting active intent", error as Error)
		}
	}
}

export const selectActiveIntentTool = new SelectActiveIntentTool()
