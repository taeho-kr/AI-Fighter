<script lang="ts">
	import { T } from '@threlte/core';
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	let {
		damage = 10,
		position = [0, 0, 0] as [number, number, number],
		isCritical = false,
		isHeal = false,
		onComplete = () => {}
	}: {
		damage?: number;
		position?: [number, number, number];
		isCritical?: boolean;
		isHeal?: boolean;
		onComplete?: () => void;
	} = $props();

	let opacity = $state(1);
	let offsetY = $state(0);
	let scale = $state(isCritical ? 1.5 : 1);
	let startTime = Date.now();

	// 색상 결정
	const color = isHeal ? '#44ff44' : isCritical ? '#ff4444' : '#ffffff';
	const outlineColor = isHeal ? '#228822' : isCritical ? '#880000' : '#333333';

	onMount(() => {
		const duration = 1000; // 1초

		function animate() {
			const elapsed = Date.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// 위로 올라가면서 페이드 아웃
			offsetY = progress * 2; // 2 유닛 위로
			opacity = 1 - progress;

			// 크리티컬은 펀치 효과
			if (isCritical && progress < 0.2) {
				scale = 1.5 + Math.sin(progress * Math.PI * 5) * 0.3;
			}

			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				onComplete();
			}
		}

		animate();
	});
</script>

<T.Group position={[position[0], position[1] + offsetY, position[2]]}>
	<!-- 빌보드 효과를 위한 스프라이트 -->
	<T.Sprite scale={[scale * 0.8, scale * 0.4, 1]}>
		<T.SpriteMaterial
			transparent
			opacity={opacity}
			depthTest={false}
		>
			<!-- 캔버스 텍스처로 텍스트 렌더링 -->
			{#snippet children()}
				{@const canvas = (() => {
					const canvas = document.createElement('canvas');
					canvas.width = 256;
					canvas.height = 128;
					const ctx = canvas.getContext('2d');
					if (ctx) {
						ctx.font = `bold ${isCritical ? 72 : 56}px Arial`;
						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';

						// 외곽선
						ctx.strokeStyle = outlineColor;
						ctx.lineWidth = 8;
						ctx.strokeText(damage.toString(), 128, 64);

						// 텍스트
						ctx.fillStyle = color;
						ctx.fillText(damage.toString(), 128, 64);
					}
					return canvas;
				})()}
				<T.CanvasTexture args={[canvas]} />
			{/snippet}
		</T.SpriteMaterial>
	</T.Sprite>
</T.Group>
