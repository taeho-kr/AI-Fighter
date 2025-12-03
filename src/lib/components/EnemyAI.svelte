<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { RigidBody, Collider } from '@threlte/rapier';
	import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
	import * as THREE from 'three';
	import {
		enemyHealth, enemyMaxHealth, enemyState, aiLearningData, bossLevel, gameState,
		playerHealth, playerMaxHealth, playerStamina, playerMaxStamina,
		aiStats, aiLearningEnabled
	} from '$lib/stores/gameStore';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import {
		getDQNAgent, stateToVector,
		type AIAction, type DQNAgent
	} from '$lib/ai/DQN';
	import HumanoidModel from './HumanoidModel.svelte';
	import CharacterModel from './CharacterModel.svelte';

	// 3D 모델 사용 여부 (true = GLB 모델, false = 프로시저럴 모델)
	const USE_3D_MODEL = true;

	// Props
	let {
		playerPosition = new THREE.Vector3(),
		playerState = 'idle' as string,
		onAttackPlayer = (damage: number, type: 'light' | 'heavy') => {}
	} = $props();

	let rigidBody: RapierRigidBody;

	// AI 상태
	type AIState = 'idle' | 'chasing' | 'attacking' | 'stunned' | 'predicting' | 'retreating';
	let currentState = $state<AIState>('idle');
	let attackType = $state<'light' | 'heavy' | null>(null);
	let isStunned = $state(false);
	let stunTimer = $state(0);

	// AI 타이머 및 쿨다운
	let attackCooldown = $state(0);
	let decisionTimer = $state(0);
	let lastAttackTime = $state(0);

	// 학습 기반 예측
	let predictedDodgeDirection = $state<'forward' | 'backward' | 'left' | 'right' | null>(null);
	let predictedPlayerAction = $state<'attack' | 'guard' | 'parry' | 'dodge' | null>(null);

	// DQN AI
	let dqnAgent: DQNAgent | null = $state(null);
	let currentDQNAction = $state<AIAction | null>(null);
	let lastRecentAction = $state<string>('idle');
	let pendingReward = $state<number>(0);
	let lastDistance = $state<number>(10);

	// 휴머노이드 모델용 상태
	let animationTime = $state(0);
	let walkCycle = $state(0);
	let currentAnimState = $state<'idle' | 'walk' | 'run' | 'attack_light' | 'attack_heavy' | 'guard' | 'dodge' | 'stunned' | 'charging'>('idle');
	let attackAnimProgress = $state(0);
	let attackAnimStartTime = $state(0);

	// DQN 초기화
	onMount(async () => {
		dqnAgent = await getDQNAgent();
		updateAIStats();
	});

	const ARENA_RADIUS = 9.5; // 아레나 반경 (벽 안쪽)

	// AI 스탯 (레벨에 따라 증가)
	const baseStats = {
		speed: 3,
		attackRange: 2.5,
		lightDamage: 10,
		heavyDamage: 25,
		aggressiveness: 0.5, // 0-1, 공격 빈도
		predictionAccuracy: 0.3 // 0-1, 예측 정확도
	};

	// 현재 스탯 (AI 레벨 반영)
	let currentStats = $derived({
		speed: baseStats.speed + (get(bossLevel) - 1) * 0.5,
		attackRange: baseStats.attackRange,
		lightDamage: baseStats.lightDamage + (get(bossLevel) - 1) * 5,
		heavyDamage: baseStats.heavyDamage + (get(bossLevel) - 1) * 10,
		aggressiveness: Math.min(0.9, baseStats.aggressiveness + (get(bossLevel) - 1) * 0.1),
		predictionAccuracy: Math.min(0.9, baseStats.predictionAccuracy + (get(bossLevel) - 1) * 0.15)
	});

	// AI 통계 업데이트
	function updateAIStats() {
		if (!dqnAgent) return;
		const stats = dqnAgent.getStats();
		aiStats.update(s => ({
			...s,
			totalEpisodes: stats.totalEpisodes,
			explorationRate: stats.explorationRate,
			memorySize: stats.memorySize,
			averageReward: stats.averageReward,
			lastAction: currentDQNAction || '',
			isLearning: stats.isModelReady
		}));
	}

	// 학습 데이터 분석 (예측용)
	function analyzeLearningData() {
		const data = get(aiLearningData);

		// 가장 많이 사용하는 회피 방향 예측
		const dodgeDirs = data.dodgeDirections;
		const maxDodge = Math.max(dodgeDirs.forward, dodgeDirs.backward, dodgeDirs.left, dodgeDirs.right);
		if (maxDodge > 0) {
			if (dodgeDirs.left === maxDodge) predictedDodgeDirection = 'left';
			else if (dodgeDirs.right === maxDodge) predictedDodgeDirection = 'right';
			else if (dodgeDirs.forward === maxDodge) predictedDodgeDirection = 'forward';
			else predictedDodgeDirection = 'backward';
		}

		// 플레이어 행동 패턴 분석
		const totalAttacks = data.attackPatterns.light_attack + data.attackPatterns.heavy_attack;
		const totalDefense = data.defensiveActions.guard + data.defensiveActions.parry;

		if (totalAttacks > totalDefense * 2) {
			predictedPlayerAction = 'attack';
		} else if (totalDefense > totalAttacks) {
			predictedPlayerAction = Math.random() > 0.5 ? 'guard' : 'parry';
		} else {
			predictedPlayerAction = 'dodge';
		}
	}

	// DQN 상태 벡터 생성
	function getCurrentStateVector(distance: number): number[] {
		const data = get(aiLearningData);
		return stateToVector(
			get(playerHealth),
			get(playerMaxHealth),
			get(playerStamina),
			get(playerMaxStamina),
			get(enemyHealth),
			get(enemyMaxHealth),
			distance,
			lastRecentAction,
			data.attackPatterns.light_attack,
			data.attackPatterns.heavy_attack,
			data.defensiveActions.guard,
			data.defensiveActions.parry,
			data.dodgeDirections.left,
			data.dodgeDirections.right,
			data.dodgeDirections.backward
		);
	}

	// DQN 기반 행동 선택
	function selectDQNAction(distance: number): AIAction {
		if (!dqnAgent || !get(aiLearningEnabled)) {
			// DQN 비활성화 시 기본 행동
			return distance <= currentStats.attackRange ? 'light_attack' : 'chase';
		}

		const state = getCurrentStateVector(distance);
		const action = dqnAgent.selectAction(state);
		currentDQNAction = action;

		updateAIStats();
		return action;
	}

	// DQN 보상 기록 및 학습
	async function recordRewardAndLearn(reward: number, distance: number, done: boolean = false) {
		if (!dqnAgent || !get(aiLearningEnabled)) return;

		const nextState = getCurrentStateVector(distance);
		await dqnAgent.recordReward(reward, nextState, done);
		updateAIStats();
	}

	// AI 행동을 실제 게임 액션으로 변환
	function executeDQNAction(action: AIAction, distance: number) {
		currentDQNAction = action;

		// 플레이어 패턴 데이터
		const data = get(aiLearningData);
		const totalDefense = data.defensiveActions.guard + data.defensiveActions.parry;
		const parryRatio = totalDefense > 0 ? data.defensiveActions.parry / totalDefense : 0;
		const isParryPlayer = parryRatio > 0.3;

		switch (action) {
			case 'light_attack':
				if (distance <= currentStats.attackRange && attackCooldown <= 0) {
					performAttack('light');
				} else {
					currentState = 'chasing';
				}
				break;

			case 'heavy_attack':
				if (distance <= currentStats.attackRange && attackCooldown <= 0) {
					performAttack('heavy');
				} else {
					currentState = 'chasing';
				}
				break;

			case 'feint_attack':
				if (distance <= currentStats.attackRange && attackCooldown <= 0) {
					// 페인트: 패링 플레이어에게 효과적
					// 짧은 대기 후 공격 (패링 윈도우 지나간 후)
					currentState = 'predicting';
					const feintDelay = isParryPlayer ? 500 : 350;  // 패링 플레이어에겐 더 긴 딜레이
					setTimeout(() => {
						if (attackCooldown <= 0) performAttack('light');
					}, feintDelay);
				}
				break;

			case 'guard_break':
				if (distance <= currentStats.attackRange && attackCooldown <= 0) {
					// 가드 브레이크: 강공격 + 추가 스턴
					performAttack('heavy');
				}
				break;

			case 'chase':
				currentState = 'chasing';
				enemyState.set('chasing');
				break;

			case 'retreat':
				currentState = 'retreating';
				break;

			case 'wait':
				// 대기: 패링 플레이어의 타이밍을 흐트러뜨림
				currentState = 'idle';
				enemyState.set('idle');
				break;

			case 'predict_dodge_left':
			case 'predict_dodge_right':
				if (distance <= currentStats.attackRange + 1 && attackCooldown <= 0) {
					// 예측 방향으로 이동 후 공격
					predictedDodgeDirection = action === 'predict_dodge_left' ? 'left' : 'right';
					performAttack('light');
				}
				break;
		}
	}

	// AI 의사결정
	function makeDecision(distance: number, delta: number) {
		if (isStunned) {
			stunTimer -= delta;
			if (stunTimer <= 0) {
				isStunned = false;
				currentState = 'idle';
				enemyState.set('idle');
			}
			return;
		}

		decisionTimer -= delta;
		attackCooldown = Math.max(0, attackCooldown - delta);

		if (decisionTimer > 0) return;
		decisionTimer = 0.3; // 0.3초마다 의사결정

		// 학습 데이터 분석 (예측용)
		analyzeLearningData();

		// 보류된 보상이 있으면 학습 수행
		if (pendingReward !== 0) {
			recordRewardAndLearn(pendingReward, distance);
			pendingReward = 0;
		}

		const useDQN = get(aiLearningEnabled) && dqnAgent !== null;

		if (useDQN) {
			// DQN 기반 의사결정
			const action = selectDQNAction(distance);
			executeDQNAction(action, distance);
		} else {
			// 기존 통계 기반 의사결정 (폴백)
			legacyDecision(distance);
		}

		lastDistance = distance;
	}

	// 기존 통계 기반 의사결정 (폴백용)
	function legacyDecision(distance: number) {
		// 공격 범위 내
		if (distance <= currentStats.attackRange) {
			if (attackCooldown <= 0) {
				// 예측 기반 공격 선택
				const shouldUseHeavy = Math.random() < currentStats.aggressiveness;

				// 플레이어가 가드를 자주 한다면 강공격 선호
				if (predictedPlayerAction === 'guard' && Math.random() < currentStats.predictionAccuracy) {
					performAttack('heavy');
				}
				// 플레이어가 패링을 자주 한다면 페인트 후 공격
				else if (predictedPlayerAction === 'parry' && Math.random() < currentStats.predictionAccuracy) {
					setTimeout(() => performAttack('light'), 300);
					currentState = 'predicting';
				}
				else if (shouldUseHeavy) {
					performAttack('heavy');
				} else {
					performAttack('light');
				}
			} else {
				if (Math.random() < 0.3) {
					currentState = 'retreating';
				}
			}
		}
		// 추격
		else if (distance <= 15) {
			currentState = 'chasing';
			enemyState.set('chasing');
		}
		// 대기
		else {
			currentState = 'idle';
			enemyState.set('idle');
		}
	}

	// 공격 수행
	function performAttack(type: 'light' | 'heavy') {
		currentState = 'attacking';
		attackType = type;
		enemyState.set('attacking');

		// 애니메이션 시작
		attackAnimStartTime = Date.now();
		attackAnimProgress = 0;

		const windupTime = type === 'light' ? 200 : 500;
		const attackDuration = type === 'light' ? 300 : 600;
		const cooldown = type === 'light' ? 0.8 : 1.5;

		attackCooldown = cooldown;

		// 예측된 회피 방향으로 공격 방향 조정
		let attackDirection = new THREE.Vector3();
		if (predictedDodgeDirection && Math.random() < currentStats.predictionAccuracy) {
			// 플레이어가 회피할 것으로 예측되는 방향으로 공격
			switch (predictedDodgeDirection) {
				case 'left': attackDirection.set(1, 0, 0); break;
				case 'right': attackDirection.set(-1, 0, 0); break;
				case 'forward': attackDirection.set(0, 0, 1); break;
				case 'backward': attackDirection.set(0, 0, -1); break;
			}
		}

		// 공격 히트 타이밍
		setTimeout(() => {
			if (!rigidBody) return;

			const pos = rigidBody.translation();
			const enemyPos = new THREE.Vector3(pos.x, pos.y, pos.z);
			const toPlayer = playerPosition.clone().sub(enemyPos);
			const dist = toPlayer.length();

			// 실제 공격 범위 체크
			if (dist <= currentStats.attackRange + 0.5) {
				const damage = type === 'light' ? currentStats.lightDamage : currentStats.heavyDamage;
				onAttackPlayer(damage, type);
			}

			attackType = null;
			currentState = 'idle';
			enemyState.set('idle');
		}, windupTime + attackDuration);
	}

	// 스턴 처리 (패링 성공 시 호출)
	export function applyStun(duration: number) {
		isStunned = true;
		stunTimer = duration;
		currentState = 'stunned';
		enemyState.set('stunned');
		attackType = null;

		// DQN: 패링당함 = 큰 페널티
		if (dqnAgent) {
			pendingReward += dqnAgent.getReward('gotParried');
		}
	}

	// 데미지 처리
	export function takeDamage(amount: number) {
		enemyHealth.update(h => Math.max(0, h - amount));

		// DQN: 데미지 받음 = 페널티
		if (dqnAgent) {
			pendingReward += dqnAgent.getReward('gotHit');
		}
	}

	// 공격 성공 알림 (외부에서 호출)
	export function notifyHitPlayer() {
		if (dqnAgent) {
			pendingReward += dqnAgent.getReward('hitPlayer');
		}
	}

	// 공격 실패 알림 (플레이어가 회피)
	export function notifyPlayerDodged() {
		if (dqnAgent) {
			pendingReward += dqnAgent.getReward('playerDodged');
		}
	}

	// 공격 빗나감 알림
	export function notifyMissedAttack() {
		if (dqnAgent) {
			pendingReward += dqnAgent.getReward('missedAttack');
		}
	}

	// 라운드 종료 처리 (승/패)
	export async function endRound(won: boolean) {
		if (dqnAgent) {
			const reward = won ? dqnAgent.getReward('wonRound') : dqnAgent.getReward('lostRound');
			await recordRewardAndLearn(reward, lastDistance, true);
			dqnAgent.endEpisode();
			await dqnAgent.save();
			updateAIStats();
		}
	}

	// 플레이어 행동 업데이트 (학습용)
	export function updatePlayerAction(action: string) {
		lastRecentAction = action;
	}

	export function getPosition(): THREE.Vector3 | null {
		if (!rigidBody) return null;
		const pos = rigidBody.translation();
		return new THREE.Vector3(pos.x, pos.y, pos.z);
	}

	export function isAttacking(): { attacking: boolean; type: 'light' | 'heavy' | null } {
		return { attacking: currentState === 'attacking', type: attackType };
	}

	// 위치 초기화 (새 라운드 시작 시)
	export function resetPosition() {
		if (!rigidBody) return;
		rigidBody.setTranslation({ x: 0, y: 2, z: -5 }, true);
		rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);

		// 상태 초기화
		currentState = 'idle';
		attackType = null;
		isStunned = false;
		stunTimer = 0;
		attackCooldown = 0;
		decisionTimer = 0;
	}

	useTask((delta) => {
		if (!rigidBody || get(gameState) !== 'playing') return;

		// 애니메이션 시간 업데이트
		animationTime += delta;

		const pos = rigidBody.translation();
		const enemyPos = new THREE.Vector3(pos.x, pos.y, pos.z);
		const toPlayer = playerPosition.clone().sub(enemyPos);
		const distance = toPlayer.length();

		// 의사결정
		makeDecision(distance, delta);

		// 휴머노이드 애니메이션 상태 업데이트
		if (isStunned) {
			currentAnimState = 'stunned';
		} else if (currentState === 'attacking') {
			currentAnimState = attackType === 'heavy' ? 'attack_heavy' : 'attack_light';
			// 공격 애니메이션 진행도 업데이트
			if (attackAnimStartTime > 0) {
				const duration = attackType === 'light' ? 500 : 1100;
				attackAnimProgress = Math.min(1, (Date.now() - attackAnimStartTime) / duration);
			}
		} else if (currentState === 'chasing') {
			currentAnimState = 'run';
			walkCycle += delta * 10; // 빠른 걷기
		} else if (currentState === 'retreating') {
			currentAnimState = 'walk';
			walkCycle += delta * 6;
		} else {
			currentAnimState = 'idle';
			attackAnimProgress = 0;
		}

		// 이동
		const velocity = rigidBody.linvel();
		let moveX = 0;
		let moveZ = 0;

		if (currentState === 'chasing' && !isStunned) {
			toPlayer.normalize();
			moveX = toPlayer.x * currentStats.speed;
			moveZ = toPlayer.z * currentStats.speed;
		} else if (currentState === 'retreating' && !isStunned) {
			toPlayer.normalize();
			moveX = -toPlayer.x * currentStats.speed * 0.5;
			moveZ = -toPlayer.z * currentStats.speed * 0.5;
		}

		// 아레나 경계 체크 - 속도 설정 전에 위치 확인
		const nextX = pos.x + moveX * 0.016; // 약 1프레임 후 위치 예측
		const nextZ = pos.z + moveZ * 0.016;
		const nextDistFromCenter = Math.sqrt(nextX * nextX + nextZ * nextZ);

		// 경계를 벗어나려 하면 속도 조정
		if (nextDistFromCenter > ARENA_RADIUS) {
			// 중심 방향 벡터
			const toCenter = { x: -pos.x, z: -pos.z };
			const toCenterLen = Math.sqrt(toCenter.x * toCenter.x + toCenter.z * toCenter.z);
			if (toCenterLen > 0) {
				toCenter.x /= toCenterLen;
				toCenter.z /= toCenterLen;
			}

			// 현재 속도와 중심 방향의 내적
			const dot = moveX * toCenter.x + moveZ * toCenter.z;

			// 바깥으로 나가려는 경우에만 제한
			if (dot < 0) {
				// 바깥 방향 성분 제거
				moveX = moveX - (-toCenter.x) * (-dot);
				moveZ = moveZ - (-toCenter.z) * (-dot);

				// 이미 경계를 벗어났으면 중심으로 밀어냄
				const currentDist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
				if (currentDist > ARENA_RADIUS) {
					const pushBack = 3;
					moveX += toCenter.x * pushBack;
					moveZ += toCenter.z * pushBack;
				}
			}
		}

		rigidBody.setLinvel({ x: moveX, y: velocity.y, z: moveZ }, true);

		// 플레이어 방향으로 회전
		if (distance > 0.5) {
			const angle = Math.atan2(toPlayer.x, toPlayer.z);
			// 회전은 메쉬에서 처리
		}

		// 낙하 리셋
		if (pos.y < -10) {
			rigidBody.setTranslation({ x: 0, y: 2, z: -5 }, true);
			rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
		}
	});

	// 플레이어를 향한 각도 계산
	let lookAngle = $derived.by(() => {
		if (!rigidBody) return 0;
		const pos = rigidBody.translation();
		const dx = playerPosition.x - pos.x;
		const dz = playerPosition.z - pos.z;
		return Math.atan2(dx, dz);
	});
