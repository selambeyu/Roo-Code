/**
 * Session state for the active intent (intent-governed orchestration).
 * Keyed by task ID so each task has its own active intent.
 */

export interface ActiveIntent {
	id: string
	constraints?: string
	scope?: string
	owned_scope?: string
}

const stateByTaskId = new Map<string, ActiveIntent>()

export function setActiveIntent(taskId: string, intent: ActiveIntent | null): void {
	if (intent === null) {
		stateByTaskId.delete(taskId)
	} else {
		stateByTaskId.set(taskId, intent)
	}
}

export function getActiveIntent(taskId: string): ActiveIntent | null {
	return stateByTaskId.get(taskId) ?? null
}
