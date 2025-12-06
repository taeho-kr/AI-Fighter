// Settings Store - 게임 설정 저장/로드 시스템
import { writable, get } from 'svelte/store';

// 설정 타입 정의
export interface GameSettings {
	// 오디오
	masterVolume: number;
	bgmVolume: number;
	sfxVolume: number;
	muted: boolean;

	// 그래픽
	graphicsQuality: 'low' | 'medium' | 'high';
	showFPS: boolean;
	enableParticles: boolean;
	enablePostProcessing: boolean;
	shadowQuality: 'off' | 'low' | 'medium' | 'high';

	// 게임플레이
	difficulty: 'easy' | 'normal' | 'hard';
	cameraShake: boolean;
	screenFlash: boolean;
	showDamageNumbers: boolean;
	showTutorialHints: boolean;

	// 접근성
	colorblindMode: 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia';
	highContrast: boolean;
	reducedMotion: boolean;
	largeText: boolean;

	// 컨트롤
	mouseSensitivity: number;
	invertY: boolean;
}

// 기본 설정
const defaultSettings: GameSettings = {
	// 오디오
	masterVolume: 0.7,
	bgmVolume: 0.5,
	sfxVolume: 0.8,
	muted: false,

	// 그래픽
	graphicsQuality: 'high',
	showFPS: false,
	enableParticles: true,
	enablePostProcessing: true,
	shadowQuality: 'medium',

	// 게임플레이
	difficulty: 'normal',
	cameraShake: true,
	screenFlash: true,
	showDamageNumbers: true,
	showTutorialHints: true,

	// 접근성
	colorblindMode: 'off',
	highContrast: false,
	reducedMotion: false,
	largeText: false,

	// 컨트롤
	mouseSensitivity: 1.0,
	invertY: false
};

// 로컬 스토리지 키
const SETTINGS_KEY = 'ai-fighter-settings';
const SAVE_KEY = 'ai-fighter-save';
const ACHIEVEMENTS_KEY = 'ai-fighter-achievements';
const STATS_KEY = 'ai-fighter-stats';

// 설정 로드
function loadSettings(): GameSettings {
	if (typeof localStorage === 'undefined') return { ...defaultSettings };

	try {
		const saved = localStorage.getItem(SETTINGS_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			return { ...defaultSettings, ...parsed };
		}
	} catch (e) {
		console.error('Failed to load settings:', e);
	}
	return { ...defaultSettings };
}

// 설정 스토어
export const settings = writable<GameSettings>(loadSettings());

// 설정 자동 저장
settings.subscribe((value) => {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
		} catch (e) {
			console.error('Failed to save settings:', e);
		}
	}
});

// 설정 업데이트 헬퍼
export function updateSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]) {
	settings.update(s => ({ ...s, [key]: value }));
}

// 설정 초기화
export function resetSettings() {
	settings.set({ ...defaultSettings });
}

// === 게임 진행 저장 ===
export interface GameSave {
	version: number;
	timestamp: number;
	highestRound: number;
	totalWins: number;
	totalDeaths: number;
	totalPlayTime: number; // 초
	lastDifficulty: 'easy' | 'normal' | 'hard';
}

const defaultSave: GameSave = {
	version: 1,
	timestamp: 0,
	highestRound: 0,
	totalWins: 0,
	totalDeaths: 0,
	totalPlayTime: 0,
	lastDifficulty: 'normal'
};

// 세이브 로드
function loadSave(): GameSave {
	if (typeof localStorage === 'undefined') return { ...defaultSave };

	try {
		const saved = localStorage.getItem(SAVE_KEY);
		if (saved) {
			const parsed = JSON.parse(saved);
			return { ...defaultSave, ...parsed };
		}
	} catch (e) {
		console.error('Failed to load save:', e);
	}
	return { ...defaultSave };
}

// 세이브 스토어
export const gameSave = writable<GameSave>(loadSave());

// 세이브 자동 저장
gameSave.subscribe((value) => {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem(SAVE_KEY, JSON.stringify({ ...value, timestamp: Date.now() }));
		} catch (e) {
			console.error('Failed to save game:', e);
		}
	}
});

