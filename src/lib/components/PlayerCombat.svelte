<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { RigidBody, Collider } from '@threlte/rapier';
	import type { RigidBody as RapierRigidBody } from '@dimforge/rapier3d-compat';
	import * as THREE from 'three';
	import {
		playerHealth, playerStamina, playerState,
		cameraMode, recordAction, gameState
	} from '$lib/stores/gameStore';
	import { get } from 'svelte/store';

	// Props
	let { onPositionUpdate = (pos: THREE.Vector3) => {}, onRotationUpdate = (rot: number) => {} } = $props();

	let rigidBody: RapierRigidBody;
	let playerMesh: THREE.Group;
	let playerRotation = $state(0);

	// 입력 상태
	let keys = $state({
		forward: false,
		backward: false,
		left: false,
		right: false
	});

	// 전투 상태
	let isAttacking = $state(false);
	let attackType = $state<'light' | 'heavy' | null>(null);
	let isGuarding = $state(false);
	let isDodging = $state(false);
	let isParrying = $state(false);
	let attackCooldown = $state(false);
	let dodgeCooldown = $state(false);
	let parryCooldown = $state(false);

	// 무기 상태 (시각적 표현용)
	let weaponRotation = $state(0);

	const speed = 6;
	const dodgeSpeed = 15;
	const staminaCosts = {
		light_attack: 10,
		heavy_attack: 25,
		dodge: 20,
		guard: 5, // per second
		parry: 15
	};

	// 키 입력 핸들러
	function handleKeyDown(e: KeyboardEvent) {
		if (get(gameState) !== 'playing') return;

		switch (e.code) {
			case 'KeyW': keys.forward = true; break;
			case 'KeyS': keys.backward = true; break;
			case 'KeyA': keys.left = true; break;
			case 'KeyD': keys.right = true; break;
			case 'ShiftLeft':
			case 'ShiftRight':
				if (!isDodging && !dodgeCooldown && get(playerStamina) >= staminaCosts.dodge) {
					performDodge();
				}
				break;
			case 'KeyV':
				cameraMode.update(mode => mode === 'first-person' ? 'third-person' : 'first-person');
				break;
		}
	}

	function handleKeyUp(e: KeyboardEvent) {
		switch (e.code) {
			case 'KeyW': keys.forward = false; break;
			case 'KeyS': keys.backward = false; break;
			case 'KeyA': keys.left = false; break;
			case 'KeyD': keys.right = false; break;
		}
	}

	// 마우스 입력 핸들러
	function handleMouseDown(e: MouseEvent) {
		if (get(gameState) !== 'playing') return;
		if (isAttacking || isDodging) return;

		if (e.button === 0) { // 좌클릭 - 약공격
			if (!attackCooldown && get(playerStamina) >= staminaCosts.light_attack) {
				performAttack('light');
			}
		} else if (e.button === 2) { // 우클릭 - 가드
			startGuard();
		}
	}

	function handleMouseUp(e: MouseEvent) {
		if (e.button === 2) {
			stopGuard();
		}
	}

	// 강공격 (좌클릭 홀드 후 릴리즈로 변경하거나 별도 키로)
	function handleKeyPress(e: KeyboardEvent) {
		if (get(gameState) !== 'playing') return;

		if (e.code === 'KeyQ' && !isAttacking && !attackCooldown) {
			if (get(playerStamina) >= staminaCosts.heavy_attack) {
				performAttack('heavy');
			}
		}
		if (e.code === 'KeyE' && !isParrying && !parryCooldown) {
			if (get(playerStamina) >= staminaCosts.parry) {
				performParry();
			}
		}
	}

	// 공격 수행
	function performAttack(type: 'light' | 'heavy') {
		isAttacking = true;
		attackType = type;
		attackCooldown = true;
		playerState.set('attacking');

		const staminaCost = type === 'light' ? staminaCosts.light_attack : staminaCosts.heavy_attack;
		playerStamina.update(s => Math.max(0, s - staminaCost));

		recordAction({ type: type === 'light' ? 'light_attack' : 'heavy_attack' });

		// 공격 애니메이션 시간
		const duration = type === 'light' ? 300 : 600;

		setTimeout(() => {
			isAttacking = false;
			attackType = null;
			playerState.set('idle');
		}, duration);

		setTimeout(() => {
			attackCooldown = false;
		}, type === 'light' ? 400 : 800);
	}

	// 회피 수행
	function performDodge() {
		isDodging = true;
		dodgeCooldown = true;
		playerState.set('dodging');

		playerStamina.update(s => Math.max(0, s - staminaCosts.dodge));

		// 회피 방향 결정
		let direction: 'forward' | 'backward' | 'left' | 'right' = 'backward';
		if (keys.forward) direction = 'forward';
		else if (keys.left) direction = 'left';
		else if (keys.right) direction = 'right';

		recordAction({ type: 'dodge', direction });

		setTimeout(() => {
			isDodging = false;
			playerState.set('idle');
		}, 400);

		setTimeout(() => {
			dodgeCooldown = false;
		}, 600);
	}

	// 가드 시작/종료
	function startGuard() {
		if (!isAttacking && !isDodging) {
			isGuarding = true;
			playerState.set('guarding');
			recordAction({ type: 'guard' });
		}
	}

	function stopGuard() {
		isGuarding = false;
		if (get(playerState) === 'guarding') {
			playerState.set('idle');
		}
	}

	// 패링 수행
	function performParry() {
		isParrying = true;
		parryCooldown = true;
		playerState.set('parrying');

		playerStamina.update(s => Math.max(0, s - staminaCosts.parry));
		recordAction({ type: 'parry' });

		// 패링 윈도우 (짧은 시간)
		setTimeout(() => {
			isParrying = false;
			playerState.set('idle');
		}, 200);

		setTimeout(() => {
			parryCooldown = false;
		}, 800);
	}

	// 스태미나 자동 회복
	let lastStaminaRegen = Date.now();

	useTask(() => {
		if (!rigidBody) return;

		const now = Date.now();

		// 스태미나 회복 (가드 중이 아닐 때)
		if (now - lastStaminaRegen > 100) {
			if (!isGuarding && !isAttacking && !isDodging) {
				playerStamina.update(s => Math.min(100, s + 2));
			} else if (isGuarding) {
				playerStamina.update(s => Math.max(0, s - 0.5));
			}
			lastStaminaRegen = now;
		}

		// 이동 처리
		const velocity = rigidBody.linvel();
		let moveX = 0;
		let moveZ = 0;

		if (!isAttacking && !isDodging) {
			if (keys.forward) moveZ -= 1;
			if (keys.backward) moveZ += 1;
			if (keys.left) moveX -= 1;
			if (keys.right) moveX += 1;

			// 정규화
			const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
			if (length > 0) {
				moveX = (moveX / length) * speed;
				moveZ = (moveZ / length) * speed;

				// 플레이어 회전 업데이트
				playerRotation = Math.atan2(moveX, moveZ);
			}
		}

		// 회피 중 빠른 이동
		if (isDodging) {
			const dodgeDir = {
				forward: { x: 0, z: -1 },
				backward: { x: 0, z: 1 },
				left: { x: -1, z: 0 },
				right: { x: 1, z: 0 }
			};
			let dir = dodgeDir.backward;
			if (keys.forward) dir = dodgeDir.forward;
			else if (keys.left) dir = dodgeDir.left;
			else if (keys.right) dir = dodgeDir.right;

			moveX = dir.x * dodgeSpeed;
			moveZ = dir.z * dodgeSpeed;
		}

		rigidBody.setLinvel({ x: moveX, y: velocity.y, z: moveZ }, true);

		// 위치 업데이트 전달 (카메라용)
		const pos = rigidBody.translation();
		onPositionUpdate(new THREE.Vector3(pos.x, pos.y, pos.z));
		onRotationUpdate(playerRotation);

		// 무기 애니메이션
		if (isAttacking) {
			weaponRotation += attackType === 'light' ? 0.4 : 0.2;
		} else {
			weaponRotation *= 0.9;
		}

		// 낙하 리셋
		if (pos.y < -10) {
			rigidBody.setTranslation({ x: 0, y: 2, z: 8 }, true);
			rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
		}
	});

	// 외부에서 데미지를 받을 수 있도록 export
	export function takeDamage(amount: number): boolean {
		if (isDodging) return false; // 회피 중 무적

		if (isGuarding) {
			// 가드 시 데미지 감소
			playerHealth.update(h => Math.max(0, h - amount * 0.3));
			playerStamina.update(s => Math.max(0, s - 15));
			return true;
		}

		if (isParrying) {
			// 패링 성공 - 데미지 없음, 적 스턴
			return false; // 패링 성공 신호
		}

		playerHealth.update(h => Math.max(0, h - amount));
		return true;
	}

	export function getPosition(): THREE.Vector3 | null {
		if (!rigidBody) return null;
		const pos = rigidBody.translation();
		return new THREE.Vector3(pos.x, pos.y, pos.z);
	}

	export function isInAttackState(): { attacking: boolean; type: 'light' | 'heavy' | null } {
		return { attacking: isAttacking, type: attackType };
	}
