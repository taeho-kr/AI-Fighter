<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
	import GameUI from './GameUI.svelte';
	import { get } from 'svelte/store';
	import {
		resetGame, bossLevel, enemyMaxHealth, enemyHealth, nextRound, gameState
	} from '$lib/stores/gameStore';

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
