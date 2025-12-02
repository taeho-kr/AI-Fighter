import { writable, derived } from 'svelte/store';

// 게임 상태 타입
export type GameState = 'menu' | 'playing' | 'paused' | 'dead' | 'victory';
export type CameraMode = 'first-person' | 'third-person';

// 플레이어 액션 타입 (AI 학습용)
export type PlayerAction = {
	type: 'light_attack' | 'heavy_attack' | 'guard' | 'parry' | 'dodge';
	direction?: 'forward' | 'backward' | 'left' | 'right';
	timestamp: number;
};

// 플레이어 상태
export const playerHealth = writable(100);
export const playerMaxHealth = writable(100);
export const playerStamina = writable(100);
export const playerMaxStamina = writable(100);
export const playerState = writable<'idle' | 'attacking' | 'guarding' | 'dodging' | 'stunned' | 'parrying'>('idle');

// 적 상태
export const enemyHealth = writable(100);
export const enemyMaxHealth = writable(100);
export const enemyState = writable<'idle' | 'attacking' | 'stunned' | 'chasing'>('idle');

// 게임 상태
export const gameState = writable<GameState>('menu');
export const cameraMode = writable<CameraMode>('third-person');
export const currentRound = writable(1);
export const bossLevel = writable(1);

// 플레이어 액션 기록 (AI 학습용)
export const playerActionHistory = writable<PlayerAction[]>([]);

// AI 학습 데이터
export const aiLearningData = writable({
	// 공격 패턴 빈도
	attackPatterns: {
		light_attack: 0,
		heavy_attack: 0
	},
	// 회피 방향 빈도
	dodgeDirections: {
		forward: 0,
		backward: 0,
		left: 0,
		right: 0
	},
	// 가드/패링 빈도
	defensiveActions: {
		guard: 0,
		parry: 0
	},
	// 공격 타이밍 패턴 (연속 공격 간격)
	attackTimings: [] as number[],
	// 플레이어가 회피하는 적 공격 타입
	dodgedAttacks: {
		light: 0,
		heavy: 0
	}
});

// 액션 기록 함수
export function recordAction(action: Omit<PlayerAction, 'timestamp'>) {
	const timestampedAction: PlayerAction = {
		...action,
		timestamp: Date.now()
	};

	playerActionHistory.update(history => {
		const newHistory = [...history, timestampedAction];
		// 최근 100개 액션만 유지
		return newHistory.slice(-100);
	});

	// AI 학습 데이터 업데이트
	aiLearningData.update(data => {
		if (action.type === 'light_attack' || action.type === 'heavy_attack') {
			data.attackPatterns[action.type]++;
		} else if (action.type === 'dodge' && action.direction) {
			data.dodgeDirections[action.direction]++;
		} else if (action.type === 'guard' || action.type === 'parry') {
			data.defensiveActions[action.type]++;
		}
		return data;
	});
}

// 게임 리셋 함수
export function resetGame() {
	playerHealth.set(100);
	playerStamina.set(100);
	playerState.set('idle');
	enemyHealth.set(100);
	enemyState.set('idle');
	gameState.set('playing');
}

// 라운드 진행 (보스 강화)
export function nextRound() {
	currentRound.update(r => r + 1);
	bossLevel.update(l => l + 1);
	resetGame();
}

// 파생 스토어 - 플레이어 생존 여부
export const isPlayerAlive = derived(playerHealth, $health => $health > 0);
export const isEnemyAlive = derived(enemyHealth, $health => $health > 0);