</script>

<RigidBody bind:rigidBody position={[0, 2, -5]} linearDamping={5} angularDamping={5} lockRotations enabledRotations={[false, false, false]}>
	<Collider shape="capsule" args={[0.5, 0.4]} mass={1} friction={1} restitution={0} />

	<T.Group rotation.y={lookAngle}>
		<!-- 캐릭터 모델 -->
		{#if USE_3D_MODEL}
			<!-- RigidBody 로컬 좌표에서 캡슐 콜라이더 바닥은 y = -0.9 -->
			<CharacterModel
				modelPath="/models/barbarian.glb"
				scale={1}
				position={[0, -0.9, 0]}
				animationState={currentAnimState}
				isHit={false}
				isCharging={false}
				chargeIntensity={0}
				tint={isStunned ? '#888888' : currentState === 'attacking' ? '#ff4444' : null}
			/>
		{:else}
			<HumanoidModel
				color={isStunned ? '#888888' : currentState === 'attacking' ? '#ff4444' : '#e94560'}
				accentColor={isStunned ? '#666666' : '#b83050'}
				height={1.8}
				animationState={currentAnimState}
				animationProgress={attackAnimProgress}
				walkCycle={walkCycle}
				hasWeapon={true}
				hasShield={true}
				weaponType="sword"
				isHit={false}
				isStunned={isStunned}
				time={animationTime}
			/>
		{/if}

		<!-- 공격 시 이펙트 -->
		{#if currentState === 'attacking'}
			<T.PointLight position={[0.5, 1, 0.5]} intensity={8} color="#ff4400" distance={2.5} />
		{/if}

		<!-- 레벨 표시 (레벨 2 이상일 때 오라) -->
		{#if get(bossLevel) > 1}
			<T.PointLight position={[0, 2, 0]} intensity={get(bossLevel) * 3} color="#e94560" distance={4} />
			<T.Mesh position={[0, 0.9, 0]}>
				<T.SphereGeometry args={[0.7 + get(bossLevel) * 0.05, 16, 16]} />
				<T.MeshBasicMaterial
					color="#e94560"
					transparent
					opacity={0.08}
				/>
			</T.Mesh>
		{/if}

		<!-- 스턴 이펙트 (강화된 표현) -->
		{#if isStunned}
			{@const pulseIntensity = 0.5 + Math.sin(animationTime * 10) * 0.3}

			<!-- 전신 스턴 오라 (바닥에서 위로) -->
			<T.Mesh position={[0, 1, 0]}>
				<T.CylinderGeometry args={[0.8, 0.8, 2, 16, 1, true]} />
				<T.MeshBasicMaterial
					color="#ffff00"
					transparent
					opacity={0.15 + pulseIntensity * 0.1}
					side={2}
				/>
			</T.Mesh>

			<!-- 번쩍이는 외곽선 -->
			<T.Mesh position={[0, 1, 0]}>
				<T.CylinderGeometry args={[1, 1, 2.2, 16, 1, true]} />
				<T.MeshBasicMaterial
					color="#ffffff"
					transparent
					opacity={pulseIntensity * 0.3}
					side={2}
				/>
			</T.Mesh>

			<!-- 머리 위 스턴 표시 -->
			<T.Group position={[0, 2.5, 0]}>
				<!-- 큰 회전하는 별들 -->
				{#each [0, 1, 2, 3, 4, 5, 6, 7] as i}
					<T.Group rotation.y={animationTime * 4 + i * Math.PI / 4}>
						<T.Mesh position={[0.5, Math.sin(animationTime * 5 + i) * 0.15, 0]}>
							<T.OctahedronGeometry args={[0.12]} />
							<T.MeshBasicMaterial color={i % 2 === 0 ? '#ffff00' : '#ff8800'} />
						</T.Mesh>
					</T.Group>
				{/each}

				<!-- 중앙 스턴 아이콘 (소용돌이) -->
				<T.Mesh rotation.x={Math.PI / 2} rotation.z={animationTime * 8}>
					<T.TorusGeometry args={[0.25, 0.05, 8, 32]} />
					<T.MeshBasicMaterial color="#ffff00" />
				</T.Mesh>
				<T.Mesh rotation.x={Math.PI / 2} rotation.z={-animationTime * 6}>
					<T.TorusGeometry args={[0.4, 0.04, 8, 32]} />
					<T.MeshBasicMaterial color="#ffaa00" transparent opacity={0.8} />
				</T.Mesh>
				<T.Mesh rotation.x={Math.PI / 2} rotation.z={animationTime * 4}>
					<T.TorusGeometry args={[0.55, 0.03, 8, 32]} />
					<T.MeshBasicMaterial color="#ff8800" transparent opacity={0.5} />
				</T.Mesh>
			</T.Group>

			<!-- 바닥 충격파 링 -->
			<T.Mesh position={[0, 0.05, 0]} rotation.x={-Math.PI / 2}>
				<T.RingGeometry args={[0.8 + pulseIntensity * 0.5, 1 + pulseIntensity * 0.5, 32]} />
				<T.MeshBasicMaterial color="#ffff00" transparent opacity={0.4} side={2} />
			</T.Mesh>
			<T.Mesh position={[0, 0.05, 0]} rotation.x={-Math.PI / 2}>
				<T.RingGeometry args={[1.2 + pulseIntensity * 0.3, 1.4 + pulseIntensity * 0.3, 32]} />
				<T.MeshBasicMaterial color="#ffaa00" transparent opacity={0.25} side={2} />
			</T.Mesh>

			<!-- 전기 스파크 이펙트 -->
			{#each [0, 1, 2, 3] as i}
				{@const sparkAngle = animationTime * 12 + i * Math.PI / 2}
				{@const sparkHeight = 0.5 + Math.sin(animationTime * 8 + i * 2) * 0.8}
				<T.Mesh position={[Math.cos(sparkAngle) * 0.4, sparkHeight, Math.sin(sparkAngle) * 0.4]}>
					<T.SphereGeometry args={[0.08, 6, 6]} />
					<T.MeshBasicMaterial color="#ffffff" />
				</T.Mesh>
				<!-- 스파크에서 뻗어나가는 선 -->
				<T.Mesh
					position={[Math.cos(sparkAngle) * 0.6, sparkHeight + 0.1, Math.sin(sparkAngle) * 0.6]}
					rotation.z={sparkAngle}
				>
					<T.BoxGeometry args={[0.3, 0.02, 0.02]} />
					<T.MeshBasicMaterial color="#ffff88" />
				</T.Mesh>
			{/each}

			<!-- 강한 스턴 조명 -->
			<T.PointLight
				position={[0, 1.5, 0]}
				intensity={15 + pulseIntensity * 10}
				color="#ffff00"
				distance={5}
			/>
			<T.PointLight
				position={[0, 2.5, 0]}
				intensity={8}
				color="#ffffff"
				distance={3}
			/>
		{/if}
	</T.Group>
</RigidBody>
