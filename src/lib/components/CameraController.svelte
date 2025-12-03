<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import * as THREE from 'three';
	import { cameraMode } from '$lib/stores/gameStore';

	// Props
	let {
		targetPosition = new THREE.Vector3(),
		targetRotation = 0,
		onCameraRotationUpdate = (rot: number) => {}
	} = $props();

	let camera: THREE.PerspectiveCamera;
	let currentPosition = new THREE.Vector3(0, 5, 15);
	let currentLookAt = new THREE.Vector3();

	// 마우스 회전
	let mouseX = $state(0);
	let mouseY = $state(0);
	let isPointerLocked = $state(false);

	// 3인칭 카메라 설정
	const thirdPersonOffset = new THREE.Vector3(0, 4, 8);
	const firstPersonHeight = 1.7; // 눈 높이
	const firstPersonForward = 0.05; // 머리 앞쪽으로 약간 이동

	const cameraSmoothness = 0.1;

	function handleMouseMove(e: MouseEvent) {
		if (isPointerLocked) {
			mouseX -= e.movementX * 0.002;
			mouseY = Math.max(-0.5, Math.min(0.8, mouseY - e.movementY * 0.002));
			onCameraRotationUpdate(mouseX);
		}
	}

	function handleClick() {
		if (!isPointerLocked) {
			document.body.requestPointerLock();
		}
	}

	function handlePointerLockChange() {
		isPointerLocked = document.pointerLockElement === document.body;
	}

	useTask(() => {
		if (!camera) return;

		const mode = $cameraMode;
		let targetCameraPos: THREE.Vector3;
		let lookAtPos: THREE.Vector3;

		if (mode === 'third-person') {
			// 3인칭: 플레이어 뒤 위에서 따라감
			const rotatedOffset = new THREE.Vector3(
				Math.sin(mouseX) * thirdPersonOffset.z,
				thirdPersonOffset.y + mouseY * 5,
				Math.cos(mouseX) * thirdPersonOffset.z
			);
			targetCameraPos = targetPosition.clone().add(rotatedOffset);
			lookAtPos = targetPosition.clone().add(new THREE.Vector3(0, 1, 0));
		} else {
			// 1인칭: 플레이어 머리 정면 위치
			// 캐릭터가 바라보는 방향 (targetRotation)을 기준으로 카메라 위치 설정
			// 앞쪽(+)으로 이동하려면 sin/cos에 음수를 곱해야 함 (Three.js 좌표계)
			const forwardX = -Math.sin(targetRotation) * firstPersonForward;
			const forwardZ = -Math.cos(targetRotation) * firstPersonForward;

			targetCameraPos = targetPosition.clone().add(
				new THREE.Vector3(forwardX, firstPersonHeight, forwardZ)
			);

			// 캐릭터가 바라보는 방향으로 시선 설정
			// 마우스 Y로 위아래 시선 조절 가능
			const lookDir = new THREE.Vector3(
				-Math.sin(targetRotation),
				-mouseY,
				-Math.cos(targetRotation)
			);
			lookAtPos = targetCameraPos.clone().add(lookDir.multiplyScalar(10));
		}

		// 부드러운 카메라 이동
		currentPosition.lerp(targetCameraPos, cameraSmoothness);
		currentLookAt.lerp(lookAtPos, cameraSmoothness);

		camera.position.copy(currentPosition);
		camera.lookAt(currentLookAt);
	});
</script>

<svelte:window
	onmousemove={handleMouseMove}
/>
<svelte:document onpointerlockchange={handlePointerLockChange} />

<T.PerspectiveCamera
	bind:ref={camera}
	makeDefault
	fov={60}
	near={0.1}
	far={1000}
/>
