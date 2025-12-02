<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { World } from '@threlte/rapier';
	import * as THREE from 'three';
	import Arena from './Arena.svelte';
	import PlayerCombat from './PlayerCombat.svelte';
	import EnemyAI from './EnemyAI.svelte';
	import CameraController from './CameraController.svelte';
	import GameUI from './GameUI.svelte';
	import {
		gameState, playerHealth, enemyHealth, playerState,
		resetGame, nextRound, enemyMaxHealth, bossLevel
	} from '$lib/stores/gameStore';
	import { get } from 'svelte/store';

	// 컴포넌트 참조
	let playerComponent: PlayerCombat;
	let enemyComponent: EnemyAI;

	// 위치 추적
	let playerPosition = $state(new THREE.Vector3(0, 2, 8));
	let playerRotation = $state(0);
	let enemyPosition = $state(new THREE.Vector3(0, 2, -8));

	// 플레이어 위치 업데이트 핸들러
	function handlePlayerPositionUpdate(pos: THREE.Vector3) {
		playerPosition = pos;
	}

	function handlePlayerRotationUpdate(rot: number) {
		playerRotation = rot;
	}

	// 적이 플레이어 공격
	function handleEnemyAttackPlayer(damage: number, type: 'light' | 'heavy') {
		if (!playerComponent) return;

		const currentPlayerState = get(playerState);

		// 패링 체크
		if (currentPlayerState === 'parrying') {
			// 패링 성공 - 적 스턴
			enemyComponent?.applyStun(1.5);
			return;
		}

		// 데미지 적용
		playerComponent.takeDamage(damage);

		// 사망 체크
		setTimeout(() => {
			if (get(playerHealth) <= 0) {
				gameState.set('dead');
			}
		}, 100);
	}

	// 플레이어가 적 공격 (전투 충돌 체크)
	function checkPlayerAttack() {
		if (!playerComponent || !enemyComponent) return;

		const attackState = playerComponent.isInAttackState();
		if (!attackState.attacking) return;

		const pPos = playerComponent.getPosition();
		const ePos = enemyComponent.getPosition();
		if (!pPos || !ePos) return;

		const distance = pPos.distanceTo(ePos);
		if (distance <= 2.5) {
			const damage = attackState.type === 'light' ? 12 : 25;
			enemyComponent.takeDamage(damage);

			// 적 사망 체크
			setTimeout(() => {
				if (get(enemyHealth) <= 0) {
					gameState.set('victory');
				}
			}, 100);
		}
	}

	// 적 위치 업데이트
	useTask(() => {
		if (enemyComponent) {
			const pos = enemyComponent.getPosition();
			if (pos) {
				enemyPosition = pos;
			}
		}

		// 공격 충돌 체크
		if (get(gameState) === 'playing') {
			checkPlayerAttack();
		}
	});

	// 게임 재시작
	function handleRestart() {
		resetGame();
		// 보스 체력도 레벨에 맞게 리셋
		const level = get(bossLevel);
		enemyMaxHealth.set(100 + (level - 1) * 20);
		enemyHealth.set(100 + (level - 1) * 20);
	}

	// 다음 라운드
	function handleNextRound() {
		nextRound();
		// 보스 체력 증가
		const level = get(bossLevel);
		enemyMaxHealth.set(100 + (level - 1) * 20);
		enemyHealth.set(100 + (level - 1) * 20);
	}
</script>

<World>
	<!-- 카메라 -->
	<CameraController
		targetPosition={playerPosition}
		targetRotation={playerRotation}
	/>

	<!-- 조명 -->
	<T.DirectionalLight position={[10, 30, 10]} intensity={1.5} castShadow>
		<T.OrthographicCamera
			slot="shadow-camera"
			args={[-30, 30, 30, -30, 0.1, 100]}
		/>
	</T.DirectionalLight>
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
	/>

	<!-- 적 AI -->
	<EnemyAI
		bind:this={enemyComponent}
		playerPosition={playerPosition}
		playerState={$playerState}
		onAttackPlayer={handleEnemyAttackPlayer}
	/>
</World>

<!-- UI (Three.js 외부) -->
<GameUI
	onRestart={handleRestart}
	onNextRound={handleNextRound}
/>
