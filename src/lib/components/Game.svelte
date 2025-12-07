<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
	import GameUI from './GameUI.svelte';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import {
		resetGame, bossLevel, enemyMaxHealth, enemyHealth, nextRound, gameState,
		loadAILearningData, saveAILearningData
	} from '$lib/stores/gameStore';

	// 게임 시작 시 학습 데이터 로드
	onMount(() => {
		loadAILearningData();

		// 페이지 언로드 시 학습 데이터 저장
		const handleBeforeUnload = () => {
			saveAILearningData();
		};
		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			saveAILearningData();
		};
	});

	function handleRestart() {
		resetGame();
		const level = get(bossLevel);
		enemyMaxHealth.set(100 + (level - 1) * 20);
		enemyHealth.set(100 + (level - 1) * 20);
		gameState.set('playing');
	}

	function handleNextRound() {
		nextRound();
		const level = get(bossLevel);
		enemyMaxHealth.set(100 + (level - 1) * 20);
		enemyHealth.set(100 + (level - 1) * 20);
		// 라운드 종료 시 학습 데이터 저장
		saveAILearningData();
	}
</script>

<div class="game-container">
	<Canvas>
		<Scene />
	</Canvas>
	<GameUI onRestart={handleRestart} onNextRound={handleNextRound} />
</div>

<style>
	.game-container {
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}
</style>
