<script lang="ts">
	import {
		playerHealth, playerMaxHealth, playerStamina, playerMaxStamina,
		enemyHealth, enemyMaxHealth, gameState, currentRound, bossLevel,
		cameraMode, resetGame, aiLearningData
	} from '$lib/stores/gameStore';

	let { onRestart = () => {}, onNextRound = () => {} } = $props();

	// 조작 가이드 표시
	let showControls = $state(true);
</script>

<div class="game-ui">
	<!-- 플레이어 체력/스태미나 바 -->
	<div class="player-stats">
		<div class="stat-bar health">
			<div class="stat-label">HP</div>
			<div class="stat-bg">
				<div class="stat-fill" style="width: {($playerHealth / $playerMaxHealth) * 100}%"></div>
			</div>
			<div class="stat-value">{Math.ceil($playerHealth)}/{$playerMaxHealth}</div>
		</div>
		<div class="stat-bar stamina">
			<div class="stat-label">ST</div>
			<div class="stat-bg">
				<div class="stat-fill" style="width: {($playerStamina / $playerMaxStamina) * 100}%"></div>
			</div>
			<div class="stat-value">{Math.ceil($playerStamina)}/{$playerMaxStamina}</div>
		</div>
	</div>

	<!-- 적 체력 바 -->
	<div class="enemy-stats">
		<div class="boss-name">BOSS Lv.{$bossLevel}</div>
		<div class="stat-bar enemy-health">
			<div class="stat-bg">
				<div class="stat-fill" style="width: {($enemyHealth / $enemyMaxHealth) * 100}%"></div>
			</div>
		</div>
	</div>

	<!-- 라운드 표시 -->
	<div class="round-display">
		Round {$currentRound}
	</div>

	<!-- 카메라 모드 표시 -->
	<div class="camera-mode">
		{$cameraMode === 'first-person' ? '1인칭' : '3인칭'} (V키로 전환)
	</div>

	<!-- 조작 가이드 -->
	{#if showControls}
		<div class="controls-guide">
			<button class="close-btn" onclick={() => showControls = false}>×</button>
			<h3>조작법</h3>
			<div class="control-row"><span class="key">WASD</span> 이동</div>
			<div class="control-row"><span class="key">좌클릭</span> 약공격</div>
			<div class="control-row"><span class="key">Q</span> 강공격</div>
			<div class="control-row"><span class="key">우클릭</span> 가드</div>
			<div class="control-row"><span class="key">E</span> 패링</div>
			<div class="control-row"><span class="key">Shift</span> 회피</div>
			<div class="control-row"><span class="key">V</span> 시점 전환</div>
		</div>
	{:else}
		<button class="show-controls-btn" onclick={() => showControls = true}>?</button>
	{/if}

	<!-- AI 학습 현황 (디버그/정보) -->
	<div class="ai-learning-info">
		<div class="learning-title">AI 학습 현황</div>
		<div class="learning-item">
			공격 패턴: 약({$aiLearningData.attackPatterns.light_attack}) / 강({$aiLearningData.attackPatterns.heavy_attack})
		</div>
		<div class="learning-item">
			회피 방향: ←{$aiLearningData.dodgeDirections.left} →{$aiLearningData.dodgeDirections.right} ↑{$aiLearningData.dodgeDirections.forward} ↓{$aiLearningData.dodgeDirections.backward}
		</div>
		<div class="learning-item">
			방어: 가드({$aiLearningData.defensiveActions.guard}) / 패링({$aiLearningData.defensiveActions.parry})
		</div>
	</div>

	<!-- 게임 오버 화면 -->
	{#if $gameState === 'dead'}
		<div class="overlay">
			<div class="game-over">
				<h1>YOU DIED</h1>
				<p>Round {$currentRound}</p>
				<p class="warning">보스가 당신의 패턴을 학습했습니다...</p>
				<button onclick={onRestart}>재도전</button>
			</div>
		</div>
	{/if}

	<!-- 승리 화면 -->
	{#if $gameState === 'victory'}
		<div class="overlay victory">
			<div class="victory-screen">
				<h1>VICTORY</h1>
				<p>Round {$currentRound} 클리어!</p>
				<p class="info">보스 레벨이 상승합니다. (Lv.{$bossLevel} → Lv.{$bossLevel + 1})</p>
				<button onclick={onNextRound}>다음 라운드</button>
			</div>
		</div>
	{/if}

	<!-- 시작 화면 -->
	{#if $gameState === 'menu'}
		<div class="overlay menu">
			<div class="menu-screen">
				<h1>ADAPTIVE BOSS</h1>
				<p class="subtitle">학습하는 보스와의 전투</p>
				<button onclick={() => gameState.set('playing')}>게임 시작</button>
				<p class="description">
					보스는 당신의 전투 패턴을 학습합니다.<br>
					매 라운드마다 더 강해지고 더 똑똑해집니다.
				</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.game-ui {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		font-family: 'Segoe UI', sans-serif;
		color: white;
		z-index: 100;
	}

	.player-stats {
		position: absolute;
		bottom: 30px;
		left: 30px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.stat-bar {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.stat-label {
		width: 30px;
		font-weight: bold;
		font-size: 14px;
	}

	.stat-bg {
		width: 200px;
		height: 20px;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.stat-fill {
		height: 100%;
		transition: width 0.2s ease;
	}

	.health .stat-fill {
		background: linear-gradient(to right, #ff4444, #ff6b6b);
	}

	.stamina .stat-fill {
		background: linear-gradient(to right, #44ff44, #88ff88);
	}

	.stat-value {
		font-size: 12px;
		opacity: 0.8;
	}

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
		color: #e94560;
	}

	.enemy-health .stat-bg {
		width: 400px;
		height: 24px;
	}

	.enemy-health .stat-fill {
		background: linear-gradient(to right, #e94560, #ff6b8a);
	}

	.round-display {
		position: absolute;
		top: 30px;
		right: 30px;
		font-size: 24px;
		font-weight: bold;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
	}

	.camera-mode {
		position: absolute;
		bottom: 30px;
		right: 30px;
		font-size: 14px;
		opacity: 0.7;
	}

	.controls-guide {
		position: absolute;
		top: 100px;
		right: 30px;
		background: rgba(0, 0, 0, 0.7);
		padding: 15px 20px;
		border-radius: 8px;
		pointer-events: auto;
	}

	.controls-guide h3 {
		margin: 0 0 10px 0;
		font-size: 16px;
	}

	.control-row {
		font-size: 13px;
		margin: 5px 0;
	}

	.key {
		display: inline-block;
		background: rgba(255, 255, 255, 0.2);
		padding: 2px 8px;
		border-radius: 4px;
		margin-right: 8px;
		min-width: 60px;
		text-align: center;
	}

	.close-btn {
		position: absolute;
		top: 5px;
		right: 10px;
		background: none;
		border: none;
		color: white;
		font-size: 20px;
		cursor: pointer;
		opacity: 0.7;
	}

	.close-btn:hover {
		opacity: 1;
	}

	.show-controls-btn {
		position: absolute;
		top: 100px;
		right: 30px;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.7);
		border: none;
		color: white;
		font-size: 18px;
		cursor: pointer;
		pointer-events: auto;
	}

	.ai-learning-info {
		position: absolute;
		bottom: 100px;
		left: 30px;
		background: rgba(0, 0, 0, 0.5);
		padding: 10px 15px;
		border-radius: 8px;
		font-size: 11px;
		opacity: 0.7;
	}

	.learning-title {
		font-weight: bold;
		margin-bottom: 5px;
		color: #e94560;
	}

	.learning-item {
		margin: 3px 0;
	}

	.overlay {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
	}

	.game-over, .victory-screen, .menu-screen {
		text-align: center;
	}

	.game-over h1 {
		font-size: 72px;
		color: #ff4444;
		margin: 0;
		text-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
	}

	.victory-screen h1 {
		font-size: 72px;
		color: #44ff44;
		margin: 0;
		text-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
	}

	.menu-screen h1 {
		font-size: 56px;
		color: #e94560;
		margin: 0;
		text-shadow: 0 0 30px rgba(233, 69, 96, 0.5);
	}

	.subtitle {
		font-size: 18px;
		opacity: 0.8;
		margin-bottom: 30px;
	}

	.warning {
		color: #ffaa00;
		margin: 20px 0;
	}

	.info {
		color: #88ff88;
		margin: 20px 0;
	}

	.description {
		font-size: 14px;
		opacity: 0.7;
		margin-top: 30px;
		line-height: 1.6;
	}

	button {
		padding: 15px 40px;
		font-size: 18px;
		background: #e94560;
		border: none;
		color: white;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		margin-top: 20px;
	}

	button:hover {
		background: #ff6b8a;
		transform: scale(1.05);
	}

	.overlay.victory {
		background: rgba(0, 30, 0, 0.8);
	}

	.overlay.menu {
		background: linear-gradient(135deg, rgba(26, 26, 46, 0.95), rgba(15, 52, 96, 0.95));
	}
</style>
