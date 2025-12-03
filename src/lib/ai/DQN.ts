/**
 * Deep Q-Network (DQN) 기반 적응형 AI 시스템
 * TensorFlow.js를 사용하여 플레이어 패턴을 학습
 */

import * as tf from '@tensorflow/tfjs';

// AI 행동 정의
export type AIAction =
	| 'light_attack'
	| 'heavy_attack'
	| 'feint_attack'
	| 'guard_break'
	| 'chase'
	| 'retreat'
	| 'wait'
	| 'predict_dodge_left'
	| 'predict_dodge_right';

export const ALL_ACTIONS: AIAction[] = [
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

// 상태 벡터 크기 (연속적인 값들)
export const STATE_SIZE = 12;
// 행동 수
export const ACTION_SIZE = ALL_ACTIONS.length;

// 하이퍼파라미터
export interface DQNConfig {
	learningRate: number;
	gamma: number;           // 할인율
	epsilon: number;         // 탐험률
	epsilonMin: number;
	epsilonDecay: number;
	batchSize: number;
	memorySize: number;
	targetUpdateFreq: number;  // 타겟 네트워크 업데이트 주기
}

const DEFAULT_CONFIG: DQNConfig = {
	learningRate: 0.001,
	gamma: 0.95,
	epsilon: 0.5,
	epsilonMin: 0.05,
	epsilonDecay: 0.995,
	batchSize: 32,
	memorySize: 2000,
	targetUpdateFreq: 100
};

// 보상 설정
export interface RewardConfig {
	hitPlayer: number;
	missedAttack: number;
	gotHit: number;
	gotParried: number;
	successfulPredict: number;
	playerDodged: number;
	wonRound: number;
	lostRound: number;
}

const DEFAULT_REWARDS: RewardConfig = {
	hitPlayer: 1.0,
	missedAttack: -0.3,
	gotHit: -0.8,
	gotParried: -1.5,
	successfulPredict: 2.0,
	playerDodged: -0.5,
	wonRound: 5.0,
	lostRound: -5.0
};

// 경험 저장 (Experience Replay)
interface Experience {
	state: number[];
	action: number;
	reward: number;
	nextState: number[];
	done: boolean;
}

/**
 * 게임 상태를 신경망 입력 벡터로 변환
 */
export function stateToVector(
	playerHealth: number,
	playerMaxHealth: number,
	playerStamina: number,
	playerMaxStamina: number,
	aiHealth: number,
	aiMaxHealth: number,
	distance: number,
	playerRecentAction: string,
	lightAttackCount: number,
	heavyAttackCount: number,
	guardCount: number,
	parryCount: number,
	dodgeLeftCount: number,
	dodgeRightCount: number,
	dodgeBackCount: number
): number[] {
	// 모든 값을 0-1 범위로 정규화
	const totalAttacks = lightAttackCount + heavyAttackCount + 1;
	const totalDefense = guardCount + parryCount + 1;
	const totalDodges = dodgeLeftCount + dodgeRightCount + dodgeBackCount + 1;

	return [
		playerHealth / playerMaxHealth,                    // 0: 플레이어 체력 비율
		playerStamina / playerMaxStamina,                  // 1: 플레이어 스태미나 비율
		aiHealth / aiMaxHealth,                            // 2: AI 체력 비율
		Math.min(distance / 15, 1),                        // 3: 거리 (정규화)
		playerRecentAction === 'attack' ? 1 : 0,           // 4: 최근 공격 여부
		playerRecentAction === 'guard' ? 1 : 0,            // 5: 최근 가드 여부
		playerRecentAction === 'dodge' ? 1 : 0,            // 6: 최근 회피 여부
		lightAttackCount / totalAttacks,                   // 7: 약공격 비율
		heavyAttackCount / totalAttacks,                   // 8: 강공격 비율
		parryCount / totalDefense,                         // 9: 패링 비율
		(dodgeLeftCount + dodgeRightCount) / totalDodges,  // 10: 측면 회피 비율
		dodgeBackCount / totalDodges                       // 11: 후방 회피 비율
	];
}

/**
 * DQN 에이전트
 */
export class DQNAgent {
	private config: DQNConfig;
	private rewards: RewardConfig;
	private model: tf.LayersModel | null = null;
	private targetModel: tf.LayersModel | null = null;
	private memory: Experience[] = [];
	private stepCount: number = 0;
	private totalEpisodes: number = 0;
	private totalRewards: number = 0;
	private isTraining: boolean = false;

	// 현재 에피소드 추적
	private lastState: number[] | null = null;
	private lastAction: number | null = null;

	constructor(
		config: Partial<DQNConfig> = {},
		rewards: Partial<RewardConfig> = {}
	) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.rewards = { ...DEFAULT_REWARDS, ...rewards };
	}

	/**
	 * 신경망 모델 생성
	 */
	private createModel(): tf.LayersModel {
		const model = tf.sequential();

		// 입력층 -> 은닉층 1
		model.add(tf.layers.dense({
			inputShape: [STATE_SIZE],
			units: 64,
			activation: 'relu',
			kernelInitializer: 'heNormal'
		}));

		// 은닉층 2
		model.add(tf.layers.dense({
			units: 64,
			activation: 'relu',
			kernelInitializer: 'heNormal'
		}));

		// 은닉층 3
		model.add(tf.layers.dense({
			units: 32,
			activation: 'relu',
			kernelInitializer: 'heNormal'
		}));

		// 출력층 (각 행동의 Q값)
		model.add(tf.layers.dense({
			units: ACTION_SIZE,
			activation: 'linear'
		}));

		model.compile({
			optimizer: tf.train.adam(this.config.learningRate),
			loss: 'meanSquaredError'
		});

		return model;
	}

	/**
	 * 모델 초기화
	 */
	async initialize(): Promise<void> {
		// 저장된 모델 로드 시도
		const loaded = await this.load();
		if (!loaded) {
			this.model = this.createModel();
			this.targetModel = this.createModel();
			await this.updateTargetModel();
		}
	}

	/**
	 * 타겟 네트워크 업데이트
	 */
	private async updateTargetModel(): Promise<void> {
		if (!this.model || !this.targetModel) return;

		const weights = this.model.getWeights();
		this.targetModel.setWeights(weights);
	}

	/**
	 * 행동 선택 (epsilon-greedy)
	 */
	selectAction(state: number[]): AIAction {
		this.lastState = state;

		// 탐험: 랜덤 행동
		if (Math.random() < this.config.epsilon) {
			const randomIndex = Math.floor(Math.random() * ACTION_SIZE);
			this.lastAction = randomIndex;
			return ALL_ACTIONS[randomIndex];
		}

		// 활용: 신경망으로 최적 행동 선택
		if (!this.model) {
			const randomIndex = Math.floor(Math.random() * ACTION_SIZE);
			this.lastAction = randomIndex;
			return ALL_ACTIONS[randomIndex];
		}

		const stateTensor = tf.tensor2d([state]);
		const qValues = this.model.predict(stateTensor) as tf.Tensor;
		const actionIndex = qValues.argMax(1).dataSync()[0];

		stateTensor.dispose();
		qValues.dispose();

		this.lastAction = actionIndex;
		return ALL_ACTIONS[actionIndex];
	}

	/**
	 * 경험 저장
	 */
	remember(
		state: number[],
		action: number,
		reward: number,
		nextState: number[],
		done: boolean
	): void {
		this.memory.push({ state, action, reward, nextState, done });

		// 메모리 크기 제한
		if (this.memory.length > this.config.memorySize) {
			this.memory.shift();
		}

		this.totalRewards += reward;
	}

	/**
	 * 보상 기록 및 학습
	 */
	async recordReward(reward: number, nextState: number[], done: boolean = false): Promise<void> {
		if (this.lastState === null || this.lastAction === null) return;

		this.remember(this.lastState, this.lastAction, reward, nextState, done);
		this.stepCount++;

		// 배치 학습
		if (this.memory.length >= this.config.batchSize && !this.isTraining) {
			await this.train();
		}

		// 타겟 네트워크 업데이트
		if (this.stepCount % this.config.targetUpdateFreq === 0) {
			await this.updateTargetModel();
		}
	}

	/**
	 * 신경망 학습 (Experience Replay)
	 */
	private async train(): Promise<void> {
		if (!this.model || !this.targetModel || this.memory.length < this.config.batchSize) return;

		this.isTraining = true;

		try {
			// 랜덤 배치 샘플링
			const batch: Experience[] = [];
			const indices = new Set<number>();
			while (indices.size < this.config.batchSize) {
				indices.add(Math.floor(Math.random() * this.memory.length));
			}
			indices.forEach(i => batch.push(this.memory[i]));

			// 배치 데이터 준비
			const states = batch.map(exp => exp.state);
			const nextStates = batch.map(exp => exp.nextState);

			const statesTensor = tf.tensor2d(states);
			const nextStatesTensor = tf.tensor2d(nextStates);

			// 현재 Q값 예측
			const currentQs = this.model.predict(statesTensor) as tf.Tensor;
			const currentQsArray = await currentQs.array() as number[][];

			// 다음 상태의 Q값 예측 (타겟 네트워크 사용)
			const nextQs = this.targetModel.predict(nextStatesTensor) as tf.Tensor;
			const nextQsArray = await nextQs.array() as number[][];

			// 타겟 Q값 계산
			const targetQs: number[][] = [];
			for (let i = 0; i < batch.length; i++) {
				const exp = batch[i];
				const target = [...currentQsArray[i]];

				if (exp.done) {
					target[exp.action] = exp.reward;
				} else {
					const maxNextQ = Math.max(...nextQsArray[i]);
					target[exp.action] = exp.reward + this.config.gamma * maxNextQ;
				}
				targetQs.push(target);
			}

			// 학습
			const targetTensor = tf.tensor2d(targetQs);
			await this.model.fit(statesTensor, targetTensor, {
				epochs: 1,
				verbose: 0
			});

			// 메모리 해제
			statesTensor.dispose();
			nextStatesTensor.dispose();
			currentQs.dispose();
			nextQs.dispose();
			targetTensor.dispose();

		} catch (error) {
			console.error('DQN training error:', error);
		}

		this.isTraining = false;
	}

	/**
	 * 에피소드 종료
	 */
	endEpisode(): void {
		this.totalEpisodes++;

		// 탐험률 감소
		this.config.epsilon = Math.max(
			this.config.epsilonMin,
			this.config.epsilon * this.config.epsilonDecay
		);

		this.lastState = null;
		this.lastAction = null;
	}

	/**
	 * 보상 값 가져오기
	 */
	getReward(event: keyof RewardConfig): number {
		return this.rewards[event];
	}

	/**
	 * 모델 저장 (IndexedDB)
	 */
	async save(): Promise<void> {
		if (!this.model) return;

		try {
			await this.model.save('indexeddb://ai-fighter-dqn');

			// 메타데이터 저장
			const metadata = {
				epsilon: this.config.epsilon,
				totalEpisodes: this.totalEpisodes,
				totalRewards: this.totalRewards,
				stepCount: this.stepCount,
				memoryLength: this.memory.length
			};
			localStorage.setItem('ai-fighter-dqn-meta', JSON.stringify(metadata));

			// 최근 경험 일부 저장 (빠른 재학습용)
			const recentMemory = this.memory.slice(-500);
			localStorage.setItem('ai-fighter-dqn-memory', JSON.stringify(recentMemory));

		} catch (error) {
			console.error('Failed to save DQN model:', error);
		}
	}

	/**
	 * 모델 로드
	 */
	async load(): Promise<boolean> {
		try {
			this.model = await tf.loadLayersModel('indexeddb://ai-fighter-dqn');
			this.targetModel = await tf.loadLayersModel('indexeddb://ai-fighter-dqn');

			// 로드 후 컴파일 (학습을 위해 필요)
			this.model.compile({
				optimizer: tf.train.adam(this.config.learningRate),
				loss: 'meanSquaredError'
			});
			this.targetModel.compile({
				optimizer: tf.train.adam(this.config.learningRate),
				loss: 'meanSquaredError'
			});

			// 메타데이터 로드
			const metaStr = localStorage.getItem('ai-fighter-dqn-meta');
			if (metaStr) {
				const metadata = JSON.parse(metaStr);
				this.config.epsilon = metadata.epsilon || DEFAULT_CONFIG.epsilon;
				this.totalEpisodes = metadata.totalEpisodes || 0;
				this.totalRewards = metadata.totalRewards || 0;
				this.stepCount = metadata.stepCount || 0;
			}

			// 경험 메모리 로드
			const memoryStr = localStorage.getItem('ai-fighter-dqn-memory');
			if (memoryStr) {
				this.memory = JSON.parse(memoryStr);
			}

			console.log('DQN model loaded successfully');
			return true;

		} catch (error) {
			console.log('No saved DQN model found, creating new one');
			return false;
		}
	}

	/**
	 * 학습 초기화
	 */
	async reset(): Promise<void> {
		// 기존 모델 정리
		if (this.model) this.model.dispose();
		if (this.targetModel) this.targetModel.dispose();

		// 새 모델 생성
		this.model = this.createModel();
		this.targetModel = this.createModel();
		await this.updateTargetModel();

		// 상태 초기화
		this.memory = [];
		this.stepCount = 0;
		this.totalEpisodes = 0;
		this.totalRewards = 0;
		this.config.epsilon = DEFAULT_CONFIG.epsilon;
		this.lastState = null;
		this.lastAction = null;

		// 저장된 데이터 삭제
		try {
			await tf.io.removeModel('indexeddb://ai-fighter-dqn');
		} catch (e) {
			// 모델이 없을 수 있음
		}
		localStorage.removeItem('ai-fighter-dqn-meta');
		localStorage.removeItem('ai-fighter-dqn-memory');
	}

	/**
	 * 통계 정보
	 */
	getStats() {
		return {
			totalEpisodes: this.totalEpisodes,
			explorationRate: this.config.epsilon,
			memorySize: this.memory.length,
			stepCount: this.stepCount,
			averageReward: this.totalEpisodes > 0 ? this.totalRewards / this.totalEpisodes : 0,
			isModelReady: this.model !== null
		};
	}

	/**
	 * 현재 상태의 Q값 분포 (디버그용)
	 */
	getQValues(state: number[]): Record<AIAction, number> | null {
		if (!this.model) return null;

		const stateTensor = tf.tensor2d([state]);
		const qValues = this.model.predict(stateTensor) as tf.Tensor;
		const values = qValues.dataSync();

		stateTensor.dispose();
		qValues.dispose();

		const result: Partial<Record<AIAction, number>> = {};
		ALL_ACTIONS.forEach((action, i) => {
			result[action] = values[i];
		});

		return result as Record<AIAction, number>;
	}
}

// 싱글톤 인스턴스
let dqnInstance: DQNAgent | null = null;
let initPromise: Promise<void> | null = null;

export async function getDQNAgent(): Promise<DQNAgent> {
	if (!dqnInstance) {
		dqnInstance = new DQNAgent();
		initPromise = dqnInstance.initialize();
	}
	if (initPromise) {
		await initPromise;
		initPromise = null;
	}
	return dqnInstance;
}

export async function resetDQNAgent(): Promise<void> {
	if (dqnInstance) {
		await dqnInstance.reset();
	}
}