</script>

<svelte:window
	onkeydown={handleKeyDown}
	onkeyup={handleKeyUp}
	onkeypress={handleKeyPress}
	onmousedown={handleMouseDown}
	onmouseup={handleMouseUp}
	oncontextmenu={(e) => e.preventDefault()}
/>

<RigidBody bind:rigidBody position={[0, 2, 8]} linearDamping={0.9} lockRotations>
	<Collider shape="capsule" args={[0.5, 0.4]} mass={1} />

	<T.Group bind:ref={playerMesh} rotation.y={playerRotation}>
		<!-- 몸체 -->
		<T.Mesh castShadow position.y={0.5}>
			<T.CapsuleGeometry args={[0.4, 1, 8, 16]} />
			<T.MeshStandardMaterial
				color={isDodging ? '#00ff88' : isGuarding ? '#4488ff' : isParrying ? '#ffff00' : '#22c55e'}
			/>
		</T.Mesh>

		<!-- 머리 -->
		<T.Mesh castShadow position.y={1.4}>
			<T.SphereGeometry args={[0.25, 16, 16]} />
			<T.MeshStandardMaterial color="#22c55e" />
		</T.Mesh>

		<!-- 무기 (검) -->
		<T.Group position={[0.5, 0.5, 0]} rotation.z={-0.3 + weaponRotation}>
			<T.Mesh castShadow position.y={0.6}>
				<T.BoxGeometry args={[0.1, 1.2, 0.05]} />
				<T.MeshStandardMaterial
					color={isAttacking ? (attackType === 'heavy' ? '#ff4444' : '#ffaa00') : '#888888'}
					emissive={isAttacking ? '#ff4400' : '#000000'}
					emissiveIntensity={isAttacking ? 0.5 : 0}
				/>
			</T.Mesh>
			<!-- 손잡이 -->
			<T.Mesh position.y={-0.1}>
				<T.CylinderGeometry args={[0.05, 0.05, 0.3, 8]} />
				<T.MeshStandardMaterial color="#4a3728" />
			</T.Mesh>
		</T.Group>

		<!-- 방패 (가드 중) -->
		{#if isGuarding}
			<T.Mesh position={[-0.5, 0.5, 0.3]}>
				<T.BoxGeometry args={[0.1, 0.8, 0.6]} />
				<T.MeshStandardMaterial color="#4488ff" emissive="#2244aa" emissiveIntensity={0.3} />
			</T.Mesh>
		{/if}
	</T.Group>
</RigidBody>