// 세이브 업데이트 헬퍼
export function updateSave(updates: Partial<GameSave>) {
	gameSave.update(s => ({ ...s, ...updates }));
}

// 라운드 클리어
export function recordRoundClear(round: number) {
	gameSave.update(s => ({
		...s,
		highestRound: Math.max(s.highestRound, round),
		totalWins: s.totalWins + 1
	}));
}

// 사망 기록
export function recordDeath() {
	gameSave.update(s => ({
		...s,
		totalDeaths: s.totalDeaths + 1
	}));
}

// 플레이타임 업데이트
export function updatePlayTime(seconds: number) {
	gameSave.update(s => ({
		...s,
		totalPlayTime: s.totalPlayTime + seconds
	}));
}

// 세이브 초기화
export function resetSave() {
	gameSave.set({ ...defaultSave });
}

// === 업적 시스템 ===
export interface Achievement {
	id: string;
	name: string;
	description: string;
	icon: string;
	unlocked: boolean;
	unlockedAt?: number;
	progress?: number;
	maxProgress?: number;
	hidden?: boolean;
}

// 업적 정의
export const achievementDefinitions: Omit<Achievement, 'unlocked' | 'unlockedAt' | 'progress'>[] = [
	// 전투 업적
	{ id: 'first_blood', name: 'First Blood', description: 'Win your first round', icon: '🩸', maxProgress: 1 },
	{ id: 'veteran', name: 'Veteran', description: 'Win 10 rounds', icon: '🎖️', maxProgress: 10 },
	{ id: 'champion', name: 'Champion', description: 'Win 50 rounds', icon: '🏆', maxProgress: 50 },
	{ id: 'legend', name: 'Legend', description: 'Win 100 rounds', icon: '👑', maxProgress: 100 },

	// 레벨 업적
	{ id: 'reach_level_5', name: 'Getting Serious', description: 'Reach Boss Level 5', icon: '⚔️', maxProgress: 5 },
	{ id: 'reach_level_10', name: 'AI Trainer', description: 'Reach Boss Level 10', icon: '🤖', maxProgress: 10 },
	{ id: 'reach_level_20', name: 'Master Trainer', description: 'Reach Boss Level 20', icon: '🧠', maxProgress: 20 },

	// 스킬 업적
	{ id: 'parry_master', name: 'Parry Master', description: 'Successfully parry 50 attacks', icon: '🛡️', maxProgress: 50 },
	{ id: 'dodge_master', name: 'Dodge Master', description: 'Dodge 100 attacks', icon: '💨', maxProgress: 100 },
	{ id: 'perfect_round', name: 'Perfect Round', description: 'Win a round without taking damage', icon: '✨' },
	{ id: 'flawless_5', name: 'Flawless Streak', description: 'Win 5 rounds without dying', icon: '🔥', maxProgress: 5 },

	// 도전 업적
	{ id: 'hard_mode_clear', name: 'Hard Mode Victor', description: 'Clear a round on Hard difficulty', icon: '💀' },
	{ id: 'speed_demon', name: 'Speed Demon', description: 'Win a round in under 30 seconds', icon: '⚡' },
	{ id: 'comeback', name: 'Comeback King', description: 'Win with less than 10% HP', icon: '❤️‍🔥' },

	// 숨겨진 업적
	{ id: 'survivor', name: 'Survivor', description: 'Survive for 5 minutes in a single round', icon: '⏰', hidden: true },
	{ id: 'dedicated', name: 'Dedicated', description: 'Play for 1 hour total', icon: '🎮', hidden: true },
	{ id: 'masochist', name: 'Masochist', description: 'Die 100 times', icon: '💀', hidden: true, maxProgress: 100 }
];

