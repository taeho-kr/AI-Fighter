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
	let playerPosition = $state(new THREE.Vector3(0, 2, 5));
	let playerRotation = $state(0);
	let enemyPosition = $state(new THREE.Vector3(0, 2, -5));
	let cameraRotation = $state(0);

	// 움직임 학습용
	let lastDistance = $state(10);  // 초기 거리 (플레이어 z=5, 적 z=-5)
	let movementRecordTimer = $state(0);

	// 프레임 스킵 최적화용 (2프레임마다 거리 계산)
	let frameCounter = 0;
	// Vector3 재사용 (GC 방지)
	const tempPlayerPos = new THREE.Vector3();
	const tempEnemyPos = new THREE.Vector3();

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

	// 플레이어가 적 공격 (전투 충돌 체크) - Vector3 재사용 최적화
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

		// Vector3 재사용하여 거리 계산
		tempPlayerPos.copy(pPos);
		tempEnemyPos.copy(ePos);
		const distance = tempPlayerPos.distanceTo(tempEnemyPos);

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

	// 적 위치 업데이트 및 움직임 학습 - 프레임 스킵 최적화
	useTask((delta) => {
		frameCounter++;
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

		// 적 위치 업데이트 (2프레임마다)
		if (frameCounter % 2 === 0 && enemyComponent) {
			const pos = enemyComponent.getPosition();
			if (pos) {
				enemyPosition = pos;
			}
		}

		// 공격 충돌 체크
		if (currentGameState === 'playing') {
			checkPlayerAttack();

			// 움직임 기록 (0.1초마다) - Vector3 재사용
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

	<!-- 앰비언트 라이트 (저녁 분위기) -->
	<T.AmbientLight intensity={0.35} color="#ffeedd" />

	<!-- 메인 태양광 (석양) -->
	<T.DirectionalLight
		position={[15, 12, 8]}
		intensity={1.8}
		color="#ffaa66"
		castShadow
	/>

	<!-- 보조 조명 (반대편 - 푸른 하늘 반사) -->
	<T.DirectionalLight
		position={[-10, 8, -5]}
		intensity={0.5}
		color="#8888cc"
	/>

	<!-- 하단 반사광 (모래 반사) -->
	<T.DirectionalLight
		position={[0, -5, 0]}
		intensity={0.3}
		color="#c4a574"
	/>

	<!-- 하늘 배경 (석양 그라데이션) -->
	<T.Mesh>
		<T.SphereGeometry args={[100, 32, 32]} />
		<T.ShaderMaterial
			side={THREE.BackSide}
			uniforms={{
				topColor: { value: new THREE.Color("#1a1a3a") },
				bottomColor: { value: new THREE.Color("#ff6644") },
				offset: { value: 10 },
				exponent: { value: 0.5 }
			}}
			vertexShader={`
				varying vec3 vWorldPosition;
				void main() {
					vec4 worldPosition = modelMatrix * vec4(position, 1.0);
					vWorldPosition = worldPosition.xyz;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`}
			fragmentShader={`
				uniform vec3 topColor;
				uniform vec3 bottomColor;
				uniform float offset;
				uniform float exponent;
				varying vec3 vWorldPosition;
				void main() {
					float h = normalize(vWorldPosition + offset).y;
					gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
				}
			`}
		/>
	</T.Mesh>

	<!-- 별들 (밤하늘) -->
	{#each Array(50) as _, i}
		{@const theta = Math.random() * Math.PI * 2}
		{@const phi = Math.random() * Math.PI * 0.4}
		{@const r = 95}
		{@const x = r * Math.sin(phi) * Math.cos(theta)}
		{@const y = r * Math.cos(phi) + 30}
		{@const z = r * Math.sin(phi) * Math.sin(theta)}
		{@const size = 0.1 + Math.random() * 0.2}
		<T.Mesh position={[x, y, z]}>
			<T.SphereGeometry args={[size, 4, 4]} />
			<T.MeshBasicMaterial color="#ffffff" />
		</T.Mesh>
	{/each}

	<!-- 달 -->
	<T.Mesh position={[-40, 50, -30]}>
		<T.SphereGeometry args={[5, 16, 16]} />
		<T.MeshBasicMaterial color="#ffffee" />
	</T.Mesh>
	<T.PointLight position={[-40, 50, -30]} intensity={10} color="#aabbff" distance={150} />

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

