<script lang="ts">
	import { T } from '@threlte/core';
	import { getSharedTextures } from '$lib/textures/sharedTextures';

	// Props
	let {
		// 기본 속성
		color = '#22c55e',
		accentColor = '#1a8a4a',
		height = 1.8,

		// 애니메이션 상태
		animationState = 'idle' as 'idle' | 'walk' | 'run' | 'attack_light' | 'attack_heavy' | 'guard' | 'parry' | 'dodge' | 'stunned' | 'charging',
		animationProgress = 0, // 0-1 현재 애니메이션 진행도

		// 추가 애니메이션 파라미터
		walkCycle = 0, // 걷기 사이클 (라디안)
		bodyTilt = 0,
		dodgeDirection = 'backward' as 'forward' | 'backward' | 'left' | 'right',

		// 무기 관련
		hasWeapon = true,
		hasShield = false,
		weaponType = 'sword' as 'sword' | 'axe',

		// 이펙트
		isCharging = false,
		chargeIntensity = 0,
		isHit = false,
		isStunned = false,

		// 시간 (procedural animation용)
		time = 0
	} = $props();

	// 스케일 계산
	let scale = $derived(height / 1.8);

	// 캐싱된 공유 텍스처 사용
	const { bodyTexture, accentTexture, armorNormalMap, metalRoughnessMap, bladeTexture } =
		getSharedTextures(color, accentColor);

	// 이징 함수들
	function easeOutBack(x: number): number {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
	}

	function easeInQuad(x: number): number {
		return x * x;
	}

	function easeOutQuad(x: number): number {
		return 1 - (1 - x) * (1 - x);
	}

	function easeOutElastic(x: number): number {
		const c4 = (2 * Math.PI) / 3;
		return x === 0 ? 0 : x === 1 ? 1 :
			Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
	}

	// 부드러운 보간 함수
	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	// 관절 포즈 계산 (직접 $derived로 계산)
	let joints = $derived.by(() => {
		const breathIntensity = animationState === 'idle' ? 1.0 :
			(animationState === 'walk' ? 0.7 : 0.4);

		// 호흡
		const breathe = Math.sin(time * 2) * 0.01 * breathIntensity;

		// 미세한 체중 이동
		const weightShift = Math.sin(time * 0.8) * 0.005;
		const microSway = Math.sin(time * 1.2) * 0.006 + Math.cos(time * 0.7) * 0.004;

		// 머리 미세 움직임 (시선 이동 시뮬레이션)
		const headMicro = {
			x: Math.sin(time * 0.3) * 0.02,
			y: Math.sin(time * 0.5) * 0.03,
			z: Math.sin(time * 0.4) * 0.015
		};

		// ========== 기본 자세: 검과 방패를 든 전투 대기 자세 ==========
		// 검은 오른손에 자연스럽게, 방패는 왼손에 몸을 보호하도록
		let pose = {
			// 척추: 살짝 앞으로 기울인 전투 자세 + 호흡 + 체중이동
			spine: { x: 0.08 + breathe, y: microSway + weightShift, z: weightShift * 0.5 },
			chest: { x: 0.05 + breathe * 0.7, y: microSway * 0.5, z: 0 },
			neck: { x: -0.05 + headMicro.x, y: headMicro.y, z: headMicro.z }, // 앞을 주시 + 미세 움직임

			// 오른팔 (검): 자연스럽게 아래로, 검끝이 앞을 향함 + 미세 떨림
			rightShoulder: { x: 0.3 + breathe * 0.3, y: -0.1 + microSway * 0.2, z: -0.25 },
			rightElbow: { x: 0.4 + breathe * 0.2, y: 0, z: 0 },
			rightWrist: { x: Math.sin(time * 1.5) * 0.02, y: 0, z: 0 },

			// 왼팔 (방패): 몸 앞쪽에서 보호
			leftShoulder: { x: 0.2 + breathe * 0.2, y: 0.15 + microSway * 0.15, z: 0.5 },
			leftElbow: { x: 0.7 + breathe * 0.15, y: 0, z: 0 },
			leftWrist: { x: 0, y: 0, z: 0 },

			// 다리: 전투 스탠스 (살짝 벌리고 무릎 굽힘) + 체중 이동
			rightHip: { x: 0.05 + weightShift * 0.3, y: 0, z: -0.08 },
			rightKnee: { x: 0.15 + Math.abs(weightShift) * 0.2, y: 0, z: 0 },
			rightAnkle: { x: weightShift * 0.1, y: 0, z: 0 },

			leftHip: { x: -0.1 - weightShift * 0.3, y: 0, z: 0.08 },
			leftKnee: { x: 0.2 + Math.abs(weightShift) * 0.2, y: 0, z: 0 },
			leftAnkle: { x: -weightShift * 0.1, y: 0, z: 0 }
		};

		// ========== 걷기/달리기: 자연스러운 인간 보행 ==========
		if (animationState === 'walk' || animationState === 'run') {
			const isRunning = animationState === 'run';
			const intensity = isRunning ? 1.2 : 0.7;
			const cycle = walkCycle;

			// 기본 사이클 (0~2π)
			const sinCycle = Math.sin(cycle);
			const cosCycle = Math.cos(cycle);

			// ===== 다리 움직임 (인간 보행의 핵심) =====
			// 오른다리: cycle=0일 때 앞으로 뻗음, cycle=π일 때 뒤로
			// 왼다리: 반대 위상 (cycle+π)

			// 힙 굴곡/신전 (앞뒤 스윙)
			const rightLegPhase = cycle;
			const leftLegPhase = cycle + Math.PI;

			// 스윙 단계 (발이 공중에 있을 때)와 지지 단계 분리
			const rightSwing = Math.sin(rightLegPhase);
			const leftSwing = Math.sin(leftLegPhase);

			// 힙 굴곡 (다리를 앞으로 들어올릴 때 양수)
			pose.rightHip.x = rightSwing * 0.35 * intensity;
			pose.leftHip.x = leftSwing * 0.35 * intensity;

			// 무릎 굽힘: 스윙 단계에서 더 굽힘 (발이 지면에 걸리지 않도록)
			// 발이 앞으로 갈 때(swing phase) 무릎이 굽혀짐
			const rightKneeBend = Math.max(0, Math.sin(rightLegPhase + 0.5)) * 0.6;
			const leftKneeBend = Math.max(0, Math.sin(leftLegPhase + 0.5)) * 0.6;
			pose.rightKnee.x = 0.1 + rightKneeBend * intensity;
			pose.leftKnee.x = 0.1 + leftKneeBend * intensity;

			// 발목: 발 들어올릴 때 발끝 올림, 착지 시 발뒤꿈치부터
			const rightAnkleFlex = Math.sin(rightLegPhase + 0.8) * 0.25;
			const leftAnkleFlex = Math.sin(leftLegPhase + 0.8) * 0.25;
			pose.rightAnkle.x = rightAnkleFlex * intensity;
			pose.leftAnkle.x = leftAnkleFlex * intensity;

			// ===== 골반 움직임 =====
			// 골반 회전 (걸을 때 앞으로 나가는 다리 쪽으로 회전)
			pose.spine.y = sinCycle * 0.08 * intensity;

			// 골반 기울기 (지지하는 다리 쪽으로 살짝 기울어짐)
			const pelvisTilt = cosCycle * 0.04 * intensity;
			pose.spine.z = pelvisTilt;

			// 수직 바운스 (양발이 지면에 닿을 때 = cycle의 2배 주기)
			const verticalBounce = Math.abs(Math.sin(cycle * 2)) * 0.03 * intensity;
			pose.spine.x = 0.05 + verticalBounce;

			// ===== 상체 카운터 로테이션 =====
			// 상체는 골반과 반대 방향으로 회전 (균형 유지)
			pose.chest.y = -sinCycle * 0.06 * intensity;
			pose.chest.x = 0.03 + verticalBounce * 0.5;

			// 머리 안정화 (상체 회전 상쇄)
			pose.neck.y = sinCycle * 0.03 * intensity;

			// ===== 팔 스윙 (다리와 반대) =====
			// 오른팔은 왼다리와 같은 위상, 왼팔은 오른다리와 같은 위상
			const rightArmSwing = Math.sin(leftLegPhase); // 왼다리와 동기화
			const leftArmSwing = Math.sin(rightLegPhase); // 오른다리와 동기화

			// 어깨 굴곡/신전
			pose.rightShoulder.x = 0.2 + rightArmSwing * 0.25 * intensity;
			pose.leftShoulder.x = 0.15 + leftArmSwing * 0.2 * intensity;

			// 팔꿈치: 팔이 뒤로 갈 때 살짝 더 굽힘
			pose.rightElbow.x = 0.3 + Math.max(0, -rightArmSwing) * 0.2 * intensity;
			pose.leftElbow.x = 0.5 + Math.max(0, -leftArmSwing) * 0.15 * intensity;

			// 달릴 때 추가 동작
			if (isRunning) {
				// 더 높은 무릎 들어올리기
				pose.rightHip.x += Math.max(0, rightSwing) * 0.15;
				pose.leftHip.x += Math.max(0, leftSwing) * 0.15;

				// 더 강한 팔 스윙
				pose.rightShoulder.x += rightArmSwing * 0.1;
				pose.leftShoulder.x += leftArmSwing * 0.08;

				// 몸 앞으로 기울임
				pose.spine.x += 0.1;
				pose.chest.x += 0.08;
			}

			// 힙 좌우 움직임 (체중 이동)
			pose.rightHip.z = -0.08 + cosCycle * 0.04 * intensity;
			pose.leftHip.z = 0.08 - cosCycle * 0.04 * intensity;
		}

		// ========== 약공격: 빠른 찌르기 (츠키) ==========
		if (animationState === 'attack_light') {
			const p = animationProgress;

			if (p < 0.12) {
				// 준비: 검을 약간 뒤로 당김
				const t = p / 0.12;
				pose.rightShoulder.x = 0.3 - 0.15 * t;
				pose.rightShoulder.z = -0.25 - 0.1 * t;
				pose.rightElbow.x = 0.4 + 0.2 * t;
				pose.spine.y = 0.05 * t;
			} else if (p < 0.35) {
				// 찌르기: 팔을 앞으로 뻗음
				const t = easeOutQuad((p - 0.12) / 0.23);
				pose.rightShoulder.x = 0.15 + 0.6 * t;
				pose.rightShoulder.z = -0.35 + 0.15 * t;
				pose.rightElbow.x = 0.6 - 0.5 * t; // 팔 펴기
				pose.spine.y = 0.05 - 0.1 * t;
				pose.spine.x = 0.08 + 0.12 * t; // 앞으로 기울임
				pose.leftHip.x = -0.1 + 0.2 * t; // 왼발 앞으로
				pose.leftKnee.x = 0.2 + 0.15 * t;
			} else if (p < 0.55) {
				// 유지
				pose.rightShoulder.x = 0.75;
				pose.rightShoulder.z = -0.2;
				pose.rightElbow.x = 0.1;
				pose.spine.y = -0.05;
				pose.spine.x = 0.2;
				pose.leftHip.x = 0.1;
				pose.leftKnee.x = 0.35;
			} else {
				// 복귀
				const t = easeOutQuad((p - 0.55) / 0.45);
				pose.rightShoulder.x = lerp(0.75, 0.3, t);
				pose.rightShoulder.z = lerp(-0.2, -0.25, t);
				pose.rightElbow.x = lerp(0.1, 0.4, t);
				pose.spine.y = lerp(-0.05, 0, t);
				pose.spine.x = lerp(0.2, 0.08, t);
				pose.leftHip.x = lerp(0.1, -0.1, t);
				pose.leftKnee.x = lerp(0.35, 0.2, t);
			}
		}

		// ========== 강공격: 내려베기 (멘) ==========
		if (animationState === 'attack_heavy') {
			const p = animationProgress;

			if (p < 0.25) {
				// 검 들어올리기 (후리카부리)
				const t = easeOutQuad(p / 0.25);
				pose.rightShoulder.x = 0.3 - 1.8 * t; // 머리 위로
				pose.rightShoulder.z = -0.25;
				pose.rightElbow.x = 0.4 - 0.2 * t;
				pose.spine.x = 0.08 - 0.15 * t; // 살짝 뒤로
				pose.rightKnee.x = 0.15 + 0.1 * t;
				pose.leftKnee.x = 0.2 + 0.1 * t;
			} else if (p < 0.45) {
				// 내려베기 (키리오로시)
				const t = easeInQuad((p - 0.25) / 0.2);
				pose.rightShoulder.x = -1.5 + 2.3 * t;
				pose.rightShoulder.z = -0.25;
				pose.rightElbow.x = 0.2 + 0.3 * t;
				pose.spine.x = -0.07 + 0.35 * t; // 앞으로 숙임
				pose.leftHip.x = -0.1 + 0.25 * t;
				pose.leftKnee.x = 0.3 + 0.2 * t;
			} else if (p < 0.6) {
				// 베기 완료 후 정지
				const t = (p - 0.45) / 0.15;
				pose.rightShoulder.x = 0.8 + 0.1 * t;
				pose.rightElbow.x = 0.5;
				pose.spine.x = 0.28 + 0.05 * t;
				pose.leftHip.x = 0.15;
				pose.leftKnee.x = 0.5;
			} else {
				// 복귀 (잔신) - 자세를 유지하며 천천히 기본으로
				const t = easeOutQuad((p - 0.6) / 0.4);
				pose.rightShoulder.x = lerp(0.9, 0.3, t);
				pose.rightShoulder.z = lerp(-0.25, -0.25, t);
				pose.rightElbow.x = lerp(0.5, 0.4, t);
				pose.spine.x = lerp(0.33, 0.08, t);
				pose.chest.x = lerp(0.15, 0.05, t);
				pose.leftHip.x = lerp(0.15, -0.1, t);
				pose.leftKnee.x = lerp(0.5, 0.2, t);
				pose.rightKnee.x = lerp(0.25, 0.15, t);
			}
		}

		// ========== 가드 (방패를 앞으로 크게 내밀기) ==========
		if (animationState === 'guard') {
			const shieldVibrate = isHit ? Math.sin(time * 30) * 0.08 * Math.exp(-(time % 1) * 5) : 0;
			const breatheGuard = Math.sin(time * 2) * 0.02;

			// 왼팔 (방패): 앞으로 크게 내밀어 몸을 보호
			pose.leftShoulder.x = -0.8 + breatheGuard;  // 앞으로 더 내밈
			pose.leftShoulder.y = 0.2;
			pose.leftShoulder.z = 1.2 + shieldVibrate;  // 몸 앞으로 크게
			pose.leftElbow.x = 0.8;  // 팔꿈치 살짝 굽힘
			pose.leftWrist.x = -0.3;

			// 오른팔 (검): 방패 뒤에서 반격 준비
			pose.rightShoulder.x = -0.8;
			pose.rightShoulder.z = -0.5;
			pose.rightElbow.x = 1.0;

			// 몸: 방패 뒤로 웅크리기
			pose.spine.x = 0.25;
			pose.spine.z = 0.15;  // 방패쪽으로 기울임
			pose.chest.x = 0.2;

			// 다리: 넓은 스탠스, 안정적
			pose.rightKnee.x = 0.4;
			pose.leftKnee.x = 0.4;
			pose.rightHip.z = -0.15;
			pose.leftHip.z = 0.15;
			pose.rightHip.x = 0.1;
			pose.leftHip.x = 0.15;
		}

		// ========== 패링 (방패로 적의 공격을 튕겨내기) ==========
		if (animationState === 'parry') {
			const p = animationProgress;

			if (p < 0.15) {
				// 준비: 방패를 살짝 뒤로 당김 (힘 모으기)
				const prep = easeInQuad(p / 0.15);
				pose.leftShoulder.x = -0.6 - 0.3 * prep;
				pose.leftShoulder.y = 0.2 * prep;
				pose.leftShoulder.z = 1.0 - 0.3 * prep;  // 살짝 뒤로
				pose.leftElbow.x = 0.9 + 0.3 * prep;
				pose.spine.z = 0.1 - 0.15 * prep;
				pose.chest.y = -0.1 * prep;
				pose.rightKnee.x = 0.2 * prep;
				pose.leftKnee.x = 0.3 * prep;
			} else if (p < 0.4) {
				// 튕겨내기: 방패를 폭발적으로 앞으로 밀기
				const push = easeOutBack((p - 0.15) / 0.25);
				pose.leftShoulder.x = -0.9 + 0.3 * push;
				pose.leftShoulder.y = 0.2 + 0.4 * push;
				pose.leftShoulder.z = 0.7 + 1.0 * push;  // 앞으로 크게
				pose.leftElbow.x = 1.2 - 0.8 * push;  // 팔 펴기
				pose.leftWrist.x = 0.4 * push;

				// 온몸으로 밀기
				pose.spine.z = -0.05 + 0.25 * push;
				pose.spine.x = 0.15 * push;
				pose.chest.y = -0.1 + 0.35 * push;
				pose.chest.x = 0.1 * push;

				// 앞발로 체중 이동
				pose.leftHip.x = 0.35 * push;
				pose.leftKnee.x = 0.3 + 0.2 * push;
				pose.rightHip.x = -0.1 * push;
			} else {
				// 반동 회복 (탄성 효과)
				const recoil = easeOutElastic((p - 0.4) / 0.6);
				pose.leftShoulder.x = lerp(-0.6, -0.5, recoil);
				pose.leftShoulder.y = lerp(0.6, 0.1, recoil);
				pose.leftShoulder.z = lerp(1.7, 0.8, recoil);
				pose.leftElbow.x = lerp(0.4, 0.6, recoil);
				pose.leftWrist.x = lerp(0.4, 0, recoil);

				pose.spine.z = lerp(0.2, 0, recoil);
				pose.spine.x = lerp(0.15, 0, recoil);
				pose.chest.y = lerp(0.25, 0, recoil);

				pose.leftHip.x = lerp(0.35, 0, recoil);
				pose.leftKnee.x = lerp(0.5, 0.1, recoil);
			}

			// 오른팔 (검): 반격 준비 자세
			pose.rightShoulder.x = -0.5;
			pose.rightShoulder.z = -0.6;
			pose.rightElbow.x = 0.8;
		}

		// ========== 회피 ==========
		if (animationState === 'dodge') {
			const p = animationProgress;

			if (dodgeDirection === 'backward') {
				if (p < 0.2) {
					const crouch = easeInQuad(p / 0.2);
					pose.rightKnee.x = 0.6 * crouch;
					pose.leftKnee.x = 0.6 * crouch;
					pose.spine.x = 0.15 * crouch;
					pose.rightHip.x = 0.2 * crouch;
					pose.leftHip.x = 0.2 * crouch;
				} else if (p < 0.6) {
					const jump = (p - 0.2) / 0.4;
					const arc = Math.sin(jump * Math.PI);
					const lean = easeOutQuad(jump);

					pose.spine.x = 0.15 - 0.6 * lean;
					pose.chest.x = -0.3 * lean;
					pose.rightKnee.x = 0.6 - 0.3 * arc;
					pose.leftKnee.x = 0.6 - 0.3 * arc;
					pose.rightHip.x = 0.2 - 0.6 * arc;
					pose.leftHip.x = 0.2 + 0.4 * arc;
					pose.rightShoulder.x = 0.6 * arc;
					pose.rightShoulder.z = -0.3 - 0.4 * arc;
					pose.leftShoulder.x = 0.6 * arc;
					pose.leftShoulder.z = 0.3 + 0.4 * arc;
				} else {
					const land = easeOutQuad((p - 0.6) / 0.4);
					pose.spine.x = lerp(-0.45, 0, land);
					pose.chest.x = lerp(-0.3, 0, land);
					pose.rightKnee.x = lerp(0.7, 0, land);
					pose.leftKnee.x = lerp(0.7, 0, land);
					pose.rightHip.x = lerp(-0.4, 0, land);
					pose.leftHip.x = lerp(0.6, 0, land);
				}
			} else if (dodgeDirection === 'forward') {
				if (p < 0.2) {
					const duck = easeInQuad(p / 0.2);
					pose.spine.x = 0.9 * duck;
					pose.chest.x = 0.6 * duck;
					pose.neck.x = 0.4 * duck;
					pose.rightKnee.x = 0.7 * duck;
					pose.leftKnee.x = 0.7 * duck;
				} else if (p < 0.65) {
					const roll = (p - 0.2) / 0.45;
					const rollAngle = roll * Math.PI;

					pose.spine.x = 0.9 + Math.sin(rollAngle) * 0.9;
					pose.chest.x = 0.6 + Math.sin(rollAngle) * 0.7;
					pose.neck.x = 0.4 + Math.sin(rollAngle) * 0.5;
					pose.rightHip.x = 0.9 * Math.sin(rollAngle);
					pose.leftHip.x = 0.9 * Math.sin(rollAngle);
					pose.rightKnee.x = 0.7 + 0.9 * Math.sin(rollAngle);
					pose.leftKnee.x = 0.7 + 0.9 * Math.sin(rollAngle);
					pose.rightShoulder.z = -0.9;
					pose.rightShoulder.x = 1.0 * Math.sin(rollAngle);
					pose.rightElbow.x = 1.4;
					pose.leftShoulder.z = 0.9;
					pose.leftShoulder.x = 1.0 * Math.sin(rollAngle);
					pose.leftElbow.x = 1.4;
				} else {
					const rise = easeOutQuad((p - 0.65) / 0.35);
					pose.spine.x = lerp(1.8, 0, rise);
					pose.chest.x = lerp(1.3, 0, rise);
					pose.neck.x = lerp(0.9, 0, rise);
					pose.rightKnee.x = lerp(1.6, 0, rise);
					pose.leftKnee.x = lerp(1.6, 0, rise);
					pose.rightHip.x = lerp(0.9, 0, rise);
					pose.leftHip.x = lerp(0.9, 0, rise);
				}
			} else if (dodgeDirection === 'left') {
				if (p < 0.25) {
					const lean = easeInQuad(p / 0.25);
					pose.spine.z = 0.6 * lean;
					pose.chest.z = 0.4 * lean;
					pose.rightHip.z = -0.35 * lean;
					pose.leftHip.z = 0.35 * lean;
					pose.rightKnee.x = 0.45 * lean;
				} else if (p < 0.7) {
					const roll = (p - 0.25) / 0.45;
					const rollAngle = roll * Math.PI;

					pose.spine.z = 0.6 + Math.sin(rollAngle) * 1.2;
					pose.spine.x = Math.sin(rollAngle) * 0.6;
					pose.chest.z = 0.4 + Math.sin(rollAngle) * 0.7;
					pose.rightHip.z = -0.35 - Math.sin(rollAngle) * 0.6;
					pose.rightHip.x = Math.sin(rollAngle) * 0.7;
					pose.leftHip.z = 0.35 + Math.sin(rollAngle) * 0.35;
					pose.rightKnee.x = 0.45 + Math.sin(rollAngle) * 0.6;
					pose.rightShoulder.x = Math.sin(rollAngle) * 0.9;
					pose.rightShoulder.z = -0.5 - Math.sin(rollAngle) * 0.6;
					pose.leftShoulder.z = 0.35 + Math.sin(rollAngle) * 0.9;
				} else {
					const recover = easeOutQuad((p - 0.7) / 0.3);
					pose.spine.z = lerp(1.8, 0, recover);
					pose.spine.x = lerp(0.6, 0, recover);
					pose.chest.z = lerp(1.1, 0, recover);
					pose.rightHip.z = lerp(-0.95, 0, recover);
					pose.rightHip.x = lerp(0.7, 0, recover);
					pose.rightKnee.x = lerp(1.05, 0, recover);
				}
			} else if (dodgeDirection === 'right') {
				if (p < 0.25) {
					const lean = easeInQuad(p / 0.25);
					pose.spine.z = -0.6 * lean;
					pose.chest.z = -0.4 * lean;
					pose.rightHip.z = 0.35 * lean;
					pose.leftHip.z = -0.35 * lean;
					pose.leftKnee.x = 0.45 * lean;
				} else if (p < 0.7) {
					const roll = (p - 0.25) / 0.45;
					const rollAngle = roll * Math.PI;

					pose.spine.z = -0.6 - Math.sin(rollAngle) * 1.2;
					pose.spine.x = Math.sin(rollAngle) * 0.6;
					pose.chest.z = -0.4 - Math.sin(rollAngle) * 0.7;
					pose.leftHip.z = -0.35 - Math.sin(rollAngle) * 0.6;
					pose.leftHip.x = Math.sin(rollAngle) * 0.7;
					pose.rightHip.z = 0.35 + Math.sin(rollAngle) * 0.35;
					pose.leftKnee.x = 0.45 + Math.sin(rollAngle) * 0.6;
					pose.leftShoulder.x = Math.sin(rollAngle) * 0.9;
					pose.leftShoulder.z = 0.5 + Math.sin(rollAngle) * 0.6;
					pose.rightShoulder.z = -0.35 - Math.sin(rollAngle) * 0.9;
				} else {
					const recover = easeOutQuad((p - 0.7) / 0.3);
					pose.spine.z = lerp(-1.8, 0, recover);
					pose.spine.x = lerp(0.6, 0, recover);
					pose.chest.z = lerp(-1.1, 0, recover);
					pose.leftHip.z = lerp(-0.95, 0, recover);
					pose.leftHip.x = lerp(0.7, 0, recover);
					pose.leftKnee.x = lerp(1.05, 0, recover);
				}
			}
		}

		// ========== 스턴 ==========
		if (animationState === 'stunned' || isStunned) {
			const wobble = Math.sin(time * 3.5);
			const wobble2 = Math.cos(time * 2.8);
			const wobble3 = Math.sin(time * 4.2);

			pose.spine.x = 0.3 + wobble * 0.18;
			pose.spine.z = wobble2 * 0.25;
			pose.spine.y = wobble3 * 0.12;
			pose.neck.x = 0.2 + wobble2 * 0.12;
			pose.neck.z = wobble * 0.18;
			pose.chest.x = 0.15 + wobble * 0.08;
			pose.rightShoulder.x = 0.25 + wobble * 0.1;
			pose.rightShoulder.z = -0.4 + wobble2 * 0.25;
			pose.rightElbow.x = 0.35 + wobble3 * 0.15;
			pose.leftShoulder.x = 0.25 + wobble2 * 0.1;
			pose.leftShoulder.z = 0.4 + wobble * 0.25;
			pose.leftElbow.x = 0.35 + wobble * 0.15;
			pose.rightKnee.x = 0.25 + wobble * 0.12;
			pose.leftKnee.x = 0.25 + wobble2 * 0.12;
			pose.rightHip.z = wobble3 * 0.08;
			pose.leftHip.z = -wobble3 * 0.08;
		}

		// ========== 차징 ==========
		if (animationState === 'charging' || isCharging) {
			const intensity = chargeIntensity;
			const tremble = Math.sin(time * 25) * 0.04 * intensity;
			const tremble2 = Math.cos(time * 28) * 0.03 * intensity;

			pose.rightShoulder.x = -1.8 - intensity * 0.7 + tremble;
			pose.rightShoulder.z = -0.4 - intensity * 0.25 + tremble2;
			pose.rightShoulder.y = tremble2 * 0.5;
			pose.rightElbow.x = -0.3 - intensity * 0.3;
			pose.spine.x = -0.2 * intensity + tremble * 0.5;
			pose.spine.y = -0.08 * intensity;
			pose.chest.x = -0.15 * intensity;
			pose.chest.y = -0.12 * intensity + tremble2 * 0.3;
			pose.rightKnee.x = 0.15 * intensity;
			pose.leftKnee.x = 0.15 * intensity;
			pose.leftShoulder.x = 0.3 * intensity;
			pose.leftShoulder.z = 0.5 + 0.2 * intensity;
		}

		// bodyTilt 적용
		pose.spine.x += bodyTilt;

		return pose;
	});

	// 색상 계산
	let bodyColor = $derived(isHit ? '#ff4444' : color);
	let emissiveColor = $derived(isHit ? '#ff0000' : (isCharging ? '#ff8800' : '#000000'));
	let emissiveIntensity = $derived(isHit ? 0.5 : (isCharging ? chargeIntensity * 0.5 : 0));

	// 재질 속성 (고급 PBR)
	let bodyMetalness = $derived(0.3 + (isCharging ? chargeIntensity * 0.2 : 0));
	let bodyRoughness = $derived(isHit ? 0.3 : 0.6);
	let accentMetalness = 0.4;
	let accentRoughness = 0.5;

	// 애니메이션 상태에 따른 재질 변화
	let materialPulse = $derived(
		animationState === 'charging' ? Math.sin(time * 10) * 0.1 : 0
	);
