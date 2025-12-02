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
	const firstPersonOffset = new THREE.Vector3(0, 1.5, 0);

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
			// 1인칭: 플레이어 머리 위치
			targetCameraPos = targetPosition.clone().add(firstPersonOffset);

			// 마우스 방향으로 바라보기
			const lookDir = new THREE.Vector3(
				Math.sin(mouseX),
				-mouseY,
				-Math.cos(mouseX)
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
