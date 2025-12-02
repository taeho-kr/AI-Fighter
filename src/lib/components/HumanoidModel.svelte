<script lang="ts">
	import { T } from '@threlte/core';

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

	// 관절 회전값 계산
	let joints = $derived.by(() => {
		// 기본 호흡 애니메이션
		const breathe = Math.sin(time * 2) * 0.02;
		const microMovement = Math.sin(time * 3.7) * 0.01;

		// 기본 포즈
		let pose = {
			// 척추
			spine: { x: breathe, y: 0, z: 0 },
			chest: { x: breathe * 0.5, y: 0, z: 0 },
			neck: { x: microMovement, y: 0, z: 0 },

			// 오른팔 (무기)
			rightShoulder: { x: 0, y: 0, z: -0.3 },
			rightElbow: { x: 0, y: 0, z: 0 },
			rightWrist: { x: 0, y: 0, z: 0 },

			// 왼팔 (방패)
			leftShoulder: { x: 0, y: 0, z: 0.3 },
			leftElbow: { x: 0, y: 0, z: 0 },
			leftWrist: { x: 0, y: 0, z: 0 },

			// 오른다리
			rightHip: { x: 0, y: 0, z: 0 },
			rightKnee: { x: 0, y: 0, z: 0 },
			rightAnkle: { x: 0, y: 0, z: 0 },

			// 왼다리
			leftHip: { x: 0, y: 0, z: 0 },
			leftKnee: { x: 0, y: 0, z: 0 },
			leftAnkle: { x: 0, y: 0, z: 0 }
		};

		// 걷기 애니메이션
		if (animationState === 'walk' || animationState === 'run') {
			const intensity = animationState === 'run' ? 1.2 : 0.6;
			const cycle = walkCycle;

			// 다리 스윙
			pose.rightHip.x = Math.sin(cycle) * 0.5 * intensity;
			pose.leftHip.x = Math.sin(cycle + Math.PI) * 0.5 * intensity;

			// 무릎 구부림
			pose.rightKnee.x = Math.max(0, -Math.sin(cycle) * 0.4) * intensity;
			pose.leftKnee.x = Math.max(0, -Math.sin(cycle + Math.PI) * 0.4) * intensity;

			// 팔 스윙 (반대 방향)
			pose.rightShoulder.x = Math.sin(cycle + Math.PI) * 0.3 * intensity;
			pose.leftShoulder.x = Math.sin(cycle) * 0.3 * intensity;

			// 몸통 기울기
			pose.spine.z = Math.sin(cycle * 2) * 0.03 * intensity;
			pose.chest.y = Math.sin(cycle) * 0.05 * intensity;
		}

		// ========== 약공격 (빠른 수평 베기) ==========
		if (animationState === 'attack_light') {
			const p = animationProgress;

			if (p < 0.2) {
				// 준비: 검을 오른쪽 뒤로 빠르게 당김
				const prep = p / 0.2;
				pose.rightShoulder.x = -0.3 * prep;
				pose.rightShoulder.y = 0.8 * prep;  // 옆으로 들어올림
				pose.rightShoulder.z = -0.6 * prep;
				pose.chest.y = 0.3 * prep;  // 몸통 회전
				pose.rightElbow.x = 0.4 * prep;
			} else if (p < 0.5) {
				// 스윙: 빠른 수평 베기
				const swing = (p - 0.2) / 0.3;
				pose.rightShoulder.x = -0.3 + 0.6 * swing;
				pose.rightShoulder.y = 0.8 - 1.6 * swing;  // 왼쪽으로 휘두름
				pose.rightShoulder.z = -0.6 + 0.3 * swing;
				pose.chest.y = 0.3 - 0.6 * swing;  // 몸통 반대로 회전
				pose.rightElbow.x = 0.4 + 0.3 * swing;
				pose.spine.y = -0.2 * swing;
			} else {
				// 회복
				const recovery = (p - 0.5) / 0.5;
				pose.rightShoulder.x = 0.3 * (1 - recovery);
				pose.rightShoulder.y = -0.8 * (1 - recovery);
				pose.rightShoulder.z = -0.3 * (1 - recovery);
				pose.chest.y = -0.3 * (1 - recovery);
				pose.rightElbow.x = 0.7 * (1 - recovery);
				pose.spine.y = -0.2 * (1 - recovery);
			}
		}

		// ========== 강공격 (머리 위에서 내려치기) ==========
		if (animationState === 'attack_heavy') {
			const p = animationProgress;

			if (p < 0.35) {
				// 준비: 검을 머리 위로 크게 들어올림
				const lift = p / 0.35;
				const easeOut = 1 - Math.pow(1 - lift, 2);
				pose.rightShoulder.x = -2.8 * easeOut;  // 머리 뒤로 크게
				pose.rightShoulder.z = -0.4 * easeOut;
				pose.rightElbow.x = -0.5 * easeOut;  // 팔꿈치 굽힘
				pose.leftShoulder.x = -1.0 * easeOut;  // 왼팔도 따라 올림
				pose.spine.x = -0.3 * easeOut;  // 몸 뒤로 젖힘
				pose.chest.x = -0.2 * easeOut;
				pose.rightKnee.x = 0.2 * easeOut;
				pose.leftKnee.x = 0.2 * easeOut;
			} else if (p < 0.6) {
				// 내려치기: 강력하고 빠르게
				const strike = (p - 0.35) / 0.25;
				const easeIn = strike * strike;
				pose.rightShoulder.x = -2.8 + 4.5 * easeIn;  // 앞으로 크게 내려침
				pose.rightShoulder.z = -0.4;
				pose.rightElbow.x = -0.5 + 1.0 * easeIn;  // 팔 펴짐
				pose.leftShoulder.x = -1.0 + 1.5 * easeIn;
				pose.spine.x = -0.3 + 0.7 * easeIn;  // 몸 앞으로 숙임
				pose.chest.x = -0.2 + 0.5 * easeIn;
				pose.rightKnee.x = 0.2 + 0.3 * easeIn;
				pose.leftKnee.x = 0.2 + 0.3 * easeIn;
				pose.rightHip.x = 0.2 * easeIn;  // 앞으로 무게 이동
			} else {
				// 회복: 느리게
				const recovery = (p - 0.6) / 0.4;
				const easeOut = 1 - Math.pow(1 - recovery, 2);
				pose.rightShoulder.x = 1.7 * (1 - easeOut);
				pose.rightElbow.x = 0.5 * (1 - easeOut);
				pose.leftShoulder.x = 0.5 * (1 - easeOut);
				pose.spine.x = 0.4 * (1 - easeOut);
				pose.chest.x = 0.3 * (1 - easeOut);
				pose.rightKnee.x = 0.5 * (1 - easeOut);
				pose.leftKnee.x = 0.5 * (1 - easeOut);
				pose.rightHip.x = 0.2 * (1 - easeOut);
			}
		}

		// ========== 가드 자세 (방패를 앞으로, 웅크림) ==========
		if (animationState === 'guard') {
			// 방패팔: 앞으로 크게 내밀기
			pose.leftShoulder.x = -0.6;
			pose.leftShoulder.y = 0.3;
			pose.leftShoulder.z = 0.8;  // 앞으로 크게
			pose.leftElbow.x = 1.5;  // 팔꿈치 크게 굽힘
			pose.leftWrist.x = -0.3;

			// 검팔: 뒤로 숨김
			pose.rightShoulder.x = -0.5;
			pose.rightShoulder.z = -0.8;
			pose.rightElbow.x = 0.8;

			// 몸: 웅크리고 방패 뒤로 숨음
			pose.spine.x = 0.15;  // 살짝 숙임
			pose.spine.z = -0.1;  // 왼쪽으로 기울임 (방패쪽)
			pose.chest.x = 0.1;

			// 다리: 넓게 벌리고 무릎 굽힘
			pose.rightKnee.x = 0.3;
			pose.leftKnee.x = 0.3;
			pose.rightHip.z = -0.1;
			pose.leftHip.z = 0.1;
		}

		// ========== 패링 자세 (방패로 튕겨내기) ==========
		if (animationState === 'parry') {
			const p = animationProgress;

			if (p < 0.3) {
				// 패링 동작: 방패를 빠르게 밀어냄
				const push = p / 0.3;
				pose.leftShoulder.x = -0.3 - 0.5 * push;
				pose.leftShoulder.y = 0.4 * push;
				pose.leftShoulder.z = 0.6 + 0.8 * push;  // 앞으로 강하게
				pose.leftElbow.x = 1.2 - 0.8 * push;  // 팔 펴면서
				pose.spine.z = -0.2 * push;  // 몸도 따라 밀기
				pose.chest.y = 0.15 * push;
			} else {
				// 유지
				const hold = Math.min(1, (p - 0.3) / 0.4);
				pose.leftShoulder.x = -0.8;
				pose.leftShoulder.y = 0.4 * (1 - hold * 0.5);
				pose.leftShoulder.z = 1.4 * (1 - hold * 0.3);
				pose.leftElbow.x = 0.4;
				pose.spine.z = -0.2 * (1 - hold);
				pose.chest.y = 0.15 * (1 - hold);
			}

			// 검팔은 뒤로
			pose.rightShoulder.x = -0.3;
			pose.rightShoulder.z = -0.6;
		}

		// ========== 회피 자세 (방향별 역동적 모션) ==========
		if (animationState === 'dodge') {
			const p = animationProgress;

			if (dodgeDirection === 'backward') {
				// 뒤로 백스텝: 몸을 뒤로 젖히면서 뛰어감
				if (p < 0.3) {
					// 준비: 무릎 굽히고 뒤로 기울기
					const prep = p / 0.3;
					pose.spine.x = -0.3 * prep;
					pose.rightKnee.x = 0.5 * prep;
					pose.leftKnee.x = 0.5 * prep;
					pose.rightHip.x = 0.2 * prep;
					pose.leftHip.x = 0.2 * prep;
				} else if (p < 0.7) {
					// 점프: 공중에서 뒤로 뛰기
					const jump = (p - 0.3) / 0.4;
					const arc = Math.sin(jump * Math.PI);
					pose.spine.x = -0.3 - 0.4 * arc;
					pose.chest.x = -0.2 * arc;
					pose.rightKnee.x = 0.5 + 0.4 * arc;  // 무릎 더 굽힘
					pose.leftKnee.x = 0.5 + 0.4 * arc;
					pose.rightHip.x = 0.2 - 0.5 * arc;  // 다리 뒤로 뻗기
					pose.leftHip.x = 0.2 + 0.3 * arc;
					// 팔 뒤로 휘날림
					pose.rightShoulder.x = 0.5 * arc;
					pose.rightShoulder.z = -0.3 - 0.4 * arc;
					pose.leftShoulder.x = 0.5 * arc;
					pose.leftShoulder.z = 0.3 + 0.4 * arc;
				} else {
					// 착지
					const land = (p - 0.7) / 0.3;
					pose.spine.x = -0.7 * (1 - land);
					pose.rightKnee.x = 0.9 * (1 - land * 0.5);
					pose.leftKnee.x = 0.9 * (1 - land * 0.5);
					pose.rightHip.x = -0.3 * (1 - land);
					pose.leftHip.x = 0.5 * (1 - land);
				}
			} else if (dodgeDirection === 'forward') {
				// 앞으로 구르기/대시: 몸을 앞으로 숙이며 돌진
				if (p < 0.25) {
					// 숙이기
					const duck = p / 0.25;
					pose.spine.x = 0.8 * duck;
					pose.chest.x = 0.5 * duck;
					pose.neck.x = 0.3 * duck;
					pose.rightKnee.x = 0.6 * duck;
					pose.leftKnee.x = 0.6 * duck;
				} else if (p < 0.6) {
					// 구르기 동작
					const roll = (p - 0.25) / 0.35;
					const rollAngle = roll * Math.PI;
					pose.spine.x = 0.8 + Math.sin(rollAngle) * 0.8;
					pose.chest.x = 0.5 + Math.sin(rollAngle) * 0.6;
					pose.neck.x = 0.3 + Math.sin(rollAngle) * 0.4;
					// 다리 접기
					pose.rightHip.x = 0.8 * Math.sin(rollAngle);
					pose.leftHip.x = 0.8 * Math.sin(rollAngle);
					pose.rightKnee.x = 0.6 + 0.8 * Math.sin(rollAngle);
					pose.leftKnee.x = 0.6 + 0.8 * Math.sin(rollAngle);
					// 팔 몸에 붙이기
					pose.rightShoulder.z = -0.8;
					pose.rightElbow.x = 1.2;
					pose.leftShoulder.z = 0.8;
					pose.leftElbow.x = 1.2;
				} else {
					// 일어서기
					const rise = (p - 0.6) / 0.4;
					pose.spine.x = 1.6 * (1 - rise);
					pose.chest.x = 1.1 * (1 - rise);
					pose.neck.x = 0.7 * (1 - rise);
					pose.rightKnee.x = 1.4 * (1 - rise);
					pose.leftKnee.x = 1.4 * (1 - rise);
					pose.rightHip.x = 0.8 * (1 - rise);
					pose.leftHip.x = 0.8 * (1 - rise);
				}
			} else if (dodgeDirection === 'left') {
				// 왼쪽 옆구르기
				if (p < 0.3) {
					// 왼쪽으로 기울기
					const lean = p / 0.3;
					pose.spine.z = 0.5 * lean;
					pose.chest.z = 0.3 * lean;
					pose.rightHip.z = -0.3 * lean;
					pose.leftHip.z = 0.3 * lean;
					pose.rightKnee.x = 0.4 * lean;
				} else if (p < 0.7) {
					// 옆으로 구르기
					const roll = (p - 0.3) / 0.4;
					const rollAngle = roll * Math.PI;
					pose.spine.z = 0.5 + Math.sin(rollAngle) * 1.0;
					pose.spine.x = Math.sin(rollAngle) * 0.5;
					pose.chest.z = 0.3 + Math.sin(rollAngle) * 0.6;
					// 다리 차기 동작
					pose.rightHip.z = -0.3 - Math.sin(rollAngle) * 0.5;
					pose.rightHip.x = Math.sin(rollAngle) * 0.6;
					pose.leftHip.z = 0.3 + Math.sin(rollAngle) * 0.3;
					pose.rightKnee.x = 0.4 + Math.sin(rollAngle) * 0.5;
					// 팔 휘두르기
					pose.rightShoulder.x = Math.sin(rollAngle) * 0.8;
					pose.rightShoulder.z = -0.5 - Math.sin(rollAngle) * 0.5;
					pose.leftShoulder.z = 0.3 + Math.sin(rollAngle) * 0.8;
				} else {
					// 복귀
					const recover = (p - 0.7) / 0.3;
					pose.spine.z = 1.5 * (1 - recover);
					pose.spine.x = 0.5 * (1 - recover);
					pose.chest.z = 0.9 * (1 - recover);
					pose.rightHip.z = -0.8 * (1 - recover);
					pose.rightHip.x = 0.6 * (1 - recover);
					pose.rightKnee.x = 0.9 * (1 - recover);
				}
			} else if (dodgeDirection === 'right') {
				// 오른쪽 옆구르기 (왼쪽의 반대)
				if (p < 0.3) {
					const lean = p / 0.3;
					pose.spine.z = -0.5 * lean;
					pose.chest.z = -0.3 * lean;
					pose.rightHip.z = 0.3 * lean;
					pose.leftHip.z = -0.3 * lean;
					pose.leftKnee.x = 0.4 * lean;
				} else if (p < 0.7) {
					const roll = (p - 0.3) / 0.4;
					const rollAngle = roll * Math.PI;
					pose.spine.z = -0.5 - Math.sin(rollAngle) * 1.0;
					pose.spine.x = Math.sin(rollAngle) * 0.5;
					pose.chest.z = -0.3 - Math.sin(rollAngle) * 0.6;
					// 다리 차기
					pose.leftHip.z = -0.3 - Math.sin(rollAngle) * 0.5;
					pose.leftHip.x = Math.sin(rollAngle) * 0.6;
					pose.rightHip.z = 0.3 + Math.sin(rollAngle) * 0.3;
					pose.leftKnee.x = 0.4 + Math.sin(rollAngle) * 0.5;
					// 팔
					pose.leftShoulder.x = Math.sin(rollAngle) * 0.8;
					pose.leftShoulder.z = 0.5 + Math.sin(rollAngle) * 0.5;
					pose.rightShoulder.z = -0.3 - Math.sin(rollAngle) * 0.8;
				} else {
					const recover = (p - 0.7) / 0.3;
					pose.spine.z = -1.5 * (1 - recover);
					pose.spine.x = 0.5 * (1 - recover);
					pose.chest.z = -0.9 * (1 - recover);
					pose.leftHip.z = -0.8 * (1 - recover);
					pose.leftHip.x = 0.6 * (1 - recover);
					pose.leftKnee.x = 0.9 * (1 - recover);
				}
			}
		}

		// ========== 스턴 상태 (비틀거림) ==========
		if (animationState === 'stunned' || isStunned) {
			const wobble = Math.sin(time * 4);
			const wobble2 = Math.cos(time * 3.3);

			// 몸 비틀거림
			pose.spine.x = 0.25 + wobble * 0.15;
			pose.spine.z = wobble2 * 0.2;
			pose.spine.y = wobble * 0.1;

			// 머리 흔들림
			pose.neck.x = 0.15 + wobble2 * 0.1;
			pose.neck.z = wobble * 0.15;

			// 팔 축 늘어짐
			pose.rightShoulder.x = 0.2;
			pose.rightShoulder.z = -0.5 + wobble * 0.2;
			pose.rightElbow.x = 0.3;
			pose.leftShoulder.x = 0.2;
			pose.leftShoulder.z = 0.5 + wobble2 * 0.2;
			pose.leftElbow.x = 0.3;

			// 다리 불안정
			pose.rightKnee.x = 0.2 + wobble * 0.1;
			pose.leftKnee.x = 0.2 + wobble2 * 0.1;
		}

		// 차징
		if (animationState === 'charging' || isCharging) {
			const intensity = chargeIntensity;
			pose.rightShoulder.x = -1.5 - intensity * 0.5;
			pose.rightShoulder.z = -0.5 - intensity * 0.2;
			pose.spine.x = -0.15 * intensity;
			pose.chest.y = -0.1 * intensity;
			// 떨림
			pose.rightShoulder.x += Math.sin(time * 20) * 0.05 * intensity;
			pose.rightShoulder.z += Math.cos(time * 23) * 0.03 * intensity;
		}

		// bodyTilt 적용
		pose.spine.x += bodyTilt;

		return pose;
	});

	// 색상 계산
	let bodyColor = $derived(isHit ? '#ff4444' : color);
	let emissiveColor = $derived(isHit ? '#ff0000' : (isCharging ? '#ff8800' : '#000000'));
	let emissiveIntensity = $derived(isHit ? 0.5 : (isCharging ? chargeIntensity * 0.5 : 0));
