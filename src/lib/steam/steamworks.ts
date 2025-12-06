// Steamworks Integration for AI Fighter
// Steam API wrapper for achievements, stats, and overlay

// Steam App ID (개발용 기본값, 실제 출시 시 변경 필요)
export const STEAM_APP_ID = 480; // Spacewar test app ID

// Steam 초기화 상태
let steamInitialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let steamworks: any = null;

// Steam 초기화
export async function initSteam(): Promise<boolean> {
	// Electron 환경에서만 Steam 초기화
	if (typeof window === 'undefined' || !('require' in window)) {
		console.log('Not in Electron environment, Steam disabled');
		return false;
	}

	try {
		// steamworks.js 동적 로드
		steamworks = (window as any).require('steamworks.js');

		if (!steamworks) {
			console.warn('steamworks.js not available');
			return false;
		}

		// Steam 클라이언트 초기화
		const client = steamworks.init(STEAM_APP_ID);

		if (!client) {
			console.warn('Failed to initialize Steam client');
			return false;
		}

		steamInitialized = true;
		console.log('Steam initialized successfully');

		// Steam 유저 정보 로그
		const playerName = client.localplayer.getName();
		console.log(`Welcome, ${playerName}!`);

		return true;
	} catch (error) {
		console.warn('Steam initialization failed:', error);
		return false;
	}
}

// Steam 초기화 여부 확인
export function isSteamInitialized(): boolean {
	return steamInitialized;
}

// === 업적 시스템 ===

// Steam 업적 ID 매핑
export const STEAM_ACHIEVEMENTS = {
	// 전투 업적
	FIRST_BLOOD: 'ACH_FIRST_BLOOD',
	VETERAN: 'ACH_VETERAN',
	CHAMPION: 'ACH_CHAMPION',
	LEGEND: 'ACH_LEGEND',

	// 레벨 업적
	REACH_LEVEL_5: 'ACH_LEVEL_5',
	REACH_LEVEL_10: 'ACH_LEVEL_10',
	REACH_LEVEL_20: 'ACH_LEVEL_20',

	// 스킬 업적
	PARRY_MASTER: 'ACH_PARRY_MASTER',
	DODGE_MASTER: 'ACH_DODGE_MASTER',
	PERFECT_ROUND: 'ACH_PERFECT_ROUND',
	FLAWLESS_STREAK: 'ACH_FLAWLESS_STREAK',

	// 도전 업적
	HARD_MODE_CLEAR: 'ACH_HARD_MODE',
	SPEED_DEMON: 'ACH_SPEED_DEMON',
	COMEBACK: 'ACH_COMEBACK',

	// 숨겨진 업적
	SURVIVOR: 'ACH_SURVIVOR',
	DEDICATED: 'ACH_DEDICATED',
	MASOCHIST: 'ACH_MASOCHIST'
} as const;

// 업적 해제
export function unlockSteamAchievement(achievementId: string): boolean {
	if (!steamInitialized || !steamworks) return false;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return false;

		client.achievement.activate(achievementId);
		console.log(`Steam achievement unlocked: ${achievementId}`);
		return true;
	} catch (error) {
		console.error('Failed to unlock achievement:', error);
		return false;
	}
}

// 업적 상태 확인
export function isSteamAchievementUnlocked(achievementId: string): boolean {
	if (!steamInitialized || !steamworks) return false;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return false;

		return client.achievement.isActivated(achievementId);
	} catch (error) {
		console.error('Failed to check achievement:', error);
		return false;
	}
}

// 모든 업적 초기화 (개발용)
export function clearAllAchievements(): void {
	if (!steamInitialized || !steamworks) return;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return;

		for (const id of Object.values(STEAM_ACHIEVEMENTS)) {
			client.achievement.clear(id);
		}
		console.log('All Steam achievements cleared');
	} catch (error) {
		console.error('Failed to clear achievements:', error);
	}
}

// === 통계 시스템 ===

// Steam 통계 ID
export const STEAM_STATS = {
	TOTAL_WINS: 'STAT_TOTAL_WINS',
	TOTAL_DEATHS: 'STAT_TOTAL_DEATHS',
	HIGHEST_ROUND: 'STAT_HIGHEST_ROUND',
	TOTAL_PLAYTIME: 'STAT_TOTAL_PLAYTIME',
	TOTAL_PARRIES: 'STAT_TOTAL_PARRIES',
	TOTAL_DODGES: 'STAT_TOTAL_DODGES',
	TOTAL_DAMAGE_DEALT: 'STAT_TOTAL_DAMAGE_DEALT'
} as const;

