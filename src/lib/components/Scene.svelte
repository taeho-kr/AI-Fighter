<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { World } from '@threlte/rapier';
	import * as THREE from 'three';
	import Arena from './Arena.svelte';
	import PlayerCombat from './PlayerCombat.svelte';
	import EnemyAI from './EnemyAI.svelte';
	import CameraController from './CameraController.svelte';
	import {
		gameState, playerHealth, enemyHealth, playerState, recordMovement
	} from '$lib/stores/gameStore';
	import { get } from 'svelte/store';

	// 이전 게임 상태 추적 (새 라운드 감지용)
	let previousGameState = $state<string>('menu');

	// 컴포넌트 참조
	let playerComponent: PlayerCombat;
	let enemyComponent: EnemyAI;

	// 위치 추적
	let playerPosition = $state(new THREE.Vector3(0, 2, 8));
	let playerRotation = $state(0);
	let enemyPosition = $state(new THREE.Vector3(0, 2, -8));
	let cameraRotation = $state(0);

	// 움직임 학습용
	let lastDistance = $state(16);  // 초기 거리
	let movementRecordTimer = $state(0);

	// 공격 히트 추적 (공격당 한 번만 데미지 적용)
	let hasHitThisAttack = $state(false);  // 현재 공격에서 히트했는지
	let wasAttacking = $state(false);      // 이전 프레임에서 공격 중이었는지

	// 플레이어 위치 업데이트 핸들러
	function handlePlayerPositionUpdate(pos: THREE.Vector3) {
		playerPosition = pos;
	}

	function handlePlayerRotationUpdate(rot: number) {
		playerRotation = rot;
	}

	// 적이 플레이어 공격
	function handleEnemyAttackPlayer(damage: number, _type: 'light' | 'heavy') {
		if (!playerComponent) return;

		// 플레이어의 takeDamage가 결과를 반환
		const result = playerComponent.takeDamage(damage);

		if (result === 'parried') {
			// 패링 성공! 적에게 1.5~2초 스턴 (데미지 없음)
			const stunDuration = 1.5 + Math.random() * 0.5; // 1.5 ~ 2.0초
			enemyComponent?.applyStun(stunDuration);
			return;
		}

		if (result === 'dodged') {
			// 회피 성공 - 적에게 알림
			enemyComponent?.notifyPlayerDodged();
			return;
		}

		if (result === 'blocked') {
			// 가드 - 일부 데미지만 적용됨
			return;
		}

		// 히트 - 적에게 알림
		enemyComponent?.notifyHitPlayer();

		// 사망 체크
		setTimeout(async () => {
			if (get(playerHealth) <= 0) {
				gameState.set('dead');
				// AI 승리 - 학습 기록
				await enemyComponent?.endRound(true);
			}
		}, 100);
	}

	// 플레이어가 적 공격 (전투 충돌 체크)
	function checkPlayerAttack() {
		if (!playerComponent || !enemyComponent) return;

		const attackState = playerComponent.isInAttackState();

		// 공격이 끝났으면 히트 플래그 리셋
		if (!attackState.attacking && wasAttacking) {
			hasHitThisAttack = false;
		}
		wasAttacking = attackState.attacking;

		// 공격 중이 아니면 리턴
		if (!attackState.attacking) return;

		// 이미 이 공격으로 히트했으면 스킵
		if (hasHitThisAttack) return;

		const pPos = playerComponent.getPosition();
		const ePos = enemyComponent.getPosition();
		if (!pPos || !ePos) return;

		const distance = pPos.distanceTo(ePos);
		if (distance <= 2.5) {
			// 이 공격은 히트 처리 완료
			hasHitThisAttack = true;

			// 플레이어 데미지 (AI와 동일)
			const damage = attackState.type === 'light' ? 10 : 25;
			enemyComponent.takeDamage(damage);

			// 적 사망 체크
			setTimeout(async () => {
				if (get(enemyHealth) <= 0) {
					gameState.set('victory');
					// AI 패배 - 학습 기록
					await enemyComponent?.endRound(false);
				}
			}, 100);
		}
	}

	// 적 위치 업데이트 및 움직임 학습
	useTask((delta) => {
		const currentGameState = get(gameState);

		// 게임 상태가 playing으로 변경되면 위치 초기화
		if (currentGameState === 'playing' && previousGameState !== 'playing') {
			// 약간의 지연 후 위치 리셋 (물리 엔진 안정화)
			setTimeout(() => {
				playerComponent?.resetPosition();
				enemyComponent?.resetPosition();
			}, 100);
		}
		previousGameState = currentGameState;

		if (enemyComponent) {
			const pos = enemyComponent.getPosition();
			if (pos) {
				enemyPosition = pos;
			}
		}

		// 공격 충돌 체크
		if (currentGameState === 'playing') {
			checkPlayerAttack();

			// 움직임 기록 (0.1초마다)
			movementRecordTimer += delta;
			if (movementRecordTimer >= 0.1 && playerComponent && enemyComponent) {
				movementRecordTimer = 0;

				const pPos = playerComponent.getPosition();
				const ePos = enemyComponent.getPosition();
				if (pPos && ePos) {
					const currentDistance = pPos.distanceTo(ePos);
					const deltaDistance = currentDistance - lastDistance;
					const movementDir = playerComponent.getMovementDirection();

					recordMovement(movementDir, currentDistance, deltaDistance);
					lastDistance = currentDistance;
				}
			}
		}
	});

</script>

<World>
	<!-- 카메라 -->
	<CameraController
		targetPosition={playerPosition}
		targetRotation={playerRotation}
		onCameraRotationUpdate={(rot) => cameraRotation = rot}
	/>

	<!-- 앰비언트 라이트 (기본 밝기) -->
	<T.AmbientLight intensity={0.3} />

	<!-- 배경 (하늘) -->
	<T.Mesh>
		<T.SphereGeometry args={[100, 32, 32]} />
		<T.MeshBasicMaterial color="#0a0a1a" side={THREE.BackSide} />
	</T.Mesh>

	<!-- 아레나 -->
	<Arena />

	<!-- 플레이어 -->
	<PlayerCombat
		bind:this={playerComponent}
		onPositionUpdate={handlePlayerPositionUpdate}
		onRotationUpdate={handlePlayerRotationUpdate}
		{cameraRotation}
	/>

	<!-- 적 AI -->
	<EnemyAI
		bind:this={enemyComponent}
		playerPosition={playerPosition}
		playerState={$playerState}
		onAttackPlayer={handleEnemyAttackPlayer}
	/>
</World>

