<script lang="ts">
	import { Canvas } from '@threlte/core';
	import Scene from './Scene.svelte';
</script>

<div class="game-container">
	<Canvas>
		<Scene />
	</Canvas>
</div>

<style>
	.game-container {
		width: 100vw;
		height: 100vh;
	}
</style>
