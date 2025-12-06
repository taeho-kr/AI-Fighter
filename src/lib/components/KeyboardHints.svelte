<script lang="ts">
	import { gameState, playerState } from '$lib/stores/gameStore';

	// 현재 액션에 따른 힌트 표시
	let currentHint = $derived.by(() => {
		const state = $playerState;

		if (state === 'guarding') {
			return { text: 'RMB로 패링!', highlight: true };
		}
		if (state === 'attacking') {
			return null; // 공격 중에는 힌트 숨김
		}
		return null;
	});

	// 게임 플레이 중에만 표시
	let showHints = $derived($gameState === 'playing');
</script>

{#if showHints}
	<div class="keyboard-hints">
		<!-- 기본 조작 힌트 -->
		<div class="hints-row">
			<div class="hint-group">
				<div class="key-combo">
					<span class="key">W</span>
					<span class="key">A</span>
					<span class="key">S</span>
					<span class="key">D</span>
				</div>
				<span class="hint-label">이동</span>
			</div>

			<div class="hint-group">
				<span class="key mouse">LMB</span>
				<span class="hint-label">약공격</span>
			</div>

			<div class="hint-group">
				<span class="key mouse">LMB 홀드</span>
				<span class="hint-label">강공격</span>
			</div>

			<div class="hint-group">
				<span class="key mouse">RMB</span>
				<span class="hint-label">가드</span>
			</div>

			<div class="hint-group">
				<span class="key mouse">RMB 탭</span>
				<span class="hint-label">패링</span>
			</div>

			<div class="hint-group">
				<span class="key">Space</span>
				<span class="hint-label">회피</span>
			</div>
		</div>

		<!-- 상황별 힌트 -->
		{#if currentHint}
			<div class="action-hint" class:highlight={currentHint.highlight}>
				{currentHint.text}
			</div>
		{/if}
	</div>
{/if}

<style>
	.keyboard-hints {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		pointer-events: none;
		z-index: 100;
	}

	.hints-row {
		display: flex;
		gap: 20px;
		background: rgba(0, 0, 0, 0.5);
		padding: 10px 20px;
		border-radius: 10px;
		backdrop-filter: blur(5px);
	}

	.hint-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.key-combo {
		display: flex;
		gap: 2px;
	}

	.key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 8px;
		background: linear-gradient(180deg, #444 0%, #222 100%);
		border: 1px solid #555;
		border-radius: 4px;
		color: #fff;
		font-size: 12px;
		font-weight: bold;
		font-family: monospace;
		box-shadow: 0 2px 0 #111, inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.key.mouse {
		background: linear-gradient(180deg, #553344 0%, #331122 100%);
		border-color: #664455;
		min-width: auto;
	}

	.hint-label {
		font-size: 10px;
		color: #aaa;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.action-hint {
		background: rgba(255, 200, 100, 0.2);
		border: 1px solid rgba(255, 200, 100, 0.4);
		padding: 8px 16px;
		border-radius: 6px;
		color: #ffc864;
		font-size: 14px;
		font-weight: bold;
		animation: pulse 1s ease-in-out infinite;
	}

	.action-hint.highlight {
		background: rgba(255, 100, 100, 0.3);
		border-color: rgba(255, 100, 100, 0.5);
		color: #ff8888;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.8; transform: scale(1.02); }
	}

	@media (max-width: 768px) {
		.hints-row {
			flex-wrap: wrap;
			justify-content: center;
		}

		.key {
			min-width: 24px;
			height: 24px;
			font-size: 10px;
		}
	}
</style>
