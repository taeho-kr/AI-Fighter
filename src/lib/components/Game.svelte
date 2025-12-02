<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
	import GameUI from './GameUI.svelte';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import {
		resetGame, bossLevel, enemyMaxHealth, enemyHealth, nextRound, gameState
	} from '$lib/stores/gameStore';

	let container: HTMLDivElement;

	onMount(() => {
		// 자동으로 포커스
		container?.focus();

		// 클릭 시 포커스
		const handleClick = () => container?.focus();
		container?.addEventListener('click', handleClick);

		return () => {
			container?.removeEventListener('click', handleClick);
		};
	});

	// 게임 재시작
	function handleRestart() {
		resetGame();
		// 보스 체력도 레벨에 맞게 리셋
		const level = get(bossLevel);
		enemyMaxHealth.set(100 + (level - 1) * 20);
		enemyHealth.set(100 + (level - 1) * 20);
		// 게임 상태를 playing으로 변경
		gameState.set('playing');
	}

	// 다음 라운드
	function handleNextRound() {
		nextRound();
		// 보스 체력 증가
		const level = get(bossLevel);
		enemyMaxHealth.set(100 + (level - 1) * 20);
		enemyHealth.set(100 + (level - 1) * 20);
	}
</script>

<div
	class="game-container"
	bind:this={container}
	tabindex="-1"
	role="application"
>
	<Canvas>
		<Scene />
	</Canvas>
</div>

<!-- UI (Three.js 캔버스 외부에서 렌더링) -->
<GameUI
	onRestart={handleRestart}
	onNextRound={handleNextRound}
/>

<style>
	.game-container {
		width: 100vw;
		height: 100vh;
		outline: none;
	}
</style>
