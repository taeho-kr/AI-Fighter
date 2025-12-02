/**
 * Q-Learning 기반 적응형 AI 시스템
 * 디바이스 내에서 플레이어 패턴을 학습하고 최적의 대응 전략을 찾음
 */

// 상태 정의: 플레이어의 현재 상황
export type PlayerStateFeature = {
	healthRange: 'low' | 'mid' | 'high';        // 체력 구간
	staminaRange: 'low' | 'mid' | 'high';       // 스태미나 구간
	recentAction: 'attack' | 'defend' | 'dodge' | 'idle';  // 최근 행동
	distance: 'close' | 'mid' | 'far';          // 거리
	playerStyle: 'aggressive' | 'defensive' | 'balanced';  // 플레이 스타일
	parryTendency: 'high' | 'low';              // 패링 성향
	dodgeDirection: 'left' | 'right' | 'back' | 'mixed';  // 주 회피 방향
};

// AI 행동 정의
export type AIAction =
	| 'light_attack'
	| 'heavy_attack'
	| 'feint_attack'      // 페이크 공격
	| 'guard_break'       // 가드 브레이크
	| 'chase'
	| 'retreat'
	| 'wait'
	| 'predict_dodge_left'
	| 'predict_dodge_right';

// Q-Table 타입
export type QTable = Map<string, Map<AIAction, number>>;

// 학습 파라미터
export interface LearningParams {
	learningRate: number;      // 학습률 (alpha)
	discountFactor: number;    // 할인율 (gamma)
	explorationRate: number;   // 탐험률 (epsilon)
	minExplorationRate: number;
	explorationDecay: number;
}

// 보상 설정
export interface RewardConfig {
	hitPlayer: number;
	missedAttack: number;
	gotHit: number;
	gotParried: number;
	successfulPredict: number;
	playerDodged: number;
}

const DEFAULT_PARAMS: LearningParams = {
	learningRate: 0.2,           // 학습률 증가 (더 빠르게 학습)
	discountFactor: 0.9,         // 미래 보상 할인
	explorationRate: 0.25,       // 초기 탐험률
	minExplorationRate: 0.05,
	explorationDecay: 0.98       // 더 빠르게 활용 모드로 전환
};

const DEFAULT_REWARDS: RewardConfig = {
	hitPlayer: 15,               // 공격 성공 보상 증가
	missedAttack: -3,            // 공격 실패 페널티
	gotHit: -8,                  // 피격 페널티 증가
	gotParried: -15,             // 패링당함 큰 페널티
	successfulPredict: 20,       // 예측 성공 큰 보상
	playerDodged: -5             // 회피당함 페널티
};

const ALL_ACTIONS: AIAction[] = [
	'light_attack',
	'heavy_attack',
	'feint_attack',
	'guard_break',
	'chase',
	'retreat',
	'wait',
	'predict_dodge_left',
	'predict_dodge_right'
];

export class QLearningAI {
	private qTable: QTable = new Map();
	private params: LearningParams;
	private rewards: RewardConfig;
	private lastState: string | null = null;
	private lastAction: AIAction | null = null;
	private totalEpisodes: number = 0;
	private totalRewards: number = 0;

	constructor(
		params: Partial<LearningParams> = {},
		rewards: Partial<RewardConfig> = {}
	) {
		this.params = { ...DEFAULT_PARAMS, ...params };
		this.rewards = { ...DEFAULT_REWARDS, ...rewards };
	}

	/**
	 * 상태를 문자열 키로 변환
	 */
	private stateToKey(state: PlayerStateFeature): string {
		return `${state.healthRange}_${state.staminaRange}_${state.recentAction}_${state.distance}_${state.playerStyle}_${state.parryTendency}_${state.dodgeDirection}`;
	}

	/**
	 * 특정 상태의 Q-값 테이블 가져오기 (없으면 초기화)
	 */
	private getStateQValues(stateKey: string): Map<AIAction, number> {
		if (!this.qTable.has(stateKey)) {
			const actionValues = new Map<AIAction, number>();
			ALL_ACTIONS.forEach(action => actionValues.set(action, 0));
			this.qTable.set(stateKey, actionValues);
		}
		return this.qTable.get(stateKey)!;
	}

