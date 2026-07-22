const ACTIVITY_KEY_PREFIX = "nb_sync_activity_";
const ALERT_KEY_PREFIX = "nb_sync_alerts_";
const NOTES_KEY_PREFIX = "nb_sync_notes_";

function loadList(key) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function saveList(key, list) {
	localStorage.setItem(key, JSON.stringify(list));
}

function nowTime() {
	return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function pushWardActivity(wardId, { event, type = "neutral" }) {
	if (!wardId || !event) return;
	const key = `${ACTIVITY_KEY_PREFIX}${wardId}`;
	const existing = loadList(key);
	const next = [
		{
			id: `sync-act-${Date.now()}`,
			time: nowTime(),
			event,
			type,
			created_at: new Date().toISOString(),
		},
		...existing,
	].slice(0, 100);
	saveList(key, next);
}

export function pushWardAlert(wardId, payload = {}) {
	const { message, level = "medium", resolved = false, ...meta } = payload;
	if (!wardId || !message) return;
	const key = `${ALERT_KEY_PREFIX}${wardId}`;
	const existing = loadList(key);
	const next = [
		{
			id: `sync-alert-${Date.now()}`,
			ts: `Today ${nowTime()}`,
			level,
			message,
			resolved,
			...meta,
			created_at: new Date().toISOString(),
		},
		...existing,
	].slice(0, 100);
	saveList(key, next);
}

export function pushWardNote(wardId, { from, text, wardName = "Ward", isPrivate = false }) {
	if (!wardId || !text) return;
	const key = `${NOTES_KEY_PREFIX}${wardId}`;
	const existing = loadList(key);
	const next = [
		{
			id: `sync-note-${Date.now()}`,
			from: from || "guardian",
			text,
			ts: nowTime(),
			private: isPrivate,
			wardName,
			created_at: new Date().toISOString(),
		},
		...existing,
	].slice(0, 120);
	saveList(key, next);
}

export function loadWardSyncData(wardId, base = {}) {
	if (!wardId) {
		return {
			name: base?.name || "Ward",
			profile: base?.profile || "default",
			today: base?.today || [],
			alerts: base?.alerts || [],
			journalNotes: base?.journalNotes || [],
			weeklyStats: base?.weeklyStats || {},
		};
	}

	const extraActivity = loadList(`${ACTIVITY_KEY_PREFIX}${wardId}`);
	const extraAlerts = loadList(`${ALERT_KEY_PREFIX}${wardId}`);
	const extraNotes = loadList(`${NOTES_KEY_PREFIX}${wardId}`);

	return {
		name: base?.name || "Ward",
		profile: base?.profile || "default",
		today: [...extraActivity, ...(base?.today || [])],
		alerts: [...extraAlerts, ...(base?.alerts || [])],
		journalNotes: [...extraNotes, ...(base?.journalNotes || [])],
		weeklyStats: base?.weeklyStats || {},
	};
}

export function loadWardNotes(wardId, baseNotes = []) {
	if (!wardId) {
		return Array.isArray(baseNotes) ? baseNotes : [];
	}
	const extraNotes = loadList(`${NOTES_KEY_PREFIX}${wardId}`);
	return [...extraNotes, ...(Array.isArray(baseNotes) ? baseNotes : [])];
}
