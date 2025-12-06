<script lang="ts">
	import {
		playerHealth, playerMaxHealth, playerStamina, playerMaxStamina,
		enemyHealth, enemyMaxHealth, gameState, currentRound, bossLevel,
		startGame
	} from '$lib/stores/gameStore';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	let { onRestart = () => {}, onNextRound = () => {} }: { onRestart?: () => void, onNextRound?: () => void } = $props();

	function togglePause() {
		const current = get(gameState);
		if (current === 'playing') {
			gameState.set('paused');
			if (document.pointerLockElement) {
				document.exitPointerLock();
			}
		} else if (current === 'paused') {
			gameState.set('playing');
		}
	}

	function resumeGame() {
		gameState.set('playing');
	}

	function restartGame() {
		onRestart();
		startGame();
	}

	function exitToMenu() {
		gameState.set('menu');
		onRestart();
	}

	$effect(() => {
		if ($gameState === 'victory' || $gameState === 'dead') {
			if (document.pointerLockElement) {
				document.exitPointerLock();
			}
		}
	});

	onMount(() => {
		function onKeyDown(e: KeyboardEvent) {
			if (e.code === 'Escape') {
				e.preventDefault();
				const current = get(gameState);
				if (current === 'playing' || current === 'paused') {
					togglePause();
				}
				return;
			}

			if (e.code === 'Enter') {
				const current = get(gameState);
				if (current === 'victory') {
					onNextRound();
				} else if (current === 'dead') {
					onRestart();
				} else if (current === 'menu') {
					startGame();
				}
				return;
			}
		}

		document.addEventListener('keydown', onKeyDown, true);
		return () => {
			document.removeEventListener('keydown', onKeyDown, true);
		};
	});
</script>

<div class="game-ui">
	{#if $gameState === 'playing' || $gameState === 'paused'}
		<!-- 플레이어 HP/스태미나 -->
		<div class="player-stats">
			<div class="stat-bar health">
				<span class="label">HP</span>
				<div class="bar-bg">
					<div class="bar-fill" style="width: {($playerHealth / $playerMaxHealth) * 100}%"></div>
				</div>
			</div>
			<div class="stat-bar stamina">
				<span class="label">ST</span>
				<div class="bar-bg">
					<div class="bar-fill" style="width: {($playerStamina / $playerMaxStamina) * 100}%"></div>
				</div>
			</div>
		</div>

		<!-- 적 HP -->
		<div class="enemy-stats">
			<div class="boss-name">AI Lv.{$bossLevel}</div>
			<div class="bar-bg enemy">
				<div class="bar-fill" style="width: {($enemyHealth / $enemyMaxHealth) * 100}%"></div>
			</div>
		</div>

		<!-- 라운드 -->
		<div class="round">Round {$currentRound}</div>
	{/if}

	{#if $gameState === 'dead'}
		<div class="overlay">
			<div class="screen dead">
				<h1>YOU DIED</h1>
				<p>Round {$currentRound}</p>
				<button onclick={onRestart}>Retry</button>
				<p class="hint">Press Enter</p>
			</div>
		</div>
	{/if}

	{#if $gameState === 'victory'}
		<div class="overlay victory">
			<div class="screen">
				<h1>VICTORY</h1>
				<p>Round {$currentRound} Clear!</p>
				<p class="level-up">AI Lv.{$bossLevel} → Lv.{$bossLevel + 1}</p>
				<button onclick={onNextRound}>Next Round</button>
				<p class="hint">Press Enter</p>
			</div>
		</div>
	{/if}

	{#if $gameState === 'menu'}
		<div class="overlay menu">
			<div class="screen">
				<h1>AI FIGHTER</h1>
				<p class="subtitle">AI learns your patterns</p>
				<button onclick={() => startGame()}>START</button>
			</div>
		</div>
	{/if}

	{#if $gameState === 'paused'}
		<div class="overlay">
			<div class="screen">
				<h1>PAUSED</h1>
				<button onclick={resumeGame}>Resume</button>
				<button onclick={restartGame}>Restart</button>
				<button onclick={exitToMenu}>Exit</button>
				<p class="hint">Press ESC</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.game-ui {
		position: fixed;
		inset: 0;
		pointer-events: none;
		font-family: system-ui, sans-serif;
		color: white;
		z-index: 100;
	}

	.player-stats {
		position: absolute;
		bottom: 40px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.stat-bar {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.label {
		width: 24px;
		font-size: 12px;
		font-weight: bold;
	}

	.bar-bg {
		width: 250px;
		height: 12px;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 4px;
		overflow: hidden;
	}

	.bar-bg.enemy {
		width: 350px;
		height: 20px;
	}

	.bar-fill {
		height: 100%;
		transition: width 0.2s;
	}

	.health .bar-fill { background: #e74c3c; }
	.stamina .bar-fill { background: #2ecc71; }
	.enemy .bar-fill { background: #e74c3c; }

	.enemy-stats {
		position: absolute;
		top: 30px;
		left: 50%;
		transform: translateX(-50%);
		text-align: center;
	}

	.boss-name {
		font-size: 18px;
		font-weight: bold;
		margin-bottom: 8px;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
	}

	.round {
		position: absolute;
		top: 30px;
		right: 30px;
		font-size: 20px;
		font-weight: bold;
	}

	.overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
	}

	.overlay.victory { background: rgba(0, 40, 0, 0.85); }
	.overlay.menu { background: rgba(20, 20, 40, 0.95); }

	.screen {
		text-align: center;
	}

	.screen h1 {
		font-size: 56px;
		margin: 0 0 20px;
	}

	.screen.dead h1 { color: #e74c3c; }
	.overlay.victory h1 { color: #2ecc71; }
	.overlay.menu h1 { color: #3498db; }

	.subtitle {
		opacity: 0.7;
		margin-bottom: 30px;
	}

	.level-up {
		color: #2ecc71;
		font-size: 18px;
		margin: 20px 0;
	}

	button {
		display: block;
		margin: 10px auto;
		padding: 12px 40px;
		font-size: 16px;
		background: #3498db;
		border: none;
		color: white;
		border-radius: 6px;
		cursor: pointer;
	}

	button:hover {
		background: #2980b9;
	}

	.hint {
		margin-top: 20px;
		font-size: 12px;
		opacity: 0.5;
	}
</style>
