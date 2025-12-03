<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { useGltf } from '@threlte/extras';
	import * as THREE from 'three';

	// Props
	let {
		modelPath = '/models/soldier.glb',
		scale = 1,
		position = [0, 0, 0] as [number, number, number],
		animationState = 'idle' as string,
		isHit = false,
		isCharging = false,
		chargeIntensity = 0,
		tint = null as string | null
	} = $props();

	// 게임 상태 → KayKit GLB 애니메이션 이름 매핑
	function mapAnimationState(state: string): string {
		switch (state) {
			case 'idle': return 'Idle';
			case 'walk': return 'Walking_A';
			case 'run': return 'Running_A';
			case 'attack_light': return '1H_Melee_Attack_Slice_Horizontal';
			case 'attack_heavy': return '2H_Melee_Attack_Spin';  // 회전 공격
			case 'charging': return '2H_Melee_Idle';
			case 'guard': return 'Blocking';
			case 'parry': return 'Block_Attack';
			case 'dodge': return 'Dodge_Backward';
			case 'stunned': return 'Hit_A';
			default: return 'Idle';
		}
	}

	// 실제 사용할 애니메이션 이름
	let animationName = $derived(mapAnimationState(animationState));

	// GLTF 로드
	const gltf = useGltf(modelPath, { useDraco: false });

	// 애니메이션 믹서
	let mixer = $state<THREE.AnimationMixer | null>(null);
	let actions = $state<Map<string, THREE.AnimationAction>>(new Map());
	let currentAction = $state<THREE.AnimationAction | null>(null);
	let modelReady = $state(false);

	// 모델 초기화
	$effect(() => {
		const gltfData = $gltf;
		if (!gltfData) return;

		const scene = gltfData.scene;

		console.log('[CharacterModel] Model loaded:', modelPath);

		// 그림자 설정 및 재질 복제
		scene.traverse((child) => {
			if (child instanceof THREE.Mesh) {
				child.castShadow = true;
				child.receiveShadow = true;

				// 재질 복제 (공유 재질 문제 방지)
				if (child.material) {
					child.material = (child.material as THREE.Material).clone();
				}
			}
		});

		// 애니메이션 믹서 설정
		if (gltfData.animations && gltfData.animations.length > 0) {
			const newMixer = new THREE.AnimationMixer(scene);
			const newActions = new Map<string, THREE.AnimationAction>();

			console.log('[CharacterModel] Available animations:');
			gltfData.animations.forEach((clip) => {
				console.log('  -', clip.name);
				const action = newMixer.clipAction(clip);
				newActions.set(clip.name.toLowerCase(), action);
			});

			mixer = newMixer;
			actions = newActions;

			// 기본 애니메이션 재생
			const defaultAction = newActions.get('idle') || newActions.get('tpose') || newActions.values().next().value;
			if (defaultAction) {
				defaultAction.play();
				currentAction = defaultAction;
			}
		} else {
			console.log('[CharacterModel] No animations found');
		}

		modelReady = true;
	});

	// 애니메이션 전환
	$effect(() => {
		if (!mixer || actions.size === 0) return;

		const targetName = animationName.toLowerCase();
		let targetAction = actions.get(targetName);

		// 부분 매칭 시도
		if (!targetAction) {
			for (const [name, action] of actions) {
				if (name.includes(targetName) || targetName.includes(name)) {
					targetAction = action;
					break;
				}
			}
		}

		// 기본 애니메이션
		if (!targetAction) {
			targetAction = actions.get('idle') || actions.get('tpose') || actions.values().next().value;
		}

		if (targetAction && targetAction !== currentAction) {
			if (currentAction) {
				currentAction.fadeOut(0.2);
			}
			targetAction.reset().fadeIn(0.2).play();
			currentAction = targetAction;
		}
	});

	// 히트/차징 효과
	$effect(() => {
		const gltfData = $gltf;
		if (!gltfData) return;

		gltfData.scene.traverse((child) => {
			if (child instanceof THREE.Mesh && child.material) {
				const mat = child.material as THREE.MeshStandardMaterial;
				if (mat.emissive) {
					if (isHit) {
						mat.emissive.setHex(0xff0000);
						mat.emissiveIntensity = 0.5;
					} else if (isCharging) {
						mat.emissive.setHex(0xff8800);
						mat.emissiveIntensity = chargeIntensity * 0.5;
					} else {
						mat.emissiveIntensity = 0;
					}
				}
			}
		});
	});

	// 색상 틴트 적용
	$effect(() => {
		const gltfData = $gltf;
		if (!gltfData || !tint) return;

		const tintColor = new THREE.Color(tint);
		gltfData.scene.traverse((child) => {
			if (child instanceof THREE.Mesh && child.material) {
				const mat = child.material as THREE.MeshStandardMaterial;
				if (mat.color) {
					mat.color.lerp(tintColor, 0.3);
				}
			}
		});
	});

	// 애니메이션 업데이트
	useTask((delta) => {
		if (mixer) {
			mixer.update(delta);
		}
	});
</script>

{#if $gltf && modelReady}
	<!-- KayKit 모델은 약 1m 높이, 스케일 1.8로 키움, 발이 원점에 있음 -->
	<T.Group position={position} scale={[scale * 1.8, scale * 1.8, scale * 1.8]}>
		<T is={$gltf.scene} />
	</T.Group>
{:else}
	<!-- 로딩 중 플레이스홀더 -->
	<T.Group position={position}>
		<T.Mesh position.y={0.9}>
			<T.CapsuleGeometry args={[0.3, 1, 4, 8]} />
			<T.MeshStandardMaterial color="#666666" transparent opacity={0.5} />
		</T.Mesh>
	</T.Group>
{/if}
