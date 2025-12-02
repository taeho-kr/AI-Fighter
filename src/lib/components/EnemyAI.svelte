<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { RigidBody, Collider } from '@threlte/rapier';
	import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
	import * as THREE from 'three';
	import {
		enemyHealth, enemyState, aiLearningData, bossLevel, gameState
	} from '$lib/stores/gameStore';
	import { get } from 'svelte/store';

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

	// 보스 스탯 (레벨에 따라 증가)
	const baseStats = {
		speed: 3,
		attackRange: 2.5,
		lightDamage: 15,
		heavyDamage: 30,
		aggressiveness: 0.5, // 0-1, 공격 빈도
		predictionAccuracy: 0.3 // 0-1, 예측 정확도
	};

	// 현재 스탯 (보스 레벨 반영)
	let currentStats = $derived({
		speed: baseStats.speed + (get(bossLevel) - 1) * 0.5,
		attackRange: baseStats.attackRange,
		lightDamage: baseStats.lightDamage + (get(bossLevel) - 1) * 5,
		heavyDamage: baseStats.heavyDamage + (get(bossLevel) - 1) * 10,
		aggressiveness: Math.min(0.9, baseStats.aggressiveness + (get(bossLevel) - 1) * 0.1),
		predictionAccuracy: Math.min(0.9, baseStats.predictionAccuracy + (get(bossLevel) - 1) * 0.15)
	});

	// 학습 데이터 분석
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

		// 학습 데이터 분석
		analyzeLearningData();

		const level = get(bossLevel);

		// 공격 범위 내
		if (distance <= currentStats.attackRange) {
			if (attackCooldown <= 0) {
				// 예측 기반 공격 선택
				const shouldUseHeavy = Math.random() < currentStats.aggressiveness;

				// 플레이어가 가드를 자주 한다면 강공격 선호
				if (predictedPlayerAction === 'guard' && Math.random() < currentStats.predictionAccuracy) {
					performAttack('heavy');
				}
				// 플레이어가 패링을 자주 한다면 페인트 후 공격 (여기선 딜레이 공격)
				else if (predictedPlayerAction === 'parry' && Math.random() < currentStats.predictionAccuracy) {
					// 딜레이 후 약공격
					setTimeout(() => performAttack('light'), 300);
					currentState = 'predicting';
				}
				else if (shouldUseHeavy) {
					performAttack('heavy');
				} else {
					performAttack('light');
				}
			} else {
				// 쿨다운 중 - 약간 물러나거나 대기
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
	}

	// 데미지 처리
	export function takeDamage(amount: number) {
		enemyHealth.update(h => Math.max(0, h - amount));
	}

	export function getPosition(): THREE.Vector3 | null {
		if (!rigidBody) return null;
		const pos = rigidBody.translation();
		return new THREE.Vector3(pos.x, pos.y, pos.z);
	}

	export function isAttacking(): { attacking: boolean; type: 'light' | 'heavy' | null } {
		return { attacking: currentState === 'attacking', type: attackType };
	}

	useTask((delta) => {
		if (!rigidBody || get(gameState) !== 'playing') return;

		const pos = rigidBody.translation();
		const enemyPos = new THREE.Vector3(pos.x, pos.y, pos.z);
		const toPlayer = playerPosition.clone().sub(enemyPos);
		const distance = toPlayer.length();

		// 의사결정
		makeDecision(distance, delta);

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

		rigidBody.setLinvel({ x: moveX, y: velocity.y, z: moveZ }, true);

		// 플레이어 방향으로 회전
		if (distance > 0.5) {
			const angle = Math.atan2(toPlayer.x, toPlayer.z);
			// 회전은 메쉬에서 처리
		}

		// 낙하 리셋
		if (pos.y < -10) {
			rigidBody.setTranslation({ x: 0, y: 2, z: -8 }, true);
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

<RigidBody bind:rigidBody position={[0, 2, -8]} linearDamping={0.9} lockRotations>
	<Collider shape="capsule" args={[0.6, 0.5]} mass={2} />

	<T.Group rotation.y={lookAngle}>
		<!-- 몸체 -->
		<T.Mesh castShadow position.y={0.6}>
			<T.CapsuleGeometry args={[0.5, 1.2, 8, 16]} />
			<T.MeshStandardMaterial
				color={isStunned ? '#888888' : currentState === 'attacking' ? '#ff2222' : '#e94560'}
				emissive={currentState === 'attacking' ? '#ff0000' : '#000000'}
				emissiveIntensity={currentState === 'attacking' ? 0.5 : 0}
			/>
		</T.Mesh>

		<!-- 머리 (보스) -->
		<T.Mesh castShadow position.y={1.7}>
			<T.SphereGeometry args={[0.35, 16, 16]} />
			<T.MeshStandardMaterial color="#e94560" />
		</T.Mesh>

		<!-- 뿔 (보스 특징) -->
		<T.Mesh castShadow position={[0.2, 2, 0]} rotation.z={-0.3}>
			<T.ConeGeometry args={[0.1, 0.4, 8]} />
			<T.MeshStandardMaterial color="#1a1a2e" />
		</T.Mesh>
		<T.Mesh castShadow position={[-0.2, 2, 0]} rotation.z={0.3}>
			<T.ConeGeometry args={[0.1, 0.4, 8]} />
			<T.MeshStandardMaterial color="#1a1a2e" />
		</T.Mesh>

		<!-- 무기 (양손 도끼) -->
		<T.Group position={[0.6, 0.5, 0]} rotation.z={attackType ? -1 : -0.5}>
			<!-- 도끼 날 -->
			<T.Mesh castShadow position={[0, 0.8, 0]}>
				<T.BoxGeometry args={[0.4, 0.6, 0.1]} />
				<T.MeshStandardMaterial
					color={attackType === 'heavy' ? '#ff4400' : '#666666'}
					emissive={attackType ? '#ff2200' : '#000000'}
					emissiveIntensity={attackType ? 0.8 : 0}
				/>
			</T.Mesh>
			<!-- 손잡이 -->
			<T.Mesh position={[0, 0.2, 0]}>
				<T.CylinderGeometry args={[0.06, 0.06, 1, 8]} />
				<T.MeshStandardMaterial color="#3d2914" />
			</T.Mesh>
		</T.Group>

		<!-- 눈 (발광) -->
		<T.Mesh position={[0.1, 1.7, 0.3]}>
			<T.SphereGeometry args={[0.06, 8, 8]} />
			<T.MeshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={1} />
		</T.Mesh>
		<T.Mesh position={[-0.1, 1.7, 0.3]}>
			<T.SphereGeometry args={[0.06, 8, 8]} />
			<T.MeshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={1} />
		</T.Mesh>

		<!-- 레벨 표시 (후광) -->
		{#if get(bossLevel) > 1}
			<T.PointLight position={[0, 2.5, 0]} intensity={get(bossLevel) * 5} color="#e94560" distance={5} />
		{/if}
	</T.Group>
</RigidBody>