</script>

<T.Group scale={[scale, scale, scale]}>
	<!-- 골반 (루트) -->
	<T.Group position.y={0.95}>
		<!-- 척추 -->
		<T.Group rotation.x={joints.spine.x} rotation.y={joints.spine.y} rotation.z={joints.spine.z}>
			<!-- 하체 (골반) -->
			<T.Mesh castShadow>
				<T.BoxGeometry args={[0.35, 0.15, 0.2]} />
				<T.MeshStandardMaterial
					map={accentTexture}
					normalMap={armorNormalMap}
					roughnessMap={metalRoughnessMap}
					color={accentColor}
					metalness={accentMetalness}
					roughness={accentRoughness}
				/>
			</T.Mesh>

			<!-- 상체 (흉부) -->
			<T.Group position.y={0.25} rotation.x={joints.chest.x} rotation.y={joints.chest.y} rotation.z={joints.chest.z}>
				<!-- 몸통 -->
				<T.Mesh castShadow position.y={0.2}>
					<T.BoxGeometry args={[0.4, 0.45, 0.22]} />
					<T.MeshStandardMaterial
						map={bodyTexture}
						normalMap={armorNormalMap}
						roughnessMap={metalRoughnessMap}
						color={bodyColor}
						emissive={emissiveColor}
						emissiveIntensity={emissiveIntensity + materialPulse}
						metalness={bodyMetalness}
						roughness={bodyRoughness}
					/>
				</T.Mesh>

				<!-- 어깨 -->
				<T.Mesh castShadow position.y={0.4}>
					<T.BoxGeometry args={[0.55, 0.12, 0.2]} />
					<T.MeshStandardMaterial
						map={bodyTexture}
						normalMap={armorNormalMap}
						color={bodyColor}
						metalness={bodyMetalness + 0.1}
						roughness={bodyRoughness - 0.1}
					/>
				</T.Mesh>

				<!-- 목 -->
				<T.Group position.y={0.5} rotation.x={joints.neck.x} rotation.y={joints.neck.y} rotation.z={joints.neck.z}>
					<T.Mesh castShadow>
						<T.CylinderGeometry args={[0.08, 0.1, 0.12, 8]} />
						<T.MeshStandardMaterial
							color={bodyColor}
							metalness={0.2}
							roughness={0.7}
						/>
					</T.Mesh>

					<!-- 머리 -->
					<T.Mesh castShadow position.y={0.2}>
						<T.SphereGeometry args={[0.15, 16, 16]} />
						<T.MeshStandardMaterial
							map={bodyTexture}
							color={bodyColor}
							metalness={0.2}
							roughness={0.6}
						/>
					</T.Mesh>

					<!-- 얼굴 (눈) - 빛나는 효과 추가 -->
					<T.Group position={[0, 0.2, 0.12]}>
						<T.Mesh position.x={0.05}>
							<T.SphereGeometry args={[0.025, 8, 8]} />
							<T.MeshStandardMaterial
								color="#111111"
								emissive={isCharging ? '#ff4400' : (isHit ? '#ff0000' : '#333333')}
								emissiveIntensity={isCharging ? chargeIntensity : (isHit ? 0.8 : 0.2)}
							/>
						</T.Mesh>
						<T.Mesh position.x={-0.05}>
							<T.SphereGeometry args={[0.025, 8, 8]} />
							<T.MeshStandardMaterial
								color="#111111"
								emissive={isCharging ? '#ff4400' : (isHit ? '#ff0000' : '#333333')}
								emissiveIntensity={isCharging ? chargeIntensity : (isHit ? 0.8 : 0.2)}
							/>
						</T.Mesh>
					</T.Group>
				</T.Group>

				<!-- 오른팔 -->
				<T.Group position={[0.32, 0.38, 0]}>
					<!-- 어깨 관절 -->
					<T.Group rotation.x={joints.rightShoulder.x} rotation.y={joints.rightShoulder.y} rotation.z={joints.rightShoulder.z}>
						<!-- 상완 -->
						<T.Mesh castShadow position.y={-0.15}>
							<T.CapsuleGeometry args={[0.055, 0.2, 4, 8]} />
							<T.MeshStandardMaterial
								map={bodyTexture}
								normalMap={armorNormalMap}
								color={bodyColor}
								metalness={bodyMetalness}
								roughness={bodyRoughness}
							/>
						</T.Mesh>

						<!-- 팔꿈치 관절 -->
						<T.Group position.y={-0.3} rotation.x={joints.rightElbow.x}>
							<!-- 전완 -->
							<T.Mesh castShadow position.y={-0.13}>
								<T.CapsuleGeometry args={[0.045, 0.18, 4, 8]} />
								<T.MeshStandardMaterial
									map={bodyTexture}
									normalMap={armorNormalMap}
									color={bodyColor}
									metalness={bodyMetalness}
									roughness={bodyRoughness}
								/>
							</T.Mesh>

							<!-- 손목 관절 -->
							<T.Group position.y={-0.28} rotation.x={joints.rightWrist.x}>
								<!-- 손 -->
								<T.Mesh castShadow>
									<T.BoxGeometry args={[0.06, 0.08, 0.04]} />
									<T.MeshStandardMaterial
										color={bodyColor}
										metalness={0.2}
										roughness={0.7}
									/>
								</T.Mesh>

								<!-- 무기 -->
								{#if hasWeapon && weaponType === 'sword'}
									<T.Group position.y={-0.05}>
										<!-- 손잡이 -->
										<T.Mesh position.y={-0.12}>
											<T.CylinderGeometry args={[0.02, 0.025, 0.15, 8]} />
											<T.MeshStandardMaterial
												color="#4a3728"
												metalness={0.1}
												roughness={0.8}
											/>
										</T.Mesh>
										<!-- 가드 -->
										<T.Mesh position.y={-0.2}>
											<T.BoxGeometry args={[0.15, 0.03, 0.06]} />
											<T.MeshStandardMaterial
												color="#8B4513"
												metalness={0.7}
												roughness={0.3}
												emissive={isCharging ? '#ff4400' : '#000000'}
												emissiveIntensity={isCharging ? chargeIntensity * 0.3 : 0}
											/>
										</T.Mesh>
										<!-- 검날 -->
										<T.Mesh castShadow position.y={-0.55}>
											<T.BoxGeometry args={[0.05, 0.6, 0.015]} />
											<T.MeshStandardMaterial
												map={bladeTexture}
												color={isCharging ? '#ff8800' : '#ffffff'}
												emissive={isCharging ? '#ff4400' : '#444444'}
												emissiveIntensity={isCharging ? chargeIntensity * 0.8 : 0.05}
												metalness={0.95}
												roughness={0.05}
												envMapIntensity={1.5}
											/>
										</T.Mesh>
										<!-- 검 끝 -->
										<T.Mesh castShadow position.y={-0.88}>
											<T.ConeGeometry args={[0.025, 0.08, 4]} />
											<T.MeshStandardMaterial
												color={isCharging ? '#ff8800' : '#ffffff'}
												emissive={isCharging ? '#ff4400' : '#333333'}
												emissiveIntensity={isCharging ? chargeIntensity : 0.05}
												metalness={0.95}
												roughness={0.05}
											/>
										</T.Mesh>
									</T.Group>
								{/if}

								{#if hasWeapon && weaponType === 'axe'}
									<T.Group position.y={-0.05}>
										<!-- 손잡이 -->
										<T.Mesh position.y={-0.4}>
											<T.CylinderGeometry args={[0.03, 0.035, 0.8, 8]} />
											<T.MeshStandardMaterial
												color="#3d2914"
												metalness={0.05}
												roughness={0.9}
											/>
										</T.Mesh>
										<!-- 도끼 날 -->
										<T.Mesh castShadow position={[0.15, -0.75, 0]}>
											<T.BoxGeometry args={[0.25, 0.4, 0.06]} />
											<T.MeshStandardMaterial
												color="#555555"
												emissive={isCharging ? '#ff2200' : '#111111'}
												emissiveIntensity={isCharging ? chargeIntensity * 0.5 : 0.02}
												metalness={0.85}
												roughness={0.15}
											/>
										</T.Mesh>
									</T.Group>
								{/if}
							</T.Group>
						</T.Group>
					</T.Group>
				</T.Group>

				<!-- 왼팔 -->
				<T.Group position={[-0.32, 0.38, 0]}>
					<!-- 어깨 관절 -->
					<T.Group rotation.x={joints.leftShoulder.x} rotation.y={joints.leftShoulder.y} rotation.z={joints.leftShoulder.z}>
						<!-- 상완 -->
						<T.Mesh castShadow position.y={-0.15}>
							<T.CapsuleGeometry args={[0.055, 0.2, 4, 8]} />
							<T.MeshStandardMaterial
								map={bodyTexture}
								normalMap={armorNormalMap}
								color={bodyColor}
								metalness={bodyMetalness}
								roughness={bodyRoughness}
							/>
						</T.Mesh>

						<!-- 팔꿈치 관절 -->
						<T.Group position.y={-0.3} rotation.x={joints.leftElbow.x}>
							<!-- 전완 -->
							<T.Mesh castShadow position.y={-0.13}>
								<T.CapsuleGeometry args={[0.045, 0.18, 4, 8]} />
								<T.MeshStandardMaterial
									map={bodyTexture}
									normalMap={armorNormalMap}
									color={bodyColor}
									metalness={bodyMetalness}
									roughness={bodyRoughness}
								/>
							</T.Mesh>

							<!-- 손목 관절 -->
							<T.Group position.y={-0.28} rotation.x={joints.leftWrist.x}>
								<!-- 손 -->
								<T.Mesh castShadow>
									<T.BoxGeometry args={[0.06, 0.08, 0.04]} />
									<T.MeshStandardMaterial
										color={bodyColor}
										metalness={0.2}
										roughness={0.7}
									/>
								</T.Mesh>

								<!-- 방패 -->
								{#if hasShield}
									{@const isBlocking = animationState === 'guard' || animationState === 'parry'}
									{@const shieldGlow = isBlocking ? 0.5 : 0}
									<T.Group position={[0, 0, 0.15]}>
										<!-- 방패 본체 (더 크게) -->
										<T.Mesh castShadow>
											<T.BoxGeometry args={[0.06, 0.45, 0.35]} />
											<T.MeshStandardMaterial
												color={animationState === 'parry' ? '#ffdd44' : isBlocking ? '#4488ff' : '#555555'}
												emissive={animationState === 'parry' ? '#ffaa00' : isBlocking ? '#2266dd' : '#000000'}
												emissiveIntensity={animationState === 'parry' ? 0.8 : shieldGlow}
												metalness={0.6}
												roughness={0.4}
											/>
										</T.Mesh>
										<!-- 방패 중앙 장식 -->
										<T.Mesh position.x={0.035}>
											<T.CylinderGeometry args={[0.08, 0.08, 0.04, 16]} rotation={[0, 0, Math.PI / 2]} />
											<T.MeshStandardMaterial
												color={isBlocking ? '#ffdd44' : '#8B4513'}
												metalness={0.7}
												emissive={isBlocking ? '#ff8800' : '#000000'}
												emissiveIntensity={isBlocking ? 0.4 : 0}
											/>
										</T.Mesh>
										<!-- 방패 테두리 (상단) -->
										<T.Mesh position={[0.035, 0.2, 0]}>
											<T.BoxGeometry args={[0.02, 0.06, 0.35]} />
											<T.MeshStandardMaterial color="#8B4513" metalness={0.5} />
										</T.Mesh>
										<!-- 방패 테두리 (하단) -->
										<T.Mesh position={[0.035, -0.2, 0]}>
											<T.BoxGeometry args={[0.02, 0.06, 0.35]} />
											<T.MeshStandardMaterial color="#8B4513" metalness={0.5} />
										</T.Mesh>
										<!-- 방패 테두리 (좌) -->
										<T.Mesh position={[0.035, 0, 0.16]}>
											<T.BoxGeometry args={[0.02, 0.45, 0.04]} />
											<T.MeshStandardMaterial color="#8B4513" metalness={0.5} />
										</T.Mesh>
										<!-- 방패 테두리 (우) -->
										<T.Mesh position={[0.035, 0, -0.16]}>
											<T.BoxGeometry args={[0.02, 0.45, 0.04]} />
											<T.MeshStandardMaterial color="#8B4513" metalness={0.5} />
										</T.Mesh>
										<!-- 패링 시 빛나는 이펙트 -->
										{#if animationState === 'parry'}
											<T.Mesh position.x={0.05}>
												<T.PlaneGeometry args={[0.5, 0.6]} />
												<T.MeshBasicMaterial
													color="#ffffff"
													transparent
													opacity={0.3}
													side={2}
												/>
											</T.Mesh>
										{/if}
									</T.Group>
								{/if}
							</T.Group>
						</T.Group>
					</T.Group>
				</T.Group>
			</T.Group>

			<!-- 오른다리 -->
			<T.Group position={[0.1, -0.1, 0]}>
				<!-- 힙 관절 -->
				<T.Group rotation.x={joints.rightHip.x} rotation.y={joints.rightHip.y} rotation.z={joints.rightHip.z}>
					<!-- 허벅지 -->
					<T.Mesh castShadow position.y={-0.22}>
						<T.CapsuleGeometry args={[0.07, 0.28, 4, 8]} />
						<T.MeshStandardMaterial
							map={accentTexture}
							normalMap={armorNormalMap}
							color={accentColor}
							metalness={accentMetalness}
							roughness={accentRoughness}
						/>
					</T.Mesh>

					<!-- 무릎 관절 -->
					<T.Group position.y={-0.45} rotation.x={joints.rightKnee.x}>
						<!-- 종아리 -->
						<T.Mesh castShadow position.y={-0.2}>
							<T.CapsuleGeometry args={[0.055, 0.26, 4, 8]} />
							<T.MeshStandardMaterial
								map={accentTexture}
								normalMap={armorNormalMap}
								color={accentColor}
								metalness={accentMetalness}
								roughness={accentRoughness}
							/>
						</T.Mesh>

						<!-- 발목 관절 -->
						<T.Group position.y={-0.42} rotation.x={joints.rightAnkle.x}>
							<!-- 발 -->
							<T.Mesh castShadow position={[0, -0.03, 0.04]}>
								<T.BoxGeometry args={[0.08, 0.06, 0.15]} />
								<T.MeshStandardMaterial
									color="#333333"
									metalness={0.3}
									roughness={0.7}
								/>
							</T.Mesh>
						</T.Group>
					</T.Group>
				</T.Group>
			</T.Group>

			<!-- 왼다리 -->
			<T.Group position={[-0.1, -0.1, 0]}>
				<!-- 힙 관절 -->
				<T.Group rotation.x={joints.leftHip.x} rotation.y={joints.leftHip.y} rotation.z={joints.leftHip.z}>
					<!-- 허벅지 -->
					<T.Mesh castShadow position.y={-0.22}>
						<T.CapsuleGeometry args={[0.07, 0.28, 4, 8]} />
						<T.MeshStandardMaterial
							map={accentTexture}
							normalMap={armorNormalMap}
							color={accentColor}
							metalness={accentMetalness}
							roughness={accentRoughness}
						/>
					</T.Mesh>

					<!-- 무릎 관절 -->
					<T.Group position.y={-0.45} rotation.x={joints.leftKnee.x}>
						<!-- 종아리 -->
						<T.Mesh castShadow position.y={-0.2}>
							<T.CapsuleGeometry args={[0.055, 0.26, 4, 8]} />
							<T.MeshStandardMaterial
								map={accentTexture}
								normalMap={armorNormalMap}
								color={accentColor}
								metalness={accentMetalness}
								roughness={accentRoughness}
							/>
						</T.Mesh>

						<!-- 발목 관절 -->
						<T.Group position.y={-0.42} rotation.x={joints.leftAnkle.x}>
							<!-- 발 -->
							<T.Mesh castShadow position={[0, -0.03, 0.04]}>
								<T.BoxGeometry args={[0.08, 0.06, 0.15]} />
								<T.MeshStandardMaterial
									color="#333333"
									metalness={0.3}
									roughness={0.7}
								/>
							</T.Mesh>
						</T.Group>
					</T.Group>
				</T.Group>
			</T.Group>
		</T.Group>
	</T.Group>
</T.Group>