	/**
	 * 현재 상태에서 최적의 행동 선택 (epsilon-greedy)
	 */
	selectAction(state: PlayerStateFeature): AIAction {
		const stateKey = this.stateToKey(state);
		const qValues = this.getStateQValues(stateKey);

		// 탐험: 랜덤 행동
		if (Math.random() < this.params.explorationRate) {
			const randomIndex = Math.floor(Math.random() * ALL_ACTIONS.length);
			const action = ALL_ACTIONS[randomIndex];
			this.lastState = stateKey;
			this.lastAction = action;
			return action;
		}

		// 활용: 최고 Q-값 행동
		let bestAction = ALL_ACTIONS[0];
		let bestValue = qValues.get(bestAction) ?? 0;

		for (const action of ALL_ACTIONS) {
			const value = qValues.get(action) ?? 0;
			if (value > bestValue) {
				bestValue = value;
				bestAction = action;
			}
		}

		this.lastState = stateKey;
		this.lastAction = bestAction;
		return bestAction;
	}

	/**
	 * 행동 결과에 따른 학습 (Q-값 업데이트)
	 */
	learn(
		newState: PlayerStateFeature,
		reward: number
	): void {
		if (!this.lastState || !this.lastAction) return;

		const newStateKey = this.stateToKey(newState);
		const oldQValues = this.getStateQValues(this.lastState);
		const newQValues = this.getStateQValues(newStateKey);

		// 현재 Q-값
		const currentQ = oldQValues.get(this.lastAction) ?? 0;

		// 새 상태에서의 최대 Q-값
		let maxNewQ = 0;
		for (const action of ALL_ACTIONS) {
			const value = newQValues.get(action) ?? 0;
			if (value > maxNewQ) maxNewQ = value;
		}

		// Q-Learning 업데이트 공식
		// Q(s,a) = Q(s,a) + α * (r + γ * max(Q(s',a')) - Q(s,a))
		const newQ = currentQ + this.params.learningRate * (
			reward + this.params.discountFactor * maxNewQ - currentQ
		);

		oldQValues.set(this.lastAction, newQ);
		this.totalRewards += reward;
	}

	/**
	 * 보상 계산 헬퍼 함수들
	 */
	getReward(event: keyof RewardConfig): number {
		return this.rewards[event];
	}

	/**
	 * 에피소드 종료 (라운드 끝)
	 */
	endEpisode(): void {
		this.totalEpisodes++;

		// 탐험률 감소
		this.params.explorationRate = Math.max(
			this.params.minExplorationRate,
			this.params.explorationRate * this.params.explorationDecay
		);

		this.lastState = null;
		this.lastAction = null;
	}

	/**
	 * localStorage 저장
	 */
	save(): void {
		const data = {
			qTable: Array.from(this.qTable.entries()).map(([state, actions]) => [
				state,
				Array.from(actions.entries())
			]),
			params: this.params,
			totalEpisodes: this.totalEpisodes,
			totalRewards: this.totalRewards
		};
		localStorage.setItem('ai-fighter-qlearning', JSON.stringify(data));
	}

	/**
	 * localStorage에서 로드
	 */
	load(): boolean {
		const saved = localStorage.getItem('ai-fighter-qlearning');
		if (!saved) return false;

		try {
			const data = JSON.parse(saved);

			// Q-Table 복원
			this.qTable = new Map();
			for (const [state, actions] of data.qTable) {
				this.qTable.set(state, new Map(actions));
			}

			// 파라미터 복원
			this.params = { ...DEFAULT_PARAMS, ...data.params };
			this.totalEpisodes = data.totalEpisodes || 0;
			this.totalRewards = data.totalRewards || 0;

			return true;
		} catch {
			return false;
		}
	}

	/**
	 * 학습 데이터 초기화
	 */
	reset(): void {
		this.qTable = new Map();
		this.params = { ...DEFAULT_PARAMS };
		this.totalEpisodes = 0;
		this.totalRewards = 0;
		this.lastState = null;
		this.lastAction = null;
		localStorage.removeItem('ai-fighter-qlearning');
	}

	/**
	 * 디버그/통계 정보
	 */
	getStats() {
		return {
			statesLearned: this.qTable.size,
			totalEpisodes: this.totalEpisodes,
			totalRewards: this.totalRewards,
			explorationRate: this.params.explorationRate,
			averageReward: this.totalEpisodes > 0
				? this.totalRewards / this.totalEpisodes
				: 0
		};
	}