</script>

<T.Group scale={[scale, scale, scale]}>
	<!-- 골반 (루트) -->
	<T.Group position.y={0.95}>
		<!-- 척추 -->
		<T.Group rotation.x={joints.spine.x} rotation.y={joints.spine.y} rotation.z={joints.spine.z}>
			<!-- 하체 (골반) -->
			<T.Mesh castShadow>
				<T.BoxGeometry args={[0.35, 0.15, 0.2]} />
				<T.MeshStandardMaterial color={accentColor} />
			</T.Mesh>

			<!-- 상체 (흉부) -->
			<T.Group position.y={0.25} rotation.x={joints.chest.x} rotation.y={joints.chest.y} rotation.z={joints.chest.z}>
				<!-- 몸통 -->
				<T.Mesh castShadow position.y={0.2}>
					<T.BoxGeometry args={[0.4, 0.45, 0.22]} />
					<T.MeshStandardMaterial
						color={bodyColor}
						emissive={emissiveColor}
						emissiveIntensity={emissiveIntensity}
					/>
				</T.Mesh>

				<!-- 어깨 -->
				<T.Mesh castShadow position.y={0.4}>
					<T.BoxGeometry args={[0.55, 0.12, 0.2]} />
					<T.MeshStandardMaterial color={bodyColor} />
				</T.Mesh>

				<!-- 목 -->
				<T.Group position.y={0.5} rotation.x={joints.neck.x} rotation.y={joints.neck.y} rotation.z={joints.neck.z}>
					<T.Mesh castShadow>
						<T.CylinderGeometry args={[0.08, 0.1, 0.12, 8]} />
						<T.MeshStandardMaterial color={bodyColor} />
					</T.Mesh>

					<!-- 머리 -->
					<T.Mesh castShadow position.y={0.2}>
						<T.SphereGeometry args={[0.15, 16, 16]} />
						<T.MeshStandardMaterial color={bodyColor} />
					</T.Mesh>

					<!-- 얼굴 (눈) -->
					<T.Group position={[0, 0.2, 0.12]}>
						<T.Mesh position.x={0.05}>
							<T.SphereGeometry args={[0.025, 8, 8]} />
							<T.MeshStandardMaterial color="#111111" />
						</T.Mesh>
						<T.Mesh position.x={-0.05}>
							<T.SphereGeometry args={[0.025, 8, 8]} />
							<T.MeshStandardMaterial color="#111111" />
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
							<T.MeshStandardMaterial color={bodyColor} />
						</T.Mesh>

						<!-- 팔꿈치 관절 -->
						<T.Group position.y={-0.3} rotation.x={joints.rightElbow.x}>
							<!-- 전완 -->
							<T.Mesh castShadow position.y={-0.13}>
								<T.CapsuleGeometry args={[0.045, 0.18, 4, 8]} />
								<T.MeshStandardMaterial color={bodyColor} />
							</T.Mesh>

							<!-- 손목 관절 -->
							<T.Group position.y={-0.28} rotation.x={joints.rightWrist.x}>
								<!-- 손 -->
								<T.Mesh castShadow>
									<T.BoxGeometry args={[0.06, 0.08, 0.04]} />
									<T.MeshStandardMaterial color={bodyColor} />
								</T.Mesh>

								<!-- 무기 -->
								{#if hasWeapon && weaponType === 'sword'}
									<T.Group position.y={-0.05}>
										<!-- 손잡이 -->
										<T.Mesh position.y={-0.12}>
											<T.CylinderGeometry args={[0.02, 0.025, 0.15, 8]} />
											<T.MeshStandardMaterial color="#4a3728" />
										</T.Mesh>
										<!-- 가드 -->
										<T.Mesh position.y={-0.2}>
											<T.BoxGeometry args={[0.15, 0.03, 0.06]} />
											<T.MeshStandardMaterial color="#8B4513" metalness={0.5} />
										</T.Mesh>
										<!-- 검날 -->
										<T.Mesh castShadow position.y={-0.55}>
											<T.BoxGeometry args={[0.05, 0.6, 0.015]} />
											<T.MeshStandardMaterial
												color={isCharging ? '#ff8800' : '#cccccc'}
												emissive={isCharging ? '#ff4400' : '#000000'}
												emissiveIntensity={isCharging ? chargeIntensity * 0.8 : 0}
												metalness={0.9}
												roughness={0.1}
											/>
										</T.Mesh>
										<!-- 검 끝 -->
										<T.Mesh castShadow position.y={-0.88}>
											<T.ConeGeometry args={[0.025, 0.08, 4]} />
											<T.MeshStandardMaterial
												color={isCharging ? '#ff8800' : '#cccccc'}
												metalness={0.9}
												roughness={0.1}
											/>
										</T.Mesh>
									</T.Group>
								{/if}

								{#if hasWeapon && weaponType === 'axe'}
									<T.Group position.y={-0.05}>
										<!-- 손잡이 -->
										<T.Mesh position.y={-0.4}>
											<T.CylinderGeometry args={[0.03, 0.035, 0.8, 8]} />
											<T.MeshStandardMaterial color="#3d2914" />
										</T.Mesh>
										<!-- 도끼 날 -->
										<T.Mesh castShadow position={[0.15, -0.75, 0]}>
											<T.BoxGeometry args={[0.25, 0.4, 0.06]} />
											<T.MeshStandardMaterial
												color="#555555"
												metalness={0.8}
												roughness={0.2}
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
							<T.MeshStandardMaterial color={bodyColor} />
						</T.Mesh>

						<!-- 팔꿈치 관절 -->
						<T.Group position.y={-0.3} rotation.x={joints.leftElbow.x}>
							<!-- 전완 -->
							<T.Mesh castShadow position.y={-0.13}>
								<T.CapsuleGeometry args={[0.045, 0.18, 4, 8]} />
								<T.MeshStandardMaterial color={bodyColor} />
							</T.Mesh>

							<!-- 손목 관절 -->
							<T.Group position.y={-0.28} rotation.x={joints.leftWrist.x}>
								<!-- 손 -->
								<T.Mesh castShadow>
									<T.BoxGeometry args={[0.06, 0.08, 0.04]} />
									<T.MeshStandardMaterial color={bodyColor} />
								</T.Mesh>

								<!-- 방패 -->
								{#if hasShield}
									<T.Group position={[0, -0.05, 0.1]}>
										<T.Mesh castShadow>
											<T.BoxGeometry args={[0.04, 0.35, 0.28]} />
											<T.MeshStandardMaterial
												color={animationState === 'guard' ? '#4488ff' : '#666666'}
												emissive={animationState === 'guard' ? '#2244aa' : '#000000'}
												emissiveIntensity={animationState === 'guard' ? 0.3 : 0}
												metalness={0.4}
												roughness={0.6}
											/>
										</T.Mesh>
										<!-- 방패 테두리 -->
										<T.Mesh position.z={0.005}>
											<T.RingGeometry args={[0.12, 0.14, 16]} />
											<T.MeshStandardMaterial color="#8B4513" metalness={0.5} />
										</T.Mesh>
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
						<T.MeshStandardMaterial color={accentColor} />
					</T.Mesh>

					<!-- 무릎 관절 -->
					<T.Group position.y={-0.45} rotation.x={joints.rightKnee.x}>
						<!-- 종아리 -->
						<T.Mesh castShadow position.y={-0.2}>
							<T.CapsuleGeometry args={[0.055, 0.26, 4, 8]} />
							<T.MeshStandardMaterial color={accentColor} />
						</T.Mesh>

						<!-- 발목 관절 -->
						<T.Group position.y={-0.42} rotation.x={joints.rightAnkle.x}>
							<!-- 발 -->
							<T.Mesh castShadow position={[0, -0.03, 0.04]}>
								<T.BoxGeometry args={[0.08, 0.06, 0.15]} />
								<T.MeshStandardMaterial color="#333333" />
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
						<T.MeshStandardMaterial color={accentColor} />
					</T.Mesh>

					<!-- 무릎 관절 -->
					<T.Group position.y={-0.45} rotation.x={joints.leftKnee.x}>
						<!-- 종아리 -->
						<T.Mesh castShadow position.y={-0.2}>
							<T.CapsuleGeometry args={[0.055, 0.26, 4, 8]} />
							<T.MeshStandardMaterial color={accentColor} />
						</T.Mesh>

						<!-- 발목 관절 -->
						<T.Group position.y={-0.42} rotation.x={joints.leftAnkle.x}>
							<!-- 발 -->
							<T.Mesh castShadow position={[0, -0.03, 0.04]}>
								<T.BoxGeometry args={[0.08, 0.06, 0.15]} />
								<T.MeshStandardMaterial color="#333333" />
							</T.Mesh>
						</T.Group>
					</T.Group>
				</T.Group>
			</T.Group>
		</T.Group>
	</T.Group>
</T.Group>
