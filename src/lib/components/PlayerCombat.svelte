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
	import { onMount } from 'svelte';

	// Props
	let {
		onPositionUpdate = (pos: THREE.Vector3) => {},
		onRotationUpdate = (rot: number) => {},
		cameraRotation = 0
	} = $props();

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
	let attackCooldownTimer = $state(0);  // 공격 쿨다운 타이머 (밀리초)
	let dodgeCooldown = $state(false);
	let parryCooldown = $state(false);

	// 공격 쿨다운 시간 (밀리초)
	const LIGHT_ATTACK_COOLDOWN = 500;   // 약공격 쿨다운 0.5초
	const HEAVY_ATTACK_COOLDOWN = 1000;  // 강공격 쿨다운 1초

	// 차징 시스템 (좌클릭 홀드)
	let isCharging = $state(false);
	let chargeStartTime = $state(0);
	const HEAVY_ATTACK_THRESHOLD = 2000; // 2초 이상 홀드 시 강공격

	// 패링 시스템
	let lastRightClickTime = $state(0);
	let parryWindowActive = $state(false);  // 패링 윈도우 활성화 여부
	let parryWindowTimer = $state(0);       // 패링 윈도우 타이머
	const PARRY_WINDOW = 300;               // 우클릭 후 300ms 동안 패링 윈도우 활성화

	// 애니메이션 상태
	let weaponRotationX = $state(0);  // 검 X축 회전 (휘두르기)
	let weaponRotationZ = $state(-0.3);  // 검 Z축 회전 (기울기)
	let weaponPositionY = $state(0.5);  // 검 Y 위치
	let weaponPositionX = $state(0.5);  // 검 X 위치
	let armRotation = $state(0);  // 팔 회전
	let shieldPositionZ = $state(0.3);  // 방패 Z 위치
	let shieldRotationY = $state(0);  // 방패 Y 회전
	let bodyTilt = $state(0);  // 몸 기울기

	// 애니메이션 타겟 (보간용)
	let targetWeaponRotX = $state(0);
	let targetWeaponRotZ = $state(-0.3);
	let targetWeaponPosY = $state(0.5);
	let targetShieldPosZ = $state(0.3);
	let targetShieldRotY = $state(0);
	let targetBodyTilt = $state(0);

	// 이펙트 상태
	let slashTrailOpacity = $state(0);
	let slashTrailRotation = $state(0);
	let slashTrailScale = $state(1);
	let chargeParticles = $state<{x: number, y: number, z: number, life: number}[]>([]);
	let hitEffectActive = $state(false);
	let hitEffectPosition = $state({ x: 0, y: 0, z: 0 });
	let shieldBlockEffect = $state(false);
	let parryFlashEffect = $state(false);

	// 공격 진행도 (0~1)
	let attackProgress = $state(0);
	let attackStartTime = $state(0);

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
		const state = get(gameState);
		// playing 상태가 아니면 입력 무시
		if (state !== 'playing') return;

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
		// 포인터 락 요청 (playing 상태일 때만)
		const state = get(gameState);
		if (state !== 'playing') return;

		if (document.pointerLockElement !== document.body) {
			document.body.requestPointerLock();
			return; // 첫 클릭은 포인터 락 요청만
		}

		if (isAttacking || isDodging) return;

		if (e.button === 0) { // 좌클릭 - 차징 시작
			if (attackCooldownTimer <= 0) {
				isCharging = true;
				chargeStartTime = Date.now();
			}
		} else if (e.button === 2) { // 우클릭
			const now = Date.now();
			lastRightClickTime = now;
			startGuard();
		}
	}

	function handleMouseUp(e: MouseEvent) {
		if (e.button === 0 && isCharging) { // 좌클릭 릴리즈
			isCharging = false;

			// 쿨다운 중이면 공격 불가
			if (attackCooldownTimer > 0) return;

			const holdDuration = Date.now() - chargeStartTime;

			if (holdDuration >= HEAVY_ATTACK_THRESHOLD) {
				// 강공격
				if (get(playerStamina) >= staminaCosts.heavy_attack) {
					performAttack('heavy');
				}
			} else {
				// 약공격
				if (get(playerStamina) >= staminaCosts.light_attack) {
					performAttack('light');
				}
			}
		} else if (e.button === 2) { // 우클릭 릴리즈
			stopGuard();
		}
	}

	// 공격 수행
	function performAttack(type: 'light' | 'heavy') {
		isAttacking = true;
		attackType = type;
		attackStartTime = Date.now();
		attackProgress = 0;
		playerState.set('attacking');

		// 공격 쿨다운 설정
		attackCooldownTimer = type === 'light' ? LIGHT_ATTACK_COOLDOWN : HEAVY_ATTACK_COOLDOWN;

		const staminaCost = type === 'light' ? staminaCosts.light_attack : staminaCosts.heavy_attack;
		playerStamina.update(s => Math.max(0, s - staminaCost));

		recordAction({ type: type === 'light' ? 'light_attack' : 'heavy_attack' });

		// 슬래시 이펙트 시작
		slashTrailOpacity = 1;
		slashTrailRotation = type === 'light' ? 0 : -Math.PI / 4;
		slashTrailScale = type === 'heavy' ? 1.5 : 1;

		// 공격 애니메이션 시간
		const duration = type === 'light' ? 300 : 600;

		setTimeout(() => {
			isAttacking = false;
			attackType = null;
			attackProgress = 0;
			playerState.set('idle');
		}, duration);
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

	// 가드 시작/종료 + 패링 윈도우 활성화
	function startGuard() {
		if (!isAttacking && !isDodging) {
			isGuarding = true;
			playerState.set('guarding');
			recordAction({ type: 'guard' });

			// 패링 윈도우 활성화 (우클릭 직후)
			parryWindowActive = true;
			parryWindowTimer = PARRY_WINDOW;
			lastRightClickTime = Date.now();
		}
	}

	function stopGuard() {
		isGuarding = false;
		if (get(playerState) === 'guarding') {
			playerState.set('idle');
		}
	}

	// 이벤트 리스너 등록
	onMount(() => {
		const onContextMenu = (e: Event) => e.preventDefault();

		document.addEventListener('keydown', handleKeyDown, true);
		document.addEventListener('keyup', handleKeyUp, true);
		document.addEventListener('mousedown', handleMouseDown, true);
		document.addEventListener('mouseup', handleMouseUp, true);
		document.addEventListener('contextmenu', onContextMenu, true);

		return () => {
			document.removeEventListener('keydown', handleKeyDown, true);
			document.removeEventListener('keyup', handleKeyUp, true);
			document.removeEventListener('mousedown', handleMouseDown, true);
			document.removeEventListener('mouseup', handleMouseUp, true);
			document.removeEventListener('contextmenu', onContextMenu, true);
		};
	});

	// 스태미나 자동 회복
	let lastStaminaRegen = Date.now();
	let lastFrameTime = Date.now();

	useTask(() => {
		if (!rigidBody) return;

		const now = Date.now();
		const deltaMs = now - lastFrameTime;
		lastFrameTime = now;

		// 공격 쿨다운 타이머 감소
		if (attackCooldownTimer > 0) {
			attackCooldownTimer = Math.max(0, attackCooldownTimer - deltaMs);
		}

		// 패링 윈도우 타이머 감소
		if (parryWindowTimer > 0) {
			parryWindowTimer = Math.max(0, parryWindowTimer - deltaMs);
			if (parryWindowTimer <= 0) {
				parryWindowActive = false;
			}
		}

		// 스태미나 회복 (가드 중이 아닐 때)
		if (now - lastStaminaRegen > 100) {
			if (!isGuarding && !isAttacking && !isDodging) {
				playerStamina.update(s => Math.min(100, s + 2));
			} else if (isGuarding) {
				playerStamina.update(s => Math.max(0, s - 0.5));
			}
			lastStaminaRegen = now;
		}

		// 이동 처리 (카메라 방향 기준)
		const velocity = rigidBody.linvel();
		let moveX = 0;
		let moveZ = 0;

		// 카메라 방향 벡터 계산
		const camSin = Math.sin(cameraRotation);
		const camCos = Math.cos(cameraRotation);

		if (!isAttacking && !isDodging) {
			// 로컬 이동 입력
			let localX = 0;
			let localZ = 0;
			if (keys.forward) localZ -= 1;
			if (keys.backward) localZ += 1;
			if (keys.left) localX -= 1;
			if (keys.right) localX += 1;

			// 정규화
			const length = Math.sqrt(localX * localX + localZ * localZ);
			if (length > 0) {
				localX = localX / length;
				localZ = localZ / length;

				// 카메라 방향으로 회전 변환
				moveX = (localX * camCos + localZ * camSin) * speed;
				moveZ = (-localX * camSin + localZ * camCos) * speed;

				// 플레이어가 이동 방향을 바라봄
				playerRotation = Math.atan2(moveX, moveZ);
			}
		}

		// 회피 중 빠른 이동 (카메라 방향 기준)
		if (isDodging) {
			let localX = 0;
			let localZ = 1; // 기본: 뒤로
			if (keys.forward) localZ = -1;
			else if (keys.left) { localX = -1; localZ = 0; }
			else if (keys.right) { localX = 1; localZ = 0; }

			// 카메라 방향으로 회전 변환
			moveX = (localX * camCos + localZ * camSin) * dodgeSpeed;
			moveZ = (-localX * camSin + localZ * camCos) * dodgeSpeed;
		}

		rigidBody.setLinvel({ x: moveX, y: velocity.y, z: moveZ }, true);

		// 위치 업데이트 전달 (카메라용)
		const pos = rigidBody.translation();
		onPositionUpdate(new THREE.Vector3(pos.x, pos.y, pos.z));
		onRotationUpdate(playerRotation);

		// === 애니메이션 상태 설정 ===
		const lerpSpeed = 0.15;

		if (isCharging) {
			// 차징: 검을 뒤로 들어올림
			const chargeTime = Date.now() - chargeStartTime;
			const chargeProgress = Math.min(chargeTime / HEAVY_ATTACK_THRESHOLD, 1);
			targetWeaponRotX = -1.5 - chargeProgress * 0.5; // 뒤로 더 젖힘
			targetWeaponRotZ = -0.8;
			targetWeaponPosY = 0.8 + chargeProgress * 0.3;
			targetBodyTilt = -0.1 - chargeProgress * 0.1;
		} else if (isAttacking && attackType === 'light') {
			// 약공격: 빠른 수평 베기
			targetWeaponRotX = 1.8;
			targetWeaponRotZ = 0.3;
			targetWeaponPosY = 0.4;
			targetBodyTilt = 0.15;
		} else if (isAttacking && attackType === 'heavy') {
			// 강공격: 위에서 아래로 내려치기
			targetWeaponRotX = 2.5;
			targetWeaponRotZ = 0;
			targetWeaponPosY = 0.2;
			targetBodyTilt = 0.25;
		} else if (isGuarding) {
			// 막기: 방패를 앞으로
			targetShieldPosZ = 0.5;
			targetShieldRotY = 0;
			targetWeaponRotX = -0.5;
			targetWeaponRotZ = -0.8;
			targetWeaponPosY = 0.6;
			targetBodyTilt = -0.05;
		} else if (isParrying) {
			// 패링: 방패를 밀어내기
			targetShieldPosZ = 0.8;
			targetShieldRotY = 0.3;
			targetBodyTilt = 0.1;
		} else if (isDodging) {
			// 회피: 몸을 숙임
			targetBodyTilt = 0.3;
			targetWeaponRotZ = -0.5;
		} else {
			// 기본 자세
			targetWeaponRotX = 0;
			targetWeaponRotZ = -0.3;
			targetWeaponPosY = 0.5;
			targetShieldPosZ = 0.3;
			targetShieldRotY = 0;
			targetBodyTilt = 0;
		}

		// 부드러운 보간
		weaponRotationX += (targetWeaponRotX - weaponRotationX) * lerpSpeed;
		weaponRotationZ += (targetWeaponRotZ - weaponRotationZ) * lerpSpeed;
		weaponPositionY += (targetWeaponPosY - weaponPositionY) * lerpSpeed;
		shieldPositionZ += (targetShieldPosZ - shieldPositionZ) * lerpSpeed;
		shieldRotationY += (targetShieldRotY - shieldRotationY) * lerpSpeed;
		bodyTilt += (targetBodyTilt - bodyTilt) * lerpSpeed;

		// 이펙트 업데이트
		// 슬래시 트레일 페이드 아웃
		if (slashTrailOpacity > 0) {
			slashTrailOpacity = Math.max(0, slashTrailOpacity - 0.08);
		}

		// 공격 진행도 업데이트
		if (isAttacking && attackStartTime > 0) {
			const duration = attackType === 'light' ? 300 : 600;
			attackProgress = Math.min(1, (Date.now() - attackStartTime) / duration);
		}

		// 차징 파티클 업데이트
		if (isCharging) {
			const chargeTime = Date.now() - chargeStartTime;
			const intensity = Math.min(chargeTime / HEAVY_ATTACK_THRESHOLD, 1);

			// 새 파티클 생성
			if (Math.random() < intensity * 0.5) {
				const angle = Math.random() * Math.PI * 2;
				const radius = 0.3 + Math.random() * 0.3;
				chargeParticles = [...chargeParticles, {
					x: Math.cos(angle) * radius,
					y: 0.5 + Math.random() * 0.5,
					z: Math.sin(angle) * radius,
					life: 1
				}];
			}

			// 파티클 업데이트
			chargeParticles = chargeParticles
				.map(p => ({ ...p, y: p.y + 0.02, life: p.life - 0.05 }))
				.filter(p => p.life > 0);
		} else {
			// 차징 종료 시 파티클 정리
			if (chargeParticles.length > 0) {
				chargeParticles = chargeParticles
					.map(p => ({ ...p, life: p.life - 0.1 }))
					.filter(p => p.life > 0);
			}
		}

		// 히트 이펙트 페이드
		if (hitEffectActive) {
			setTimeout(() => { hitEffectActive = false; }, 150);
		}

		// 방패 이펙트 페이드
		if (shieldBlockEffect) {
			setTimeout(() => { shieldBlockEffect = false; }, 200);
		}

		if (parryFlashEffect) {
			setTimeout(() => { parryFlashEffect = false; }, 300);
		}

		// 낙하 리셋
		if (pos.y < -10) {
			rigidBody.setTranslation({ x: 0, y: 2, z: 8 }, true);
			rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
		}
	});

	// 외부에서 데미지를 받을 수 있도록 export
	// 반환값: 'hit' = 피격, 'blocked' = 가드, 'parried' = 패링 성공, 'dodged' = 회피
	export function takeDamage(amount: number): 'hit' | 'blocked' | 'parried' | 'dodged' {
		if (isDodging) return 'dodged'; // 회피 중 무적

		if (isGuarding) {
			// 패링 윈도우가 활성화되어 있으면 패링 성공
			if (parryWindowActive) {
				// 패링 성공!
				playerStamina.update(s => Math.max(0, s - staminaCosts.parry));
				recordAction({ type: 'parry' });

				// 패링 이펙트
				isParrying = true;
				parryFlashEffect = true;
				parryWindowActive = false;  // 패링 후 윈도우 비활성화
				parryWindowTimer = 0;
				setTimeout(() => { isParrying = false; }, 300);

				return 'parried';
			}

			// 일반 가드 - 방패 이펙트
			shieldBlockEffect = true;
			playerHealth.update(h => Math.max(0, h - amount * 0.3));
			playerStamina.update(s => Math.max(0, s - 15));
			return 'blocked';
		}

		// 그냥 피격 - 히트 이펙트
		hitEffectActive = true;
		playerHealth.update(h => Math.max(0, h - amount));
		return 'hit';
	}

	// 패링 윈도우 활성 여부 (외부에서 확인용)
	export function isParryWindowActive(): boolean {
		return parryWindowActive;
	}

	// 히트 이펙트 트리거 (외부에서 호출)
	export function triggerHitEffect(x: number, y: number, z: number) {
		hitEffectPosition = { x, y, z };
		hitEffectActive = true;
	}

	export function getPosition(): THREE.Vector3 | null {
		if (!rigidBody) return null;
		const pos = rigidBody.translation();
		return new THREE.Vector3(pos.x, pos.y, pos.z);
	}

	export function isInAttackState(): { attacking: boolean; type: 'light' | 'heavy' | null } {
		return { attacking: isAttacking, type: attackType };
	}

	export function getMovementDirection(): { forward: boolean; backward: boolean; left: boolean; right: boolean } {
		return {
			forward: keys.forward,
			backward: keys.backward,
			left: keys.left,
			right: keys.right
		};
	}
</script>

<RigidBody bind:rigidBody position={[0, 1, 8]} linearDamping={5} angularDamping={5} lockRotations enabledRotations={[false, false, false]}>
	<Collider shape="capsule" args={[0.5, 0.4]} mass={1} friction={1} restitution={0} />

	<T.Group bind:ref={playerMesh} rotation.y={playerRotation}>
		<!-- 몸체 (기울기 적용) -->
		<T.Group rotation.x={bodyTilt}>
			<T.Mesh castShadow position.y={0.5}>
				<T.CapsuleGeometry args={[0.4, 1, 8, 16]} />
				<T.MeshStandardMaterial
					color={isDodging ? '#00ff88' : isGuarding ? '#4488ff' : isParrying ? '#ffff00' : '#22c55e'}
					emissive={isParrying ? '#ffff00' : '#000000'}
					emissiveIntensity={isParrying ? 0.5 : 0}
				/>
			</T.Mesh>

			<!-- 머리 -->
			<T.Mesh castShadow position.y={1.4}>
				<T.SphereGeometry args={[0.25, 16, 16]} />
				<T.MeshStandardMaterial color="#22c55e" />
			</T.Mesh>

			<!-- 오른팔 + 무기 (검) -->
			<T.Group position={[0.45, 0.8, 0]}>
				<!-- 어깨 피벗 -->
				<T.Group rotation.x={weaponRotationX} rotation.z={weaponRotationZ}>
					<!-- 팔 -->
					<T.Mesh castShadow position={[0.1, -0.2, 0]}>
						<T.CapsuleGeometry args={[0.08, 0.3, 4, 8]} />
						<T.MeshStandardMaterial color="#22c55e" />
					</T.Mesh>

					<!-- 검 -->
					<T.Group position={[0.1, -0.4, 0]}>
						<!-- 검날 -->
						<T.Mesh castShadow position.y={-0.5}>
							<T.BoxGeometry args={[0.08, 1.0, 0.03]} />
							<T.MeshStandardMaterial
								color={isCharging ? '#ff8800' : isAttacking ? (attackType === 'heavy' ? '#ff4444' : '#ffaa00') : '#aaaaaa'}
								emissive={isCharging ? '#ff4400' : isAttacking ? '#ff4400' : '#000000'}
								emissiveIntensity={isCharging ? 0.8 : isAttacking ? 0.6 : 0}
								metalness={0.8}
								roughness={0.2}
							/>
						</T.Mesh>
						<!-- 검 가드 -->
						<T.Mesh position.y={0.05}>
							<T.BoxGeometry args={[0.25, 0.05, 0.1]} />
							<T.MeshStandardMaterial color="#8B4513" metalness={0.5} />
						</T.Mesh>
						<!-- 손잡이 -->
						<T.Mesh position.y={0.2}>
							<T.CylinderGeometry args={[0.04, 0.04, 0.25, 8]} />
							<T.MeshStandardMaterial color="#4a3728" />
						</T.Mesh>
					</T.Group>
				</T.Group>
			</T.Group>

			<!-- 왼팔 + 방패 -->
			<T.Group position={[-0.45, 0.8, 0]}>
				<!-- 어깨 피벗 -->
				<T.Group rotation.x={isGuarding || isParrying ? -0.3 : 0} rotation.y={shieldRotationY}>
					<!-- 팔 -->
					<T.Mesh castShadow position={[-0.1, -0.2, 0]}>
						<T.CapsuleGeometry args={[0.08, 0.3, 4, 8]} />
						<T.MeshStandardMaterial color="#22c55e" />
					</T.Mesh>

					<!-- 방패 -->
					<T.Mesh castShadow position={[-0.15, -0.3, shieldPositionZ]}>
						<T.BoxGeometry args={[0.08, 0.6, 0.5]} />
						<T.MeshStandardMaterial
							color={isParrying ? '#ffff44' : isGuarding ? '#4488ff' : '#666666'}
							emissive={isParrying ? '#ffff00' : isGuarding ? '#2244aa' : '#000000'}
							emissiveIntensity={isParrying ? 0.8 : isGuarding ? 0.3 : 0}
							metalness={0.3}
						/>
					</T.Mesh>
				</T.Group>
			</T.Group>
		</T.Group>

		<!-- 슬래시 이펙트 (휘두르기 궤적) -->
		{#if slashTrailOpacity > 0}
			<!-- 호 형태의 슬래시 -->
			<T.Group position={[0.5, 0.8, 0]} rotation.z={slashTrailRotation}>
				<!-- 주 슬래시 라인 -->
				<T.Mesh rotation.x={weaponRotationX * 0.5}>
					<T.TorusGeometry args={[0.8 * slashTrailScale, 0.03, 8, 32, Math.PI * 0.8]} />
					<T.MeshBasicMaterial
						color={attackType === 'heavy' ? '#ff4444' : '#ffaa00'}
						transparent
						opacity={slashTrailOpacity * 0.9}
					/>
				</T.Mesh>
				<!-- 외곽 글로우 -->
				<T.Mesh rotation.x={weaponRotationX * 0.5}>
					<T.TorusGeometry args={[0.8 * slashTrailScale, 0.08, 8, 32, Math.PI * 0.8]} />
					<T.MeshBasicMaterial
						color={attackType === 'heavy' ? '#ff6666' : '#ffcc44'}
						transparent
						opacity={slashTrailOpacity * 0.4}
					/>
				</T.Mesh>
				<!-- 내부 밝은 코어 -->
				<T.Mesh rotation.x={weaponRotationX * 0.5}>
					<T.TorusGeometry args={[0.8 * slashTrailScale, 0.015, 8, 32, Math.PI * 0.8]} />
					<T.MeshBasicMaterial
						color="#ffffff"
						transparent
						opacity={slashTrailOpacity * 0.8}
					/>
				</T.Mesh>
			</T.Group>
		{/if}

		<!-- 차징 파티클 -->
		{#each chargeParticles as particle}
			<T.Mesh position={[particle.x, particle.y, particle.z]}>
				<T.SphereGeometry args={[0.05 * particle.life, 8, 8]} />
				<T.MeshBasicMaterial
					color="#ff8800"
					transparent
					opacity={particle.life * 0.8}
				/>
			</T.Mesh>
		{/each}

		<!-- 차징 오라 -->
		{#if isCharging}
			{@const chargeIntensity = Math.min((Date.now() - chargeStartTime) / HEAVY_ATTACK_THRESHOLD, 1)}
			<T.Mesh position={[0, 0.8, 0]}>
				<T.SphereGeometry args={[0.6 + chargeIntensity * 0.4, 16, 16]} />
				<T.MeshBasicMaterial
					color={chargeIntensity > 0.8 ? '#ff4400' : '#ff8800'}
					transparent
					opacity={chargeIntensity * 0.3}
				/>
			</T.Mesh>
			<!-- 회전하는 링 -->
			<T.Mesh position={[0, 0.8, 0]} rotation.x={Date.now() * 0.005} rotation.y={Date.now() * 0.003}>
				<T.TorusGeometry args={[0.5 + chargeIntensity * 0.3, 0.02, 8, 32]} />
				<T.MeshBasicMaterial
					color="#ffaa00"
					transparent
					opacity={chargeIntensity * 0.6}
				/>
			</T.Mesh>
		{/if}

		<!-- 피격 이펙트 -->
		{#if hitEffectActive}
			<T.Group position={[0, 1, 0]}>
				<!-- 히트 플래시 -->
				<T.Mesh>
					<T.SphereGeometry args={[0.8, 16, 16]} />
					<T.MeshBasicMaterial
						color="#ff0000"
						transparent
						opacity={0.4}
					/>
				</T.Mesh>
				<!-- 히트 스파크 -->
				{#each [0, 1, 2, 3, 4, 5] as i}
					<T.Mesh
						position={[
							Math.cos(i * Math.PI / 3) * 0.5,
							Math.sin(i * Math.PI / 3) * 0.3,
							Math.sin(i * Math.PI / 3) * 0.5
						]}
					>
						<T.BoxGeometry args={[0.1, 0.02, 0.02]} />
						<T.MeshBasicMaterial color="#ff6644" />
					</T.Mesh>
				{/each}
			</T.Group>
		{/if}

		<!-- 방패 막기 이펙트 -->
		{#if shieldBlockEffect}
			<T.Group position={[-0.4, 0.8, 0.5]}>
				<T.Mesh>
					<T.RingGeometry args={[0.2, 0.5, 16]} />
					<T.MeshBasicMaterial
						color="#4488ff"
						transparent
						opacity={0.7}
						side={2}
					/>
				</T.Mesh>
				<!-- 방어 스파크 -->
				{#each [0, 1, 2, 3] as i}
					<T.Mesh
						position={[
							Math.cos(i * Math.PI / 2) * 0.3,
							Math.sin(i * Math.PI / 2) * 0.3,
							0.1
						]}
					>
						<T.BoxGeometry args={[0.15, 0.03, 0.03]} />
						<T.MeshBasicMaterial color="#88ccff" />
					</T.Mesh>
				{/each}
			</T.Group>
		{/if}

		<!-- 패링 윈도우 표시 (우클릭 직후 활성화) -->
		{#if parryWindowActive}
			<T.Group position={[0, 1, 0]}>
				<!-- 패링 준비 링 -->
				<T.Mesh rotation.x={Math.PI / 2}>
					<T.RingGeometry args={[0.6, 0.65, 32]} />
					<T.MeshBasicMaterial
						color="#00ffff"
						transparent
						opacity={0.8}
					/>
				</T.Mesh>
				<!-- 회전하는 외곽 링 -->
				<T.Mesh rotation.x={Math.PI / 2} rotation.z={Date.now() * 0.01}>
					<T.RingGeometry args={[0.7, 0.72, 8]} />
					<T.MeshBasicMaterial
						color="#ffffff"
						transparent
						opacity={0.6}
					/>
				</T.Mesh>
			</T.Group>
		{/if}

		<!-- 패링 이펙트 -->
		{#if parryFlashEffect}
			<T.Group position={[-0.4, 0.8, 0.6]}>
				<!-- 패링 폭발 -->
				<T.Mesh>
					<T.SphereGeometry args={[0.6, 16, 16]} />
					<T.MeshBasicMaterial
						color="#ffff00"
						transparent
						opacity={0.5}
					/>
				</T.Mesh>
				<!-- 외곽 링 -->
				<T.Mesh rotation.x={Math.PI / 2}>
					<T.RingGeometry args={[0.4, 0.7, 16]} />
					<T.MeshBasicMaterial
						color="#ffffff"
						transparent
						opacity={0.8}
						side={2}
					/>
				</T.Mesh>
				<!-- 스파크 라인 -->
				{#each [0, 1, 2, 3, 4, 5, 6, 7] as i}
					<T.Mesh
						position={[
							Math.cos(i * Math.PI / 4) * 0.5,
							Math.sin(i * Math.PI / 4) * 0.5,
							0
						]}
						rotation.z={i * Math.PI / 4}
					>
						<T.BoxGeometry args={[0.3, 0.04, 0.04]} />
						<T.MeshBasicMaterial color="#ffffaa" />
					</T.Mesh>
				{/each}
			</T.Group>
		{/if}
	</T.Group>
</RigidBody>
