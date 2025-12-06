<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { World } from '@threlte/rapier';
	import * as THREE from 'three';
	import Arena from './Arena.svelte';
	import PlayerCombat from './PlayerCombat.svelte';
	import EnemyAI from './EnemyAI.svelte';
	import CameraController from './CameraController.svelte';
	import DamageNumber from './DamageNumber.svelte';
	import {
		gameState, playerHealth, enemyHealth, playerState, recordMovement
	} from '$lib/stores/gameStore';
	import { get } from 'svelte/store';
	import { MELEE_ATTACK_RANGE, HEAVY_ATTACK_RANGE, LIGHT_ATTACK_DAMAGE, HEAVY_ATTACK_DAMAGE } from '$lib/combat/constants';

	// 데미지 숫자 표시
	interface DamageNumberData {
		id: number;
		damage: number;
		position: [number, number, number];
		isCritical: boolean;
	}
	let damageNumbers = $state<DamageNumberData[]>([]);
	let damageNumberId = 0;

	function spawnDamageNumber(damage: number, pos: THREE.Vector3, isCritical = false) {
		const id = damageNumberId++;
		damageNumbers = [...damageNumbers, {
			id,
			damage,
			position: [pos.x, pos.y + 1.5, pos.z],
			isCritical
		}];
	}

	function removeDamageNumber(id: number) {
		damageNumbers = damageNumbers.filter(d => d.id !== id);
	}

	let previousGameState = $state<string>('menu');
	let playerComponent: PlayerCombat;
	let enemyComponent: EnemyAI;

	let playerPosition = $state(new THREE.Vector3(0, 2, 5));
	let playerRotation = $state(0);
	let enemyPosition = $state(new THREE.Vector3(0, 2, -5));
	let cameraRotation = $state(0);

	let lastDistance = $state(10);
	let movementRecordTimer = $state(0);
	let frameCounter = 0;

	const tempPlayerPos = new THREE.Vector3();
	const tempEnemyPos = new THREE.Vector3();

	let hasHitThisAttack = $state(false);
	let wasAttacking = $state(false);

	function handlePlayerPositionUpdate(pos: THREE.Vector3) {
		playerPosition = pos;
	}

	function handlePlayerRotationUpdate(rot: number) {
		playerRotation = rot;
	}

	function handleEnemyAttackPlayer(damage: number, attackType: 'light' | 'heavy') {
		if (!playerComponent) return;

		const result = playerComponent.takeDamage(damage);

		if (result === 'parried') {
			const stunDuration = 1.5 + Math.random() * 0.5;
			enemyComponent?.applyStun(stunDuration);
			return;
		}

		if (result === 'dodged') {
			enemyComponent?.notifyPlayerDodged();
			return;
		}

		if (result === 'blocked') {
			const blockedDamage = Math.floor(damage * 0.3);
			const pPos = playerComponent.getPosition();
			if (pPos) spawnDamageNumber(blockedDamage, pPos, false);
			return;
		}

		// 히트 - 데미지 숫자 표시
		const pPos = playerComponent.getPosition();
		if (pPos) spawnDamageNumber(damage, pPos, attackType === 'heavy');

		enemyComponent?.notifyHitPlayer();

		setTimeout(async () => {
			if (get(playerHealth) <= 0) {
				gameState.set('dead');
				await enemyComponent?.endRound(true);
			}
		}, 100);
	}

	function checkPlayerAttack() {
		if (!playerComponent || !enemyComponent) return;

		const attackState = playerComponent.isInAttackState();

		if (!attackState.attacking && wasAttacking) {
			hasHitThisAttack = false;
		}
		wasAttacking = attackState.attacking;

		if (!attackState.attacking) return;
		if (hasHitThisAttack) return;

		const pPos = playerComponent.getPosition();
		const ePos = enemyComponent.getPosition();
		if (!pPos || !ePos) return;

		tempPlayerPos.copy(pPos);
		tempEnemyPos.copy(ePos);
		const distance = tempPlayerPos.distanceTo(tempEnemyPos);

		const attackRange = attackState.type === 'heavy' ? HEAVY_ATTACK_RANGE : MELEE_ATTACK_RANGE;

		if (distance <= attackRange) {
			hasHitThisAttack = true;

			const damage = attackState.type === 'light' ? LIGHT_ATTACK_DAMAGE : HEAVY_ATTACK_DAMAGE;
			const isCritical = attackState.type === 'heavy';

			// 데미지 숫자 표시
			spawnDamageNumber(damage, ePos, isCritical);

			enemyComponent.takeDamage(damage);

			setTimeout(async () => {
				if (get(enemyHealth) <= 0) {
					gameState.set('victory');
					await enemyComponent?.endRound(false);
				}
			}, 100);
		}
	}

	useTask((delta) => {
		frameCounter++;
		const currentGameState = get(gameState);

		if (currentGameState === 'playing' && previousGameState !== 'playing') {
			setTimeout(() => {
				playerComponent?.resetPosition();
				enemyComponent?.resetPosition();
			}, 100);
		}
		previousGameState = currentGameState;

		if (frameCounter % 2 === 0 && enemyComponent) {
			const pos = enemyComponent.getPosition();
			if (pos) {
				enemyPosition = pos;
			}
		}

		if (currentGameState === 'playing') {
			checkPlayerAttack();

			movementRecordTimer += delta;
			if (movementRecordTimer >= 0.1 && playerComponent && enemyComponent) {
				movementRecordTimer = 0;

				const pPos = playerComponent.getPosition();
				const ePos = enemyComponent.getPosition();
				if (pPos && ePos) {
					tempPlayerPos.copy(pPos);
					tempEnemyPos.copy(ePos);
					const currentDistance = tempPlayerPos.distanceTo(tempEnemyPos);
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

	<!-- 조명 -->
	<T.AmbientLight intensity={0.5} color="#ffffff" />
	<T.DirectionalLight position={[10, 20, 10]} intensity={1.5} color="#ffffff" />

	<!-- 하늘 (단순 색상) -->
	<T.Mesh>
		<T.SphereGeometry args={[100, 8, 8]} />
		<T.MeshBasicMaterial color="#87CEEB" side={THREE.BackSide} />
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

	<!-- 데미지 숫자 -->
	{#each damageNumbers as dn (dn.id)}
		<DamageNumber
			damage={dn.damage}
			position={dn.position}
			isCritical={dn.isCritical}
			onComplete={() => removeDamageNumber(dn.id)}
		/>
	{/each}
</World>