	/**
	 * 특정 상태에서의 Q-값 분포 (디버그용)
	 */
	getQValuesForState(state: PlayerStateFeature): Record<AIAction, number> {
		const stateKey = this.stateToKey(state);
		const qValues = this.getStateQValues(stateKey);
		const result: Partial<Record<AIAction, number>> = {};
		for (const action of ALL_ACTIONS) {
			result[action] = qValues.get(action) ?? 0;
		}
		return result as Record<AIAction, number>;
	}
}

/**
 * 게임 상태에서 PlayerStateFeature 추출
 */
export function extractStateFeatures(
	playerHealth: number,
	playerMaxHealth: number,
	playerStamina: number,
	playerMaxStamina: number,
	recentPlayerAction: string,
	distanceToPlayer: number,
	attackPatterns: { light_attack: number; heavy_attack: number },
	defensivePatterns: { guard: number; parry: number },
	dodgeDirections?: { forward: number; backward: number; left: number; right: number }
): PlayerStateFeature {
	// 체력 구간
	const healthPercent = playerHealth / playerMaxHealth;
	const healthRange: 'low' | 'mid' | 'high' =
		healthPercent <= 0.3 ? 'low' : healthPercent <= 0.7 ? 'mid' : 'high';

	// 스태미나 구간
	const staminaPercent = playerStamina / playerMaxStamina;
	const staminaRange: 'low' | 'mid' | 'high' =
		staminaPercent <= 0.3 ? 'low' : staminaPercent <= 0.7 ? 'mid' : 'high';

	// 최근 행동
	let recentAction: 'attack' | 'defend' | 'dodge' | 'idle' = 'idle';
	if (recentPlayerAction.includes('attack')) recentAction = 'attack';
	else if (recentPlayerAction === 'guard' || recentPlayerAction === 'parry') recentAction = 'defend';
	else if (recentPlayerAction === 'dodge') recentAction = 'dodge';

	// 거리
	const distance: 'close' | 'mid' | 'far' =
		distanceToPlayer <= 3 ? 'close' : distanceToPlayer <= 8 ? 'mid' : 'far';

	// 플레이 스타일 판별
	const totalAttacks = attackPatterns.light_attack + attackPatterns.heavy_attack;
	const totalDefense = defensivePatterns.guard + defensivePatterns.parry;
	const total = totalAttacks + totalDefense;

	let playerStyle: 'aggressive' | 'defensive' | 'balanced' = 'balanced';
	if (total > 3) {
		const attackRatio = totalAttacks / total;
		if (attackRatio > 0.6) playerStyle = 'aggressive';
		else if (attackRatio < 0.4) playerStyle = 'defensive';
	}

	// 패링 성향 판별
	const parryTendency: 'high' | 'low' =
		totalDefense > 0 && (defensivePatterns.parry / totalDefense) > 0.3 ? 'high' : 'low';

	// 회피 방향 판별
	let dodgeDirection: 'left' | 'right' | 'back' | 'mixed' = 'mixed';
	if (dodgeDirections) {
		const { forward, backward, left, right } = dodgeDirections;
		const totalDodges = forward + backward + left + right;
		if (totalDodges > 2) {
			const maxDodge = Math.max(left, right, backward);
			if (left === maxDodge && left > totalDodges * 0.4) dodgeDirection = 'left';
			else if (right === maxDodge && right > totalDodges * 0.4) dodgeDirection = 'right';
			else if (backward === maxDodge && backward > totalDodges * 0.4) dodgeDirection = 'back';
		}
	}

	return {
		healthRange,
		staminaRange,
		recentAction,
		distance,
		playerStyle,
		parryTendency,
		dodgeDirection
	};
}

// 싱글톤 인스턴스
let aiInstance: QLearningAI | null = null;

export function getQLearningAI(): QLearningAI {
	if (!aiInstance) {
		aiInstance = new QLearningAI();
		// 저장된 학습 데이터 로드 시도
		if (typeof window !== 'undefined') {
			aiInstance.load();
		}
	}
	return aiInstance;
}

export function resetQLearningAI(): void {
	if (aiInstance) {
		aiInstance.reset();
	}
	aiInstance = null;
}