// 업적 상태 로드
function loadAchievements(): Map<string, Achievement> {
	const achievements = new Map<string, Achievement>();

	// 기본 업적 초기화
	for (const def of achievementDefinitions) {
		achievements.set(def.id, {
			...def,
			unlocked: false,
			progress: 0
		});
	}

	// 저장된 업적 로드
	if (typeof localStorage !== 'undefined') {
		try {
			const saved = localStorage.getItem(ACHIEVEMENTS_KEY);
			if (saved) {
				const parsed = JSON.parse(saved) as Array<{ id: string; unlocked: boolean; unlockedAt?: number; progress?: number }>;
				for (const item of parsed) {
					const existing = achievements.get(item.id);
					if (existing) {
						achievements.set(item.id, { ...existing, ...item });
					}
				}
			}
		} catch (e) {
			console.error('Failed to load achievements:', e);
		}
	}

	return achievements;
}

// 업적 스토어
export const achievements = writable<Map<string, Achievement>>(loadAchievements());

// 업적 저장
function saveAchievements(achs: Map<string, Achievement>) {
	if (typeof localStorage !== 'undefined') {
		try {
			const toSave = Array.from(achs.values()).map(a => ({
				id: a.id,
				unlocked: a.unlocked,
				unlockedAt: a.unlockedAt,
				progress: a.progress
			}));
			localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(toSave));
		} catch (e) {
			console.error('Failed to save achievements:', e);
		}
	}
}

achievements.subscribe(saveAchievements);

// 업적 진행도 업데이트
export function updateAchievementProgress(id: string, progress: number): boolean {
	let unlocked = false;
	achievements.update(achs => {
		const ach = achs.get(id);
		if (ach && !ach.unlocked) {
			ach.progress = Math.max(ach.progress || 0, progress);
			if (ach.maxProgress && ach.progress >= ach.maxProgress) {
				ach.unlocked = true;
				ach.unlockedAt = Date.now();
				unlocked = true;
			}
		}
		return achs;
	});
	return unlocked;
}

// 업적 해제
export function unlockAchievement(id: string): boolean {
	let unlocked = false;
	achievements.update(achs => {
		const ach = achs.get(id);
		if (ach && !ach.unlocked) {
			ach.unlocked = true;
			ach.unlockedAt = Date.now();
			ach.progress = ach.maxProgress || 1;
			unlocked = true;
		}
		return achs;
	});
	return unlocked;
}

// 업적 초기화
export function resetAchievements() {
	achievements.set(loadAchievements());
}

// === 통계 ===
export interface GameStats {
	// 전투 통계
	totalLightAttacks: number;
	totalHeavyAttacks: number;
	totalParries: number;
	totalDodges: number;
	totalBlocks: number;

	// 데미지 통계
	totalDamageDealt: number;
	totalDamageTaken: number;
	totalDamageBlocked: number;

	// 기록
	fastestWin: number; // ms
	longestSurvival: number; // ms
	highestCombo: number;
	perfectRounds: number;

	// 세션 통계
	currentStreak: number;
	bestStreak: number;
}

const defaultStats: GameStats = {
	totalLightAttacks: 0,
	totalHeavyAttacks: 0,
	totalParries: 0,
	totalDodges: 0,
	totalBlocks: 0,
	totalDamageDealt: 0,
	totalDamageTaken: 0,
	totalDamageBlocked: 0,
	fastestWin: 0,
	longestSurvival: 0,
	highestCombo: 0,
	perfectRounds: 0,
	currentStreak: 0,
	bestStreak: 0
};

function loadStats(): GameStats {
	if (typeof localStorage === 'undefined') return { ...defaultStats };

	try {
		const saved = localStorage.getItem(STATS_KEY);
		if (saved) {
			return { ...defaultStats, ...JSON.parse(saved) };
		}
	} catch (e) {
		console.error('Failed to load stats:', e);
	}
	return { ...defaultStats };
}

export const gameStats = writable<GameStats>(loadStats());

gameStats.subscribe((value) => {
	if (typeof localStorage !== 'undefined') {
		try {
			localStorage.setItem(STATS_KEY, JSON.stringify(value));
		} catch (e) {
			console.error('Failed to save stats:', e);
		}
	}
});

export function updateStats(updates: Partial<GameStats>) {
	gameStats.update(s => ({ ...s, ...updates }));
}

export function incrementStat(key: keyof GameStats, amount: number = 1) {
	gameStats.update(s => ({ ...s, [key]: (s[key] as number) + amount }));
}

export function resetStats() {
	gameStats.set({ ...defaultStats });
}
