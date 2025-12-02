<script lang="ts">
	import { T } from '@threlte/core';
	import * as THREE from 'three';

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

	// ========== 프로시저럴 텍스처 생성 ==========
	function createSkinTexture(baseColor: string): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext('2d')!;

		// 기본 색상
		ctx.fillStyle = baseColor;
		ctx.fillRect(0, 0, 256, 256);

		// 피부/갑옷 텍스처 노이즈
		for (let i = 0; i < 500; i++) {
			const x = Math.random() * 256;
			const y = Math.random() * 256;
			const alpha = Math.random() * 0.08;
			const shade = Math.random() > 0.5 ? 'rgba(255,255,255,' : 'rgba(0,0,0,';
			ctx.fillStyle = shade + alpha + ')';
			ctx.beginPath();
			ctx.arc(x, y, Math.random() * 3 + 0.5, 0, Math.PI * 2);
			ctx.fill();
		}

		// 미세한 라인 패턴 (갑옷 질감)
		ctx.strokeStyle = 'rgba(0,0,0,0.05)';
		ctx.lineWidth = 1;
		for (let i = 0; i < 256; i += 16) {
			ctx.beginPath();
			ctx.moveTo(0, i);
			ctx.lineTo(256, i);
			ctx.stroke();
		}

		const texture = new THREE.CanvasTexture(canvas);
		return texture;
	}

	function createArmorNormalMap(): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext('2d')!;

		// 기본 노말 (파란색)
		ctx.fillStyle = '#8080ff';
		ctx.fillRect(0, 0, 256, 256);

		// 갑옷 판금 패턴
		for (let y = 0; y < 256; y += 32) {
			for (let x = 0; x < 256; x += 32) {
				// 판금 경계
				ctx.fillStyle = '#7070f0';
				ctx.fillRect(x, y, 32, 2);
				ctx.fillRect(x, y, 2, 32);

				// 볼록한 중앙
				const centerX = x + 16;
				const centerY = y + 16;
				const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 12);
				gradient.addColorStop(0, '#9090ff');
				gradient.addColorStop(1, '#8080ff');
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		// 스크래치 마크
		ctx.strokeStyle = '#7575f5';
		ctx.lineWidth = 1;
		for (let i = 0; i < 10; i++) {
			const startX = Math.random() * 256;
			const startY = Math.random() * 256;
			ctx.beginPath();
			ctx.moveTo(startX, startY);
			ctx.lineTo(startX + (Math.random() - 0.5) * 40, startY + (Math.random() - 0.5) * 40);
			ctx.stroke();
		}

		return new THREE.CanvasTexture(canvas);
	}

	function createMetalRoughnessMap(): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 256;
		const ctx = canvas.getContext('2d')!;

		// 기본 러프니스 (약간 광택)
		ctx.fillStyle = '#666666';
		ctx.fillRect(0, 0, 256, 256);

		// 긁힌 자국 (높은 러프니스)
		ctx.strokeStyle = '#999999';
		ctx.lineWidth = 2;
		for (let i = 0; i < 20; i++) {
			const startX = Math.random() * 256;
			const startY = Math.random() * 256;
			ctx.beginPath();
			ctx.moveTo(startX, startY);
			ctx.lineTo(startX + (Math.random() - 0.5) * 50, startY + (Math.random() - 0.5) * 50);
			ctx.stroke();
		}

		// 광택 부분 (낮은 러프니스)
		for (let i = 0; i < 15; i++) {
			ctx.fillStyle = '#444444';
			ctx.beginPath();
			ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 15 + 5, 0, Math.PI * 2);
			ctx.fill();
		}

		return new THREE.CanvasTexture(canvas);
	}

	// 검 블레이드 텍스처
	function createBladeTexture(): THREE.CanvasTexture {
		const canvas = document.createElement('canvas');
		canvas.width = 64;
		canvas.height = 256;
		const ctx = canvas.getContext('2d')!;

		// 그라데이션 베이스
		const gradient = ctx.createLinearGradient(0, 0, 64, 0);
		gradient.addColorStop(0, '#888888');
		gradient.addColorStop(0.3, '#dddddd');
		gradient.addColorStop(0.5, '#ffffff');
		gradient.addColorStop(0.7, '#dddddd');
		gradient.addColorStop(1, '#888888');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 64, 256);

		// 세로 라인 (칼날 결)
		ctx.strokeStyle = 'rgba(255,255,255,0.3)';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(32, 0);
		ctx.lineTo(32, 256);
		ctx.stroke();

		// 약간의 질감
		for (let i = 0; i < 100; i++) {
			const x = Math.random() * 64;
			const y = Math.random() * 256;
			ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
			ctx.fillRect(x, y, 1, Math.random() * 10 + 2);
		}

		return new THREE.CanvasTexture(canvas);
	}

	// 텍스처 생성 (한 번만)
	const bodyTexture = createSkinTexture(color);
	const accentTexture = createSkinTexture(accentColor);
	const armorNormalMap = createArmorNormalMap();
	const metalRoughnessMap = createMetalRoughnessMap();
	const bladeTexture = createBladeTexture();

	// ========== 물리 기반 스프링 시스템 ==========
	type Vec3 = { x: number; y: number; z: number };
	type JointState = {
		current: Vec3;
		velocity: Vec3;
	};

	// 스프링 파라미터 (관절별로 다르게 설정)
	const SPRING_CONFIGS: Record<string, { stiffness: number; damping: number; mass: number }> = {
		// 몸통: 무겁고 안정적
		spine: { stiffness: 100, damping: 12, mass: 1.2 },
		chest: { stiffness: 110, damping: 13, mass: 1.0 },
		// 머리: 가볍고 빠르게 반응
		neck: { stiffness: 150, damping: 15, mass: 0.5 },
		// 팔: 중간 무게, 자연스러운 스윙
		rightShoulder: { stiffness: 130, damping: 14, mass: 0.8 },
		rightElbow: { stiffness: 140, damping: 14, mass: 0.6 },
		rightWrist: { stiffness: 160, damping: 15, mass: 0.4 },
		leftShoulder: { stiffness: 130, damping: 14, mass: 0.8 },
		leftElbow: { stiffness: 140, damping: 14, mass: 0.6 },
		leftWrist: { stiffness: 160, damping: 15, mass: 0.4 },
		// 다리: 무겁고 안정적
		rightHip: { stiffness: 90, damping: 11, mass: 1.3 },
		rightKnee: { stiffness: 100, damping: 12, mass: 1.0 },
		rightAnkle: { stiffness: 120, damping: 13, mass: 0.7 },
		leftHip: { stiffness: 90, damping: 11, mass: 1.3 },
		leftKnee: { stiffness: 100, damping: 12, mass: 1.0 },
		leftAnkle: { stiffness: 120, damping: 13, mass: 0.7 }
	};

	const DEFAULT_SPRING_CONFIG = { stiffness: 120, damping: 14, mass: 1.0 };

	// 스프링 물리 적용 함수
	function springStep(current: number, target: number, velocity: number, dt: number, config = DEFAULT_SPRING_CONFIG): { value: number; velocity: number } {
		const displacement = target - current;
		const springForce = displacement * config.stiffness;
		const dampingForce = -velocity * config.damping;
		const acceleration = (springForce + dampingForce) / config.mass;

		const newVelocity = velocity + acceleration * dt;
		const newValue = current + newVelocity * dt;

		return { value: newValue, velocity: newVelocity };
	}

	// 관절 스프링 상태
	let jointSprings = $state<Record<string, JointState>>({
		spine: { current: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		chest: { current: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		neck: { current: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		rightShoulder: { current: { x: 0.1, y: 0, z: -0.35 }, velocity: { x: 0, y: 0, z: 0 } },
		rightElbow: { current: { x: 0.15, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		rightWrist: { current: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		leftShoulder: { current: { x: 0.1, y: 0, z: 0.35 }, velocity: { x: 0, y: 0, z: 0 } },
		leftElbow: { current: { x: 0.15, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		leftWrist: { current: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		rightHip: { current: { x: 0, y: 0, z: -0.02 }, velocity: { x: 0, y: 0, z: 0 } },
		rightKnee: { current: { x: 0.02, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		rightAnkle: { current: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		leftHip: { current: { x: 0, y: 0, z: 0.02 }, velocity: { x: 0, y: 0, z: 0 } },
		leftKnee: { current: { x: 0.02, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } },
		leftAnkle: { current: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
	});

	// 이전 시간 저장
	let lastTime = $state(0);

	// 이징 함수들
	function easeOutElastic(x: number): number {
		const c4 = (2 * Math.PI) / 3;
		return x === 0 ? 0 : x === 1 ? 1 :
			Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
	}

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

	// 부드러운 보간 함수
	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	// 이차 모션 (관성/지연) 상태
	let secondaryMotion = $state({
		headBob: 0,
		shoulderLag: 0,
		weaponSwing: 0,
		breathPhase: 0
	});

	// 타겟 포즈 계산 (목표 위치) - 검술 기반
	function calculateTargetPose() {
		// 이차 모션 업데이트
		secondaryMotion.breathPhase += 0.016; // ~60fps 가정
		const breathIntensity = animationState === 'idle' ? 1.0 :
			(animationState === 'walk' ? 0.7 : 0.4);

		// 호흡 - 더 복잡한 패턴 (복식호흡 시뮬레이션)
		const breathe = (
			Math.sin(time * 2) * 0.012 +
			Math.sin(time * 4) * 0.004 +
			Math.sin(time * 0.5) * 0.008
		) * breathIntensity;

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

		// ========== 걷기: 검술 스타일 이동 (스리아시) ==========
		if (animationState === 'walk' || animationState === 'run') {
			const intensity = animationState === 'run' ? 1.0 : 0.6;
			const cycle = walkCycle;
			const legSwing = Math.sin(cycle);
			const legSwingOffset = Math.sin(cycle + Math.PI * 0.25); // 위상 차이

			// 다리: 더 자연스러운 걸음 (발 들기/내리기 포함)
			pose.rightHip.x = 0.05 + legSwing * 0.28 * intensity;
			pose.leftHip.x = -0.1 - legSwing * 0.28 * intensity;
			pose.rightKnee.x = 0.15 + Math.max(0, -legSwing) * 0.25 * intensity;
			pose.leftKnee.x = 0.2 + Math.max(0, legSwing) * 0.25 * intensity;

			// 발목 굽힘 (발차기 느낌)
			pose.rightAnkle.x = -legSwing * 0.1 * intensity;
			pose.leftAnkle.x = legSwing * 0.1 * intensity;

			// 상체: 자연스러운 반대 트위스트
			pose.chest.y = legSwing * 0.04 * intensity;
			pose.spine.y = -legSwing * 0.03 * intensity; // 반대 방향 트위스트
			pose.spine.x = 0.08 + Math.abs(legSwing) * 0.025 * intensity;

			// 머리 안정화 (상체 반대로 보정)
			pose.neck.y = legSwing * 0.02 * intensity;

			// 팔 스윙 (다리 반대)
			pose.rightShoulder.x = 0.3 - legSwing * 0.15 * intensity;
			pose.leftShoulder.x = 0.2 + legSwing * 0.12 * intensity;

			// 어깨 상하 움직임 (걸을 때 자연스러운 밥)
			const verticalBob = Math.abs(Math.sin(cycle * 2)) * 0.02 * intensity;
			pose.spine.x += verticalBob;

			// 힙 좌우 흔들림
			pose.rightHip.z = -0.08 + legSwingOffset * 0.03 * intensity;
			pose.leftHip.z = 0.08 - legSwingOffset * 0.03 * intensity;
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
	}

	// $effect로 스프링 물리 업데이트
	$effect(() => {
		const targetPose = calculateTargetPose();
		const dt = Math.min(time - lastTime, 0.05); // 최대 50ms로 제한
		lastTime = time;

		if (dt <= 0) return;

		// 각 관절에 스프링 물리 적용
		const jointNames = Object.keys(jointSprings) as Array<keyof typeof jointSprings>;

		for (const name of jointNames) {
			const joint = jointSprings[name];
			const target = targetPose[name as keyof typeof targetPose];
			const config = SPRING_CONFIGS[name] || DEFAULT_SPRING_CONFIG;

			if (!target) continue;

			// X축
			const xResult = springStep(joint.current.x, target.x, joint.velocity.x, dt, config);
			joint.current.x = xResult.value;
			joint.velocity.x = xResult.velocity;

			// Y축
			const yResult = springStep(joint.current.y, target.y, joint.velocity.y, dt, config);
			joint.current.y = yResult.value;
			joint.velocity.y = yResult.velocity;

			// Z축
			const zResult = springStep(joint.current.z, target.z, joint.velocity.z, dt, config);
			joint.current.z = zResult.value;
			joint.velocity.z = zResult.velocity;
		}
	});

	// 최종 관절 값 (스프링 적용된 값)
	let joints = $derived({
		spine: jointSprings.spine.current,
		chest: jointSprings.chest.current,
		neck: jointSprings.neck.current,
		rightShoulder: jointSprings.rightShoulder.current,
		rightElbow: jointSprings.rightElbow.current,
		rightWrist: jointSprings.rightWrist.current,
		leftShoulder: jointSprings.leftShoulder.current,
		leftElbow: jointSprings.leftElbow.current,
		leftWrist: jointSprings.leftWrist.current,
		rightHip: jointSprings.rightHip.current,
		rightKnee: jointSprings.rightKnee.current,
		rightAnkle: jointSprings.rightAnkle.current,
		leftHip: jointSprings.leftHip.current,
		leftKnee: jointSprings.leftKnee.current,
		leftAnkle: jointSprings.leftAnkle.current
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
