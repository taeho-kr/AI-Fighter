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
	import HumanoidModel from './HumanoidModel.svelte';

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

	// 휴머노이드 모델용 상태
	let animationTime = $state(0);
	let walkCycle = $state(0);
	let currentAnimState = $state<'idle' | 'walk' | 'run' | 'attack_light' | 'attack_heavy' | 'guard' | 'parry' | 'dodge' | 'stunned' | 'charging'>('idle');
	let chargeIntensity = $state(0);
	let parryAnimProgress = $state(0);
	let parryAnimStartTime = $state(0);
	let dodgeAnimProgress = $state(0);
	let dodgeAnimStartTime = $state(0);
	let currentDodgeDirection = $state<'forward' | 'backward' | 'left' | 'right'>('backward');

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

		// 애니메이션 상태 설정
		currentDodgeDirection = direction;
		dodgeAnimStartTime = Date.now();
		dodgeAnimProgress = 0;

		recordAction({ type: 'dodge', direction });

		setTimeout(() => {
			isDodging = false;
			playerState.set('idle');
			dodgeAnimProgress = 0;
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

	useTask((delta) => {
		if (!rigidBody) return;

		const now = Date.now();
		const deltaMs = now - lastFrameTime;
		lastFrameTime = now;

		// 애니메이션 시간 업데이트
		animationTime += delta;

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

		// 휴머노이드 애니메이션 상태 업데이트
		const isMoving = keys.forward || keys.backward || keys.left || keys.right;
		if (isMoving && !isAttacking && !isDodging && !isGuarding && !isParrying) {
			walkCycle += delta * 8; // 걷기 사이클 진행
			currentAnimState = 'walk';
		}

		// 패링 애니메이션 진행도 업데이트
		if (isParrying && parryAnimStartTime > 0) {
			parryAnimProgress = Math.min(1, (Date.now() - parryAnimStartTime) / 400);
		}

		// 회피 애니메이션 진행도 업데이트
		if (isDodging && dodgeAnimStartTime > 0) {
			dodgeAnimProgress = Math.min(1, (Date.now() - dodgeAnimStartTime) / 400);
		}

		if (isCharging) {
			currentAnimState = 'charging';
			chargeIntensity = Math.min((Date.now() - chargeStartTime) / HEAVY_ATTACK_THRESHOLD, 1);
		} else if (isParrying) {
			currentAnimState = 'parry';
		} else if (isAttacking && attackType === 'light') {
			currentAnimState = 'attack_light';
		} else if (isAttacking && attackType === 'heavy') {
			currentAnimState = 'attack_heavy';
		} else if (isGuarding) {
			currentAnimState = 'guard';
		} else if (isDodging) {
			currentAnimState = 'dodge';
		} else if (!isMoving) {
			currentAnimState = 'idle';
			chargeIntensity = 0;
			parryAnimProgress = 0;
			dodgeAnimProgress = 0;
		}

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
	// 반환값: 'hit' = 피격, 'blocked' = 가드, 'parried' = 패링 성공 (스턴 1.5-2초), 'dodged' = 회피
	export function takeDamage(amount: number): 'hit' | 'blocked' | 'parried' | 'dodged' {
		if (isDodging) return 'dodged'; // 회피 중 무적

		if (isGuarding) {
			// 패링 윈도우가 활성화되어 있으면 패링 성공
			if (parryWindowActive) {
				// 패링 성공! - 적에게 1.5~2초 스턴 (데미지 없음)
				playerStamina.update(s => Math.max(0, s - staminaCosts.parry));
				recordAction({ type: 'parry' });

				// 패링 이펙트 및 애니메이션
				isParrying = true;
				parryFlashEffect = true;
				parryAnimStartTime = Date.now();
				parryAnimProgress = 0;
				parryWindowActive = false;  // 패링 후 윈도우 비활성화
				parryWindowTimer = 0;
				setTimeout(() => { isParrying = false; }, 500);  // 패링 애니메이션 더 길게

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

	// 위치 초기화 (새 라운드 시작 시)
	export function resetPosition() {
		if (!rigidBody) return;
		rigidBody.setTranslation({ x: 0, y: 1, z: 8 }, true);
		rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true);

		// 상태 초기화
		isAttacking = false;
		attackType = null;
		isGuarding = false;
		isDodging = false;
		isParrying = false;
		isCharging = false;
		attackCooldownTimer = 0;
		playerRotation = 0;
		currentAnimState = 'idle';
	}
</script>

<RigidBody bind:rigidBody position={[0, 1, 8]} linearDamping={5} angularDamping={5} lockRotations enabledRotations={[false, false, false]}>
	<Collider shape="capsule" args={[0.5, 0.4]} mass={1} friction={1} restitution={0} />

	<T.Group bind:ref={playerMesh} rotation.y={playerRotation}>
		<!-- 휴머노이드 모델 -->
		<HumanoidModel
			color={isDodging ? '#00ff88' : isGuarding ? '#4488ff' : isParrying ? '#ffff00' : '#22c55e'}
			accentColor={isDodging ? '#00cc66' : isGuarding ? '#3366cc' : '#1a8a4a'}
			height={1.8}
			animationState={currentAnimState}
			animationProgress={
				currentAnimState === 'parry' ? parryAnimProgress :
				currentAnimState === 'dodge' ? dodgeAnimProgress :
				attackProgress
			}
			walkCycle={walkCycle}
			bodyTilt={bodyTilt}
			dodgeDirection={currentDodgeDirection}
			hasWeapon={true}
			hasShield={true}
			weaponType="sword"
			isCharging={isCharging}
			chargeIntensity={chargeIntensity}
			isHit={hitEffectActive}
			time={animationTime}
		/>

		<!-- 슬래시 이펙트 (휘두르기 궤적) - 고급화 -->
		{#if slashTrailOpacity > 0}
			<!-- 호 형태의 슬래시 -->
			<T.Group position={[0.5, 0.8, 0]} rotation.z={slashTrailRotation}>
				<!-- 주 슬래시 라인 -->
				<T.Mesh rotation.x={weaponRotationX * 0.5}>
					<T.TorusGeometry args={[0.8 * slashTrailScale, 0.04, 8, 48, Math.PI * 0.85]} />
					<T.MeshBasicMaterial
						color={attackType === 'heavy' ? '#ff4444' : '#ffaa00'}
						transparent
						opacity={slashTrailOpacity * 0.95}
					/>
				</T.Mesh>
				<!-- 외곽 글로우 (다중 레이어) -->
				<T.Mesh rotation.x={weaponRotationX * 0.5}>
					<T.TorusGeometry args={[0.8 * slashTrailScale, 0.1, 8, 48, Math.PI * 0.85]} />
					<T.MeshBasicMaterial
						color={attackType === 'heavy' ? '#ff6666' : '#ffcc44'}
						transparent
						opacity={slashTrailOpacity * 0.35}
					/>
				</T.Mesh>
				<T.Mesh rotation.x={weaponRotationX * 0.5}>
					<T.TorusGeometry args={[0.8 * slashTrailScale, 0.15, 8, 48, Math.PI * 0.85]} />
					<T.MeshBasicMaterial
						color={attackType === 'heavy' ? '#ff8888' : '#ffdd66'}
						transparent
						opacity={slashTrailOpacity * 0.15}
					/>
				</T.Mesh>
				<!-- 내부 밝은 코어 -->
				<T.Mesh rotation.x={weaponRotationX * 0.5}>
					<T.TorusGeometry args={[0.8 * slashTrailScale, 0.02, 8, 48, Math.PI * 0.85]} />
					<T.MeshBasicMaterial
						color="#ffffff"
						transparent
						opacity={slashTrailOpacity * 0.9}
					/>
				</T.Mesh>
				<!-- 스파크 파티클 -->
				{#each Array(8) as _, i}
					{@const angle = (i / 8) * Math.PI * 0.8}
					{@const sparkR = 0.8 * slashTrailScale}
					<T.Mesh
						position={[
							Math.cos(angle) * sparkR,
							Math.sin(angle) * sparkR * 0.3,
							Math.sin(angle) * sparkR
						]}
					>
						<T.SphereGeometry args={[0.03 * slashTrailOpacity, 6, 6]} />
						<T.MeshBasicMaterial
							color={attackType === 'heavy' ? '#ffff66' : '#ffffff'}
							transparent
							opacity={slashTrailOpacity * 0.8}
						/>
					</T.Mesh>
				{/each}
			</T.Group>

			<!-- 검날 글로우 (공격 시) -->
			<T.PointLight
				position={[0.8, 1.2, 0.3]}
				intensity={slashTrailOpacity * 8}
				color={attackType === 'heavy' ? '#ff4444' : '#ffaa00'}
				distance={3}
			/>
		{/if}

		<!-- 차징 파티클 (고급화) -->
		{#each chargeParticles as particle}
			<T.Mesh position={[particle.x, particle.y, particle.z]}>
				<T.SphereGeometry args={[0.06 * particle.life, 8, 8]} />
				<T.MeshBasicMaterial
					color={particle.life > 0.5 ? '#ff6600' : '#ffaa00'}
					transparent
					opacity={particle.life * 0.9}
				/>
			</T.Mesh>
			<!-- 파티클 트레일 -->
			<T.Mesh position={[particle.x * 0.8, particle.y * 0.8, particle.z * 0.8]}>
				<T.SphereGeometry args={[0.03 * particle.life, 4, 4]} />
				<T.MeshBasicMaterial
					color="#ffcc44"
					transparent
					opacity={particle.life * 0.4}
				/>
			</T.Mesh>
		{/each}

		<!-- 차징 오라 (고급화) -->
		{#if isCharging}
			{@const chargePower = Math.min((Date.now() - chargeStartTime) / HEAVY_ATTACK_THRESHOLD, 1)}
			{@const pulseIntensity = 1 + Math.sin(Date.now() * 0.015) * 0.15}
			<!-- 내부 코어 -->
			<T.Mesh position={[0, 0.8, 0]}>
				<T.SphereGeometry args={[0.3 + chargePower * 0.2, 16, 16]} />
				<T.MeshBasicMaterial
					color={chargePower > 0.8 ? '#ffff00' : '#ffcc00'}
					transparent
					opacity={chargePower * 0.5 * pulseIntensity}
				/>
			</T.Mesh>
			<!-- 외부 오라 -->
			<T.Mesh position={[0, 0.8, 0]}>
				<T.SphereGeometry args={[(0.6 + chargePower * 0.5) * pulseIntensity, 16, 16]} />
				<T.MeshBasicMaterial
					color={chargePower > 0.8 ? '#ff4400' : '#ff8800'}
					transparent
					opacity={chargePower * 0.25}
				/>
			</T.Mesh>
			<!-- 외곽 글로우 -->
			<T.Mesh position={[0, 0.8, 0]}>
				<T.SphereGeometry args={[(0.9 + chargePower * 0.6) * pulseIntensity, 16, 16]} />
				<T.MeshBasicMaterial
					color="#ff6600"
					transparent
					opacity={chargePower * 0.1}
				/>
			</T.Mesh>
			<!-- 다중 회전 링 -->
			<T.Mesh position={[0, 0.8, 0]} rotation.x={Date.now() * 0.005} rotation.y={Date.now() * 0.003}>
				<T.TorusGeometry args={[0.5 + chargePower * 0.35, 0.025, 8, 32]} />
				<T.MeshBasicMaterial
					color="#ffaa00"
					transparent
					opacity={chargePower * 0.7}
				/>
			</T.Mesh>
			<T.Mesh position={[0, 0.8, 0]} rotation.x={Date.now() * -0.004} rotation.z={Date.now() * 0.006}>
				<T.TorusGeometry args={[0.65 + chargePower * 0.3, 0.015, 8, 32]} />
				<T.MeshBasicMaterial
					color="#ff6600"
					transparent
					opacity={chargePower * 0.5}
				/>
			</T.Mesh>
			<!-- 수직 에너지 기둥 -->
			{#if chargePower > 0.5}
				<T.Mesh position={[0, 0.8, 0]}>
					<T.CylinderGeometry args={[0.1 * chargePower, 0.05 * chargePower, 2 * chargePower, 8]} />
					<T.MeshBasicMaterial
						color="#ffaa44"
						transparent
						opacity={(chargePower - 0.5) * 0.4}
					/>
				</T.Mesh>
			{/if}
			<!-- 차징 라이트 -->
			<T.PointLight
				position={[0, 1, 0]}
				intensity={chargePower * 10 * pulseIntensity}
				color={chargePower > 0.8 ? '#ff4400' : '#ff8800'}
				distance={5}
			/>
		{/if}

		<!-- 회피 이펙트 (스피드 라인 & 잔상) -->
		{#if isDodging}
			{@const dodgeProgress = dodgeAnimProgress}
			<!-- 방향별 스피드 라인 -->
			<T.Group position={[0, 0.9, 0]}>
				{#each [0, 1, 2, 3, 4, 5, 6, 7] as i}
					{@const offsetX = currentDodgeDirection === 'left' ? 0.8 : currentDodgeDirection === 'right' ? -0.8 : (Math.random() - 0.5) * 0.4}
					{@const offsetZ = currentDodgeDirection === 'backward' ? 0.8 : currentDodgeDirection === 'forward' ? -0.8 : (Math.random() - 0.5) * 0.4}
					<T.Mesh
						position={[
							offsetX * (0.3 + i * 0.15) * dodgeProgress,
							(i - 4) * 0.15,
							offsetZ * (0.3 + i * 0.15) * dodgeProgress
						]}
						rotation.y={currentDodgeDirection === 'left' ? Math.PI / 2 : currentDodgeDirection === 'right' ? -Math.PI / 2 : currentDodgeDirection === 'forward' ? Math.PI : 0}
					>
						<T.BoxGeometry args={[0.02, 0.03, 0.4 + i * 0.1]} />
						<T.MeshBasicMaterial
							color="#00ffaa"
							transparent
							opacity={(1 - dodgeProgress) * 0.6 * (1 - i * 0.1)}
						/>
					</T.Mesh>
				{/each}
			</T.Group>

			<!-- 잔상 효과 -->
			{#if dodgeProgress > 0.1 && dodgeProgress < 0.8}
				<T.Group
					position={[
						currentDodgeDirection === 'right' ? 0.5 : currentDodgeDirection === 'left' ? -0.5 : 0,
						0,
						currentDodgeDirection === 'forward' ? 0.5 : currentDodgeDirection === 'backward' ? -0.5 : 0
					]}
					scale={[0.9, 0.9, 0.9]}
				>
					<T.Mesh position.y={0.9}>
						<T.CapsuleGeometry args={[0.35, 0.8, 4, 8]} />
						<T.MeshBasicMaterial color="#00ff88" transparent opacity={0.3 * (1 - dodgeProgress)} />
					</T.Mesh>
				</T.Group>
			{/if}

			<!-- 바닥 먼지 이펙트 -->
			<T.Group position={[0, 0.1, 0]}>
				{#each [0, 1, 2, 3] as i}
					<T.Mesh
						position={[
							Math.cos(i * Math.PI / 2 + animationTime * 3) * (0.3 + dodgeProgress * 0.5),
							dodgeProgress * 0.2,
							Math.sin(i * Math.PI / 2 + animationTime * 3) * (0.3 + dodgeProgress * 0.5)
						]}
					>
						<T.SphereGeometry args={[0.08 * (1 - dodgeProgress), 6, 6]} />
						<T.MeshBasicMaterial color="#aaaaaa" transparent opacity={0.4 * (1 - dodgeProgress)} />
					</T.Mesh>
				{/each}
			</T.Group>
		{/if}

		<!-- 피격 이펙트 (고급화) -->
		{#if hitEffectActive}
			<T.Group position={[0, 1, 0]}>
				<!-- 히트 플래시 (다중 레이어) -->
				<T.Mesh>
					<T.SphereGeometry args={[0.5, 16, 16]} />
					<T.MeshBasicMaterial
						color="#ffffff"
						transparent
						opacity={0.6}
					/>
				</T.Mesh>
				<T.Mesh>
					<T.SphereGeometry args={[0.8, 16, 16]} />
					<T.MeshBasicMaterial
						color="#ff4444"
						transparent
						opacity={0.4}
					/>
				</T.Mesh>
				<T.Mesh>
					<T.SphereGeometry args={[1.2, 16, 16]} />
					<T.MeshBasicMaterial
						color="#ff0000"
						transparent
						opacity={0.15}
					/>
				</T.Mesh>
				<!-- 방사형 스파크 -->
				{#each Array(12) as _, i}
					{@const angle = (i / 12) * Math.PI * 2}
					{@const length = 0.3 + Math.random() * 0.4}
					<T.Mesh
						position={[
							Math.cos(angle) * 0.4,
							(Math.random() - 0.5) * 0.4,
							Math.sin(angle) * 0.4
						]}
						rotation.z={angle}
					>
						<T.BoxGeometry args={[length, 0.025, 0.025]} />
						<T.MeshBasicMaterial color={i % 2 === 0 ? '#ff6644' : '#ffaa44'} />
					</T.Mesh>
				{/each}
				<!-- 히트 라이트 -->
				<T.PointLight
					position={[0, 0, 0]}
					intensity={15}
					color="#ff4444"
					distance={4}
				/>
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

		<!-- 패링 이펙트 (고급화) -->
		{#if parryFlashEffect}
			<T.Group position={[-0.4, 0.8, 0.6]}>
				<!-- 패링 코어 플래시 -->
				<T.Mesh>
					<T.SphereGeometry args={[0.3, 16, 16]} />
					<T.MeshBasicMaterial
						color="#ffffff"
						transparent
						opacity={0.9}
					/>
				</T.Mesh>
				<!-- 패링 폭발 (다중 레이어) -->
				<T.Mesh>
					<T.SphereGeometry args={[0.6, 16, 16]} />
					<T.MeshBasicMaterial
						color="#ffff00"
						transparent
						opacity={0.5}
					/>
				</T.Mesh>
				<T.Mesh>
					<T.SphereGeometry args={[0.9, 16, 16]} />
					<T.MeshBasicMaterial
						color="#ffcc00"
						transparent
						opacity={0.2}
					/>
				</T.Mesh>
				<!-- 확장 충격파 링 -->
				<T.Mesh rotation.x={Math.PI / 2}>
					<T.RingGeometry args={[0.8, 1.0, 32]} />
					<T.MeshBasicMaterial
						color="#ffffff"
						transparent
						opacity={0.7}
						side={2}
					/>
				</T.Mesh>
				<T.Mesh rotation.x={Math.PI / 2}>
					<T.RingGeometry args={[0.5, 0.65, 32]} />
					<T.MeshBasicMaterial
						color="#ffff88"
						transparent
						opacity={0.9}
						side={2}
					/>
				</T.Mesh>
				<!-- 방사형 스파크 라인 -->
				{#each Array(12) as _, i}
					{@const angle = (i / 12) * Math.PI * 2}
					{@const length = 0.4 + (i % 2) * 0.2}
					<T.Mesh
						position={[
							Math.cos(angle) * 0.3,
							Math.sin(angle) * 0.3,
							0
						]}
						rotation.z={angle}
					>
						<T.BoxGeometry args={[length, 0.05, 0.05]} />
						<T.MeshBasicMaterial color={i % 3 === 0 ? '#ffffff' : '#ffff88'} />
					</T.Mesh>
				{/each}
				<!-- 패링 파티클 -->
				{#each Array(8) as _, i}
					{@const pAngle = (i / 8) * Math.PI * 2}
					<T.Mesh
						position={[
							Math.cos(pAngle) * 0.6,
							Math.sin(pAngle) * 0.6,
							(Math.random() - 0.5) * 0.3
						]}
					>
						<T.SphereGeometry args={[0.05, 6, 6]} />
						<T.MeshBasicMaterial color="#ffff00" />
					</T.Mesh>
				{/each}
				<!-- 패링 라이트 -->
				<T.PointLight
					position={[0, 0, 0]}
					intensity={25}
					color="#ffff44"
					distance={6}
				/>
			</T.Group>
		{/if}
	</T.Group>
</RigidBody>