// 통계 설정
export function setSteamStat(statId: string, value: number): boolean {
	if (!steamInitialized || !steamworks) return false;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return false;

		client.stats.setInt(statId, value);
		client.stats.store(); // 서버에 저장
		return true;
	} catch (error) {
		console.error('Failed to set stat:', error);
		return false;
	}
}

// 통계 증가
export function incrementSteamStat(statId: string, amount: number = 1): boolean {
	if (!steamInitialized || !steamworks) return false;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return false;

		const current = client.stats.getInt(statId) || 0;
		client.stats.setInt(statId, current + amount);
		client.stats.store();
		return true;
	} catch (error) {
		console.error('Failed to increment stat:', error);
		return false;
	}
}

// 통계 조회
export function getSteamStat(statId: string): number {
	if (!steamInitialized || !steamworks) return 0;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return 0;

		return client.stats.getInt(statId) || 0;
	} catch (error) {
		console.error('Failed to get stat:', error);
		return 0;
	}
}

// === 오버레이 ===

// Steam 오버레이 활성화 여부
export function isSteamOverlayEnabled(): boolean {
	if (!steamInitialized || !steamworks) return false;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		return client?.overlay?.isEnabled() ?? false;
	} catch (error) {
		return false;
	}
}

// Steam 오버레이 활성화/비활성화 콜백
export function onSteamOverlayChanged(callback: (active: boolean) => void): void {
	if (!steamInitialized || !steamworks) return;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return;

		client.callback.register(client.callback.cyclic.OverlayActivated, (data: any) => {
			callback(data.active);
		});
	} catch (error) {
		console.error('Failed to register overlay callback:', error);
	}
}

// === 리치 프레즌스 ===

// Steam 리치 프레즌스 설정
export function setSteamRichPresence(key: string, value: string): void {
	if (!steamInitialized || !steamworks) return;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return;

		client.friends.setRichPresence(key, value);
	} catch (error) {
		console.error('Failed to set rich presence:', error);
	}
}

// 게임 상태에 따른 리치 프레즌스 업데이트
export function updateGamePresence(state: 'menu' | 'playing' | 'paused', round?: number): void {
	switch (state) {
		case 'menu':
			setSteamRichPresence('steam_display', '#StatusMainMenu');
			break;
		case 'playing':
			setSteamRichPresence('steam_display', '#StatusPlaying');
			setSteamRichPresence('round', String(round || 1));
			break;
		case 'paused':
			setSteamRichPresence('steam_display', '#StatusPaused');
			break;
	}
}

// === 클라우드 저장 ===

// Steam 클라우드에 저장
export function saveToCloud(filename: string, data: string): boolean {
	if (!steamInitialized || !steamworks) return false;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return false;

		client.cloud.writeFile(filename, Buffer.from(data));
		console.log(`Saved to Steam Cloud: ${filename}`);
		return true;
	} catch (error) {
		console.error('Failed to save to cloud:', error);
		return false;
	}
}

// Steam 클라우드에서 로드
export function loadFromCloud(filename: string): string | null {
	if (!steamInitialized || !steamworks) return null;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return null;

		if (!client.cloud.isFileExists(filename)) {
			return null;
		}

		const buffer = client.cloud.readFile(filename);
		return buffer.toString();
	} catch (error) {
		console.error('Failed to load from cloud:', error);
		return null;
	}
}

// 클라우드 파일 삭제
export function deleteFromCloud(filename: string): boolean {
	if (!steamInitialized || !steamworks) return false;

	try {
		const client = steamworks.init(STEAM_APP_ID);
		if (!client) return false;

		client.cloud.deleteFile(filename);
		return true;
	} catch (error) {
		console.error('Failed to delete from cloud:', error);
		return false;
	}
}

// Steam 종료 처리
export function shutdownSteam(): void {
	if (!steamInitialized || !steamworks) return;

	try {
		steamworks.shutdown?.();
		steamInitialized = false;
		console.log('Steam shutdown complete');
	} catch (error) {
		console.error('Failed to shutdown Steam:', error);
	}
}
