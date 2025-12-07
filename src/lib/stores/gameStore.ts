import { writable, derived } from 'svelte/store';
import { resetDQNAgent, type AIAction } from '$lib/ai/DQN';

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

// 적 상태 (predicting: 예측 공격 준비, retreating: 후퇴)
export const enemyHealth = writable(100);
export const enemyMaxHealth = writable(100);
export const enemyState = writable<'idle' | 'attacking' | 'stunned' | 'chasing' | 'predicting' | 'retreating'>('idle');

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
	},
	// 움직임 패턴
	movementPatterns: {
		// 이동 방향 빈도
		directions: {
			forward: 0,
			backward: 0,
			left: 0,
			right: 0,
			idle: 0
		},
		// 선호 거리 (가까이/중간/멀리)
		preferredDistance: {
			close: 0,   // 0-3
			mid: 0,     // 3-6
			far: 0      // 6+
		},
		// 접근/후퇴 경향
		approachTendency: 0,  // 양수: 접근, 음수: 후퇴
		// 측면 이동 경향
		strafeTendency: 0     // 양수: 우측, 음수: 좌측
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

// 움직임 기록 함수 (프레임마다 호출)
export function recordMovement(
	movementDir: { forward: boolean; backward: boolean; left: boolean; right: boolean },
	distanceToEnemy: number,
	deltaDistance: number  // 이전 프레임 대비 거리 변화
) {
	aiLearningData.update(data => {
		const patterns = data.movementPatterns;

		// 이동 방향 기록
		if (movementDir.forward) patterns.directions.forward++;
		if (movementDir.backward) patterns.directions.backward++;
		if (movementDir.left) patterns.directions.left++;
		if (movementDir.right) patterns.directions.right++;
		if (!movementDir.forward && !movementDir.backward && !movementDir.left && !movementDir.right) {
			patterns.directions.idle++;
		}

		// 선호 거리 기록
		if (distanceToEnemy <= 3) {
			patterns.preferredDistance.close++;
		} else if (distanceToEnemy <= 6) {
			patterns.preferredDistance.mid++;
		} else {
			patterns.preferredDistance.far++;
		}

		// 접근/후퇴 경향 (거리 변화량)
		patterns.approachTendency += deltaDistance * -1;  // 가까워지면 양수

		// 측면 이동 경향
		if (movementDir.left) patterns.strafeTendency--;
		if (movementDir.right) patterns.strafeTendency++;

		return data;
	});
}

// 게임 리셋 함수 (gameState는 변경하지 않음 - 호출하는 쪽에서 관리)
export function resetGame() {
	playerHealth.set(100);
	playerStamina.set(100);
	playerState.set('idle');
	enemyHealth.set(100);
	enemyState.set('idle');
}

// 학습 데이터 localStorage 저장
export function saveAILearningData() {
	try {
		// aiLearningData의 현재 값을 가져와서 저장
		const unsubscribe = aiLearningData.subscribe(value => {
			localStorage.setItem('ai-fighter-learning-data', JSON.stringify({
				...value,
				timestamp: Date.now()
			}));
		});
		unsubscribe(); // 즉시 구독 해제
	} catch (error) {
		console.error('Failed to save AI learning data:', error);
	}
}

// 학습 데이터 localStorage에서 로드
export function loadAILearningData(): boolean {
	try {
		const saved = localStorage.getItem('ai-fighter-learning-data');
		if (saved) {
			const data = JSON.parse(saved);
			// timestamp 필드 제거 후 로드
			const { timestamp, ...learningData } = data;
			aiLearningData.set({
				attackPatterns: learningData.attackPatterns || { light_attack: 0, heavy_attack: 0 },
				dodgeDirections: learningData.dodgeDirections || { forward: 0, backward: 0, left: 0, right: 0 },
				defensiveActions: learningData.defensiveActions || { guard: 0, parry: 0 },
				attackTimings: learningData.attackTimings || [],
				dodgedAttacks: learningData.dodgedAttacks || { light: 0, heavy: 0 },
				movementPatterns: learningData.movementPatterns || {
					directions: { forward: 0, backward: 0, left: 0, right: 0, idle: 0 },
					preferredDistance: { close: 0, mid: 0, far: 0 },
					approachTendency: 0,
					strafeTendency: 0
				}
			});
			console.log('AI learning data loaded from localStorage');
			return true;
		}
	} catch (error) {
		console.error('Failed to load AI learning data:', error);
	}
	return false;
}

// 게임 시작 함수
export function startGame() {
	resetGame();
	gameState.set('playing');
}

// 라운드 진행 (보스 강화)
export function nextRound() {
	currentRound.update(r => r + 1);
	bossLevel.update(l => l + 1);
	// 체력 부분 회복 후 리셋 (50% 회복)
	playerHealth.update(h => Math.min(100, h + 50));
	playerStamina.set(100);
	playerState.set('idle');
	enemyHealth.set(100);
	enemyState.set('idle');
	gameState.set('playing');
}

// 플레이어 체력 회복 (승리 보상)
export function healPlayer(amount: number) {
	playerHealth.update(h => Math.min(100, h + amount));
}

// 파생 스토어 - 플레이어 생존 여부
export const isPlayerAlive = derived(playerHealth, $health => $health > 0);
export const isEnemyAlive = derived(enemyHealth, $health => $health > 0);

// DQN AI 통계 스토어
export const aiStats = writable({
	totalEpisodes: 0,
	explorationRate: 0.5,
	memorySize: 0,
	averageReward: 0,
	lastAction: '' as AIAction | '',
	isLearning: false
});

// AI 학습 모드 토글
export const aiLearningEnabled = writable(true);

// AI 학습 데이터 초기화
export async function resetAILearning() {
	await resetDQNAgent();

	aiStats.set({
		totalEpisodes: 0,
		explorationRate: 0.5,
		memorySize: 0,
		averageReward: 0,
		lastAction: '',
		isLearning: false
	});

	// 통계 기반 학습 데이터도 초기화
	aiLearningData.set({
		attackPatterns: { light_attack: 0, heavy_attack: 0 },
		dodgeDirections: { forward: 0, backward: 0, left: 0, right: 0 },
		defensiveActions: { guard: 0, parry: 0 },
		attackTimings: [],
		dodgedAttacks: { light: 0, heavy: 0 },
		movementPatterns: {
			directions: { forward: 0, backward: 0, left: 0, right: 0, idle: 0 },
			preferredDistance: { close: 0, mid: 0, far: 0 },
			approachTendency: 0,
			strafeTendency: 0
		}
	});
	playerActionHistory.set([]);
}
