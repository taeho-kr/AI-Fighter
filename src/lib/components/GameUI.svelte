<script lang="ts">
	import {
		playerHealth, playerMaxHealth, playerStamina, playerMaxStamina,
		enemyHealth, enemyMaxHealth, gameState, currentRound, bossLevel,
		cameraMode, resetGame, startGame, aiLearningData, aiStats, aiLearningEnabled, resetAILearning
	} from '$lib/stores/gameStore';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	let { onRestart = () => {}, onNextRound = () => {} } = $props();

	// 조작 가이드 표시
	let showControls = $state(true);
	let showAIDebug = $state(true);
	let showHowToPlay = $state(false);

	// AI 학습 상태
	let isLearning = $state(false);
	let learningProgress = $state(0);
	let learningPhase = $state<'collecting' | 'combat' | 'movement' | 'optimizing' | 'complete'>('collecting');
	let learningComplete = $state(false);
	let currentLearningItem = $state('');  // 현재 학습 중인 항목

	// 입력 디버그
	let inputDebug = $state({
		keys: { w: false, a: false, s: false, d: false, shift: false },
		mouse: { left: false, right: false },
		charging: false
	});

	// 일시정지 기능
	function togglePause() {
		const current = get(gameState);
		if (current === 'playing') {
			gameState.set('paused');
			// 포인터 락 해제
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

	// AI 학습 시작 (승리 시 호출)
	function startAILearning() {
		isLearning = true;
		learningProgress = 0;
		learningPhase = 'collecting';
		learningComplete = false;
		currentLearningItem = '';

		const data = get(aiLearningData);

		// 경향성 기반 학습 항목 생성 (수치 없이 경향만 표시)
		const learningItems: string[] = [];

		// 전투 스타일 분석
		const totalAttacks = data.attackPatterns.light_attack + data.attackPatterns.heavy_attack;
		if (totalAttacks > 0) {
			const lightRatio = data.attackPatterns.light_attack / totalAttacks;
			if (lightRatio > 0.7) {
				learningItems.push('빠른 연속 공격 패턴 감지...');
			} else if (lightRatio < 0.3) {
				learningItems.push('강력한 일격 패턴 감지...');
			} else {
				learningItems.push('혼합 공격 패턴 분석 중...');
			}
		}

		// 방어 스타일
		const totalDefense = data.defensiveActions.guard + data.defensiveActions.parry;
		if (totalDefense > 0) {
			const parryRatio = data.defensiveActions.parry / totalDefense;
			if (parryRatio > 0.5) {
				learningItems.push('적극적 반격 성향 학습 중...');
			} else {
				learningItems.push('수비적 방어 성향 학습 중...');
			}
		}

		// 회피 패턴
		const dodges = data.dodgeDirections;
		const maxDodge = Math.max(dodges.left, dodges.right, dodges.forward, dodges.backward);
		if (maxDodge > 0) {
			if (dodges.left === maxDodge || dodges.right === maxDodge) {
				learningItems.push('측면 회피 경향 분석 중...');
			} else if (dodges.backward === maxDodge) {
				learningItems.push('후방 이탈 패턴 학습 중...');
			} else {
				learningItems.push('전진 돌파 패턴 학습 중...');
			}
		}

		// 움직임 패턴
		const mv = data.movementPatterns;
		const distTotal = mv.preferredDistance.close + mv.preferredDistance.mid + mv.preferredDistance.far;
		if (distTotal > 0) {
			if (mv.preferredDistance.close > mv.preferredDistance.far) {
				learningItems.push('근접 교전 선호 패턴 감지...');
			} else if (mv.preferredDistance.far > mv.preferredDistance.close) {
				learningItems.push('원거리 유지 패턴 감지...');
			}
		}

		if (Math.abs(mv.approachTendency) > 10) {
			learningItems.push(mv.approachTendency > 0 ? '공격적 접근 성향 학습 중...' : '신중한 거리 유지 학습 중...');
		}

		if (Math.abs(mv.strafeTendency) > 20) {
			learningItems.push('측면 기동 패턴 분석 중...');
		}

		// 기본 항목
		if (learningItems.length === 0) {
			learningItems.push('플레이어 행동 데이터 수집 중...');
		}
		learningItems.push('신경망 가중치 조정 중...');
		learningItems.push('대응 전략 최적화 중...');

		// 학습 단계 정의
		const phases: Array<{ phase: 'collecting' | 'combat' | 'movement' | 'optimizing' | 'complete', duration: number }> = [
			{ phase: 'collecting', duration: 800 },
			{ phase: 'combat', duration: 1200 },
			{ phase: 'movement', duration: 1200 },
			{ phase: 'optimizing', duration: 800 },
			{ phase: 'complete', duration: 500 }
		];

		let elapsed = 0;
		let itemIndex = 0;
		const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0);
		const itemInterval = totalDuration / learningItems.length;

		function animate() {
			elapsed += 50;
			learningProgress = Math.min((elapsed / totalDuration) * 100, 100);

			// 현재 학습 항목 업데이트
			const newIndex = Math.min(Math.floor(elapsed / itemInterval), learningItems.length - 1);
			if (newIndex !== itemIndex) {
				itemIndex = newIndex;
				currentLearningItem = learningItems[itemIndex];
			}
			if (itemIndex === 0 && !currentLearningItem) {
				currentLearningItem = learningItems[0];
			}

			// 현재 단계 결정
			let accumulated = 0;
			for (const p of phases) {
				accumulated += p.duration;
				if (elapsed <= accumulated) {
					learningPhase = p.phase;
					break;
				}
			}

			if (elapsed < totalDuration) {
				setTimeout(animate, 50);
			} else {
				// 학습 완료
				learningComplete = true;
				isLearning = false;
				currentLearningItem = '';

				// DQN 에피소드 종료는 Scene에서 처리됨

				// 포인터 락 해제 (마우스 커서 표시)
				if (document.pointerLockElement) {
					document.exitPointerLock();
				}
			}
		}

		animate();
	}

	// gameState가 victory로 변경될 때 학습 시작
	$effect(() => {
		if ($gameState === 'victory' && !isLearning && !learningComplete) {
			startAILearning();
		}
		// 다른 상태로 변경되면 학습 상태 리셋
		if ($gameState !== 'victory') {
			isLearning = false;
			learningComplete = false;
			learningProgress = 0;
		}
	});

	// 사망 시 포인터 락 해제
	$effect(() => {
		if ($gameState === 'dead') {
			if (document.pointerLockElement) {
				document.exitPointerLock();
			}
		}
	});

	onMount(() => {
		function onKeyDown(e: KeyboardEvent) {
			// ESC 키 처리
			if (e.code === 'Escape') {
				e.preventDefault();
				const current = get(gameState);
				if (current === 'playing' || current === 'paused') {
					togglePause();
				}
				// How to Play 패널 닫기
				if (showHowToPlay) {
					showHowToPlay = false;
				}
				return;
			}

			// 엔터 키 처리 - 승리/사망 화면에서 다음 진행
			if (e.code === 'Enter') {
				const current = get(gameState);
				if (current === 'victory' && learningComplete) {
					onNextRound();
				} else if (current === 'dead') {
					onRestart();
				} else if (current === 'menu') {
					startGame();
				}
				return;
			}

			// 디버그 입력 추적
			if (e.code === 'KeyW') inputDebug.keys.w = true;
			if (e.code === 'KeyA') inputDebug.keys.a = true;
			if (e.code === 'KeyS') inputDebug.keys.s = true;
			if (e.code === 'KeyD') inputDebug.keys.d = true;
			if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inputDebug.keys.shift = true;
		}

		function onKeyUp(e: KeyboardEvent) {
			if (e.code === 'KeyW') inputDebug.keys.w = false;
			if (e.code === 'KeyA') inputDebug.keys.a = false;
			if (e.code === 'KeyS') inputDebug.keys.s = false;
			if (e.code === 'KeyD') inputDebug.keys.d = false;
			if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inputDebug.keys.shift = false;
		}

		function onMouseDown(e: MouseEvent) {
			if (e.button === 0) {
				inputDebug.mouse.left = true;
				inputDebug.charging = true;
			}
			if (e.button === 2) inputDebug.mouse.right = true;
		}

		function onMouseUp(e: MouseEvent) {
			if (e.button === 0) {
				inputDebug.mouse.left = false;
				inputDebug.charging = false;
			}
			if (e.button === 2) inputDebug.mouse.right = false;
		}

		// document에 직접 리스너 등록 (캡처 단계에서)
		document.addEventListener('keydown', onKeyDown, true);
		document.addEventListener('keyup', onKeyUp, true);
		document.addEventListener('mousedown', onMouseDown, true);
		document.addEventListener('mouseup', onMouseUp, true);

		return () => {
			document.removeEventListener('keydown', onKeyDown, true);
			document.removeEventListener('keyup', onKeyUp, true);
			document.removeEventListener('mousedown', onMouseDown, true);
			document.removeEventListener('mouseup', onMouseUp, true);
		};
	});
</script>

<div class="game-ui">
	<!-- 입력 디버그 (좌측 상단) - playing 상태에서만 표시 -->
	{#if $gameState === 'playing'}
		<div class="input-debug">
			<div class="debug-title">INPUT</div>
			<div class="key-display">
				<div class="key-row">
					<span class="key-box" class:active={inputDebug.keys.w}>W</span>
				</div>
				<div class="key-row">
					<span class="key-box" class:active={inputDebug.keys.a}>A</span>
					<span class="key-box" class:active={inputDebug.keys.s}>S</span>
					<span class="key-box" class:active={inputDebug.keys.d}>D</span>
				</div>
				<div class="key-row">
					<span class="key-box wide" class:active={inputDebug.keys.shift}>SHIFT</span>
				</div>
			</div>
			<div class="mouse-display">
				<span class="mouse-btn" class:active={inputDebug.mouse.left}>L</span>
				<span class="mouse-btn" class:active={inputDebug.mouse.right}>R</span>
			</div>
			{#if inputDebug.charging}
				<div class="charging-indicator">CHARGING...</div>
			{/if}
		</div>
	{/if}

	<!-- 게임 플레이 중 UI -->
	{#if $gameState === 'playing' || $gameState === 'paused'}
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
			<div class="boss-name">Artificial Intelligence Lv.{$bossLevel}</div>
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
	{/if}

	<!-- 조작 가이드 (playing 상태에서만) -->
	{#if $gameState === 'playing'}
		{#if showControls}
			<div class="controls-guide">
				<button class="close-btn" onclick={() => showControls = false}>×</button>
				<h3>조작법</h3>
				<div class="control-row"><span class="key">WASD</span> 이동</div>
				<div class="control-row"><span class="key">좌클릭</span> 약공격</div>
				<div class="control-row"><span class="key">좌클릭 홀드</span> 강공격</div>
				<div class="control-row"><span class="key">우클릭 홀드</span> 가드</div>
				<div class="control-row"><span class="key">우클릭 타이밍</span> 패링</div>
				<div class="control-row"><span class="key">Shift</span> 회피</div>
				<div class="control-row"><span class="key">V</span> 시점 전환</div>
				<div class="control-row"><span class="key">ESC</span> 일시정지</div>
				<p class="tip">패링: 적 공격 직전에 우클릭!</p>
			</div>
		{:else}
			<button class="show-controls-btn" onclick={() => showControls = true}>?</button>
		{/if}
	{/if}

	<!-- AI 학습 현황 (playing 상태에서만) -->
	{#if $gameState === 'playing'}
		{#if showAIDebug}
			<div class="ai-learning-info">
				<button class="close-btn small" onclick={() => showAIDebug = false}>×</button>
				<div class="learning-title">Deep Q-Network</div>

				<!-- DQN 통계 -->
				<div class="learning-section">
					<div class="section-title">신경망 학습</div>
					<div class="learning-item">
						에피소드: <span class="highlight">{$aiStats.totalEpisodes}</span>
					</div>
					<div class="learning-item">
						탐험률: <span class="highlight">{($aiStats.explorationRate * 100).toFixed(1)}%</span>
					</div>
					<div class="learning-item">
						메모리: <span class="highlight">{$aiStats.memorySize}</span>
					</div>
					<div class="learning-item">
						평균 보상: <span class="highlight">{$aiStats.averageReward.toFixed(2)}</span>
					</div>
					{#if $aiStats.lastAction}
						<div class="learning-item">
							현재 행동: <span class="action-tag">{$aiStats.lastAction}</span>
						</div>
					{/if}
					<div class="learning-item">
						모델 상태: <span class="highlight">{$aiStats.isLearning ? '준비됨' : '로딩 중...'}</span>
					</div>
				</div>

				<!-- 통계 기반 패턴 -->
				<div class="learning-section">
					<div class="section-title">플레이어 패턴</div>
					<div class="learning-item">
						공격: 약({$aiLearningData.attackPatterns.light_attack}) / 강({$aiLearningData.attackPatterns.heavy_attack})
					</div>
					<div class="learning-item">
						회피: ←{$aiLearningData.dodgeDirections.left} →{$aiLearningData.dodgeDirections.right} ↑{$aiLearningData.dodgeDirections.forward} ↓{$aiLearningData.dodgeDirections.backward}
					</div>
					<div class="learning-item">
						방어: 가드({$aiLearningData.defensiveActions.guard}) / 패링({$aiLearningData.defensiveActions.parry})
					</div>
				</div>

				<!-- 학습 컨트롤 -->
				<div class="learning-controls">
					<label class="toggle-label">
						<input
							type="checkbox"
							checked={$aiLearningEnabled}
							onchange={() => aiLearningEnabled.update(v => !v)}
						/>
						DQN 학습 활성화
					</label>
					<button class="reset-btn" onclick={resetAILearning}>학습 초기화</button>
				</div>
			</div>
		{:else}
			<button class="show-ai-btn" onclick={() => showAIDebug = true}>AI</button>
		{/if}
	{/if}

	<!-- 게임 오버 화면 -->
	{#if $gameState === 'dead'}
		<div class="overlay">
			<div class="game-over">
				<h1>YOU DIED</h1>
				<p>Round {$currentRound}</p>
				<p class="warning">AI가 당신의 패턴을 학습했습니다...</p>
				<button onclick={onRestart}>재도전</button>
				<p class="hint-text">Enter 키를 눌러 재도전</p>
			</div>
		</div>
	{/if}

	<!-- 승리 화면 + AI 학습 -->
	{#if $gameState === 'victory'}
		<div class="overlay victory">
			<div class="victory-screen">
				<h1>VICTORY</h1>
				<p>Round {$currentRound} 클리어!</p>

				<!-- AI 학습 진행 중 -->
				{#if isLearning || !learningComplete}
					<div class="ai-learning-section">
						<div class="learning-header">
							<span class="brain-icon">🧠</span>
							<span>AI가 당신의 패턴을 학습 중...</span>
						</div>

						<!-- 진행 바 -->
						<div class="learning-progress-bar">
							<div class="learning-progress-fill" style="width: {learningProgress}%"></div>
						</div>

						<!-- 현재 학습 중인 항목 (희미하게) -->
						{#if currentLearningItem}
							<div class="current-learning-item">
								{currentLearningItem}
							</div>
						{/if}
					</div>
				{/if}

				<!-- 학습 완료 후 -->
				{#if learningComplete}
					<div class="learning-complete-section">
						<div class="complete-header">
							<span class="check-icon">✓</span>
							<span>학습 완료</span>
						</div>

						<p class="level-up-info">Lv.{$bossLevel} → Lv.{$bossLevel + 1}</p>

						<button onclick={onNextRound}>다음 라운드</button>
						<p class="hint-text">Enter 키를 눌러 진행</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- 시작 화면 -->
	{#if $gameState === 'menu'}
		<div class="overlay menu">
			<div class="menu-screen">
				<h1>AI FIGHTER</h1>
				<p class="subtitle">학습하는 AI와의 전투</p>
				<button onclick={startGame}>게임 시작</button>
				<button class="secondary" onclick={() => showHowToPlay = true}>조작법</button>
				<p class="description">
					AI는 당신의 전투 패턴을 학습합니다.<br>
					매 라운드마다 더 강해지고 더 똑똑해집니다.
				</p>
			</div>
		</div>
	{/if}

	<!-- 일시정지 메뉴 -->
	{#if $gameState === 'paused'}
		<div class="overlay paused">
			<div class="pause-screen">
				<h1>PAUSED</h1>
				<div class="pause-menu">
					<button onclick={resumeGame}>Resume</button>
					<button onclick={restartGame}>Restart</button>
					<button onclick={() => showHowToPlay = true}>How to Play</button>
					<button class="exit-btn" onclick={exitToMenu}>Exit to Menu</button>
				</div>
				<p class="pause-hint">Press ESC to resume</p>
			</div>
		</div>
	{/if}

	<!-- How to Play 패널 -->
	{#if showHowToPlay}
		<div class="overlay howtoplay">
			<div class="howtoplay-screen">
				<h2>HOW TO PLAY</h2>
				<div class="howtoplay-content">
					<div class="control-section">
						<h3>Movement</h3>
						<div class="control-item"><span class="key-badge">W A S D</span> Move</div>
						<div class="control-item"><span class="key-badge">Shift</span> Dodge (i-frames)</div>
						<div class="control-item"><span class="key-badge">V</span> Toggle Camera</div>
					</div>
					<div class="control-section">
						<h3>Combat</h3>
						<div class="control-item"><span class="key-badge">Left Click</span> Light Attack</div>
						<div class="control-item"><span class="key-badge">Hold Left Click</span> Heavy Attack</div>
						<div class="control-item"><span class="key-badge">Hold Right Click</span> Block</div>
						<div class="control-item"><span class="key-badge">Right Click (timing)</span> Parry</div>
					</div>
					<div class="control-section">
						<h3>Tips</h3>
						<p class="tip-text">• Parry right before enemy attack hits for a counter opportunity</p>
						<p class="tip-text">• Heavy attacks deal more damage but are slower</p>
						<p class="tip-text">• The AI learns your patterns - vary your strategy!</p>
						<p class="tip-text">• Blocking reduces damage but drains stamina</p>
					</div>
				</div>
				<button onclick={() => showHowToPlay = false}>Close</button>
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

	.input-debug {
		position: absolute;
		top: 30px;
		left: 30px;
		background: rgba(0, 0, 0, 0.8);
		padding: 10px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.debug-title {
		font-size: 10px;
		font-weight: bold;
		margin-bottom: 8px;
		color: #888;
		text-align: center;
	}

	.key-display {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.key-row {
		display: flex;
		gap: 4px;
	}

	.key-box {
		width: 28px;
		height: 28px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: bold;
		transition: all 0.1s;
	}

	.key-box.wide {
		width: 90px;
	}

	.key-box.active {
		background: #22c55e;
		border-color: #22c55e;
		color: #000;
	}

	.mouse-display {
		display: flex;
		gap: 8px;
		justify-content: center;
		margin-top: 8px;
	}

	.mouse-btn {
		width: 32px;
		height: 24px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: bold;
	}

	.mouse-btn.active {
		background: #e94560;
		border-color: #e94560;
		color: #fff;
	}

	.charging-indicator {
		margin-top: 6px;
		text-align: center;
		font-size: 10px;
		color: #ff8800;
		animation: pulse 0.3s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
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
		min-width: 80px;
		text-align: center;
		font-size: 11px;
	}

	.tip {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		font-size: 11px;
		color: #ffcc00;
		font-style: italic;
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
		background: rgba(0, 0, 0, 0.7);
		padding: 12px 15px;
		border-radius: 8px;
		font-size: 11px;
		min-width: 200px;
		pointer-events: auto;
		border: 1px solid rgba(233, 69, 96, 0.3);
	}

	.learning-title {
		font-weight: bold;
		margin-bottom: 8px;
		color: #e94560;
		font-size: 13px;
	}

	.learning-section {
		margin: 8px 0;
		padding: 6px 0;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.section-title {
		font-size: 10px;
		text-transform: uppercase;
		color: #888;
		margin-bottom: 4px;
	}

	.learning-item {
		margin: 3px 0;
	}

	.highlight {
		color: #4fc3f7;
		font-weight: bold;
	}

	.action-tag {
		background: rgba(233, 69, 96, 0.3);
		padding: 1px 6px;
		border-radius: 3px;
		color: #ff8a9e;
		font-size: 10px;
	}

	.learning-controls {
		margin-top: 10px;
		padding-top: 8px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		font-size: 11px;
	}

	.toggle-label input {
		cursor: pointer;
	}

	.reset-btn {
		padding: 4px 8px;
		font-size: 10px;
		background: rgba(233, 69, 96, 0.3);
		border: 1px solid rgba(233, 69, 96, 0.5);
		color: white;
		border-radius: 4px;
		cursor: pointer;
		margin-top: 4px;
	}

	.reset-btn:hover {
		background: rgba(233, 69, 96, 0.5);
	}

	.close-btn.small {
		font-size: 16px;
		top: 2px;
		right: 6px;
	}

	.show-ai-btn {
		position: absolute;
		bottom: 100px;
		left: 30px;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(233, 69, 96, 0.5);
		border: 1px solid rgba(233, 69, 96, 0.8);
		color: white;
		font-size: 12px;
		font-weight: bold;
		cursor: pointer;
		pointer-events: auto;
	}

	.show-ai-btn:hover {
		background: rgba(233, 69, 96, 0.7);
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

	.overlay.paused {
		background: rgba(0, 0, 0, 0.85);
		backdrop-filter: blur(5px);
	}

	.pause-screen {
		text-align: center;
	}

	.pause-screen h1 {
		font-size: 64px;
		color: #ffffff;
		margin: 0 0 40px 0;
		text-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
		letter-spacing: 8px;
	}

	.pause-menu {
		display: flex;
		flex-direction: column;
		gap: 15px;
		align-items: center;
	}

	.pause-menu button {
		width: 250px;
		padding: 15px 40px;
		font-size: 18px;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.3);
		color: white;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		margin: 0;
	}

	.pause-menu button:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.5);
		transform: scale(1.02);
	}

	.pause-menu .exit-btn {
		background: rgba(233, 69, 96, 0.2);
		border-color: rgba(233, 69, 96, 0.5);
	}

	.pause-menu .exit-btn:hover {
		background: rgba(233, 69, 96, 0.4);
		border-color: #e94560;
	}

	.pause-hint {
		margin-top: 30px;
		font-size: 14px;
		opacity: 0.5;
	}

	button.secondary {
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.3);
		margin-left: 10px;
	}

	button.secondary:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.5);
	}

	.overlay.howtoplay {
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(10px);
		z-index: 200;
	}

	.howtoplay-screen {
		text-align: center;
		max-width: 600px;
		padding: 30px;
	}

	.howtoplay-screen h2 {
		font-size: 36px;
		color: #e94560;
		margin: 0 0 30px 0;
		letter-spacing: 4px;
	}

	.howtoplay-content {
		display: flex;
		flex-direction: column;
		gap: 25px;
		text-align: left;
		margin-bottom: 30px;
	}

	.control-section {
		background: rgba(255, 255, 255, 0.05);
		padding: 15px 20px;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.control-section h3 {
		margin: 0 0 12px 0;
		font-size: 16px;
		color: #4fc3f7;
		text-transform: uppercase;
		letter-spacing: 2px;
	}

	.control-item {
		display: flex;
		align-items: center;
		gap: 15px;
		margin: 8px 0;
		font-size: 14px;
	}

	.key-badge {
		background: rgba(233, 69, 96, 0.3);
		border: 1px solid rgba(233, 69, 96, 0.5);
		padding: 4px 12px;
		border-radius: 4px;
		font-size: 12px;
		min-width: 120px;
		text-align: center;
		font-weight: bold;
	}

	.tip-text {
		font-size: 13px;
		color: #aaa;
		margin: 6px 0;
		line-height: 1.4;
	}

	.howtoplay-screen button {
		margin-top: 10px;
	}

	/* AI 학습 섹션 스타일 */
	.ai-learning-section {
		margin: 30px 0;
		padding: 25px;
		background: rgba(0, 0, 0, 0.4);
		border-radius: 12px;
		border: 1px solid rgba(100, 255, 100, 0.3);
	}

	.learning-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		font-size: 18px;
		margin-bottom: 20px;
		color: #88ff88;
	}

	.brain-icon {
		font-size: 28px;
		animation: pulse-brain 1s infinite;
	}

	@keyframes pulse-brain {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}

	.learning-progress-bar {
		width: 100%;
		height: 8px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 15px;
	}

	.learning-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #44ff44, #88ffaa);
		border-radius: 4px;
		transition: width 0.1s ease;
		box-shadow: 0 0 10px rgba(68, 255, 68, 0.5);
	}

	.learning-phase {
		font-size: 14px;
		color: #aaffaa;
		margin-bottom: 20px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.phase-icon {
		font-size: 18px;
	}

	.learning-stats {
		display: flex;
		justify-content: center;
		gap: 30px;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.stat-item .stat-label {
		font-size: 12px;
		color: #888;
		text-transform: uppercase;
	}

	.stat-item .stat-value {
		font-size: 20px;
		font-weight: bold;
		color: #4fc3f7;
	}

	/* 학습 완료 섹션 */
	.learning-complete-section {
		margin: 30px 0;
		padding: 25px;
		background: rgba(0, 50, 0, 0.4);
		border-radius: 12px;
		border: 1px solid rgba(100, 255, 100, 0.5);
		animation: fadeIn 0.5s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.complete-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		font-size: 24px;
		color: #44ff44;
		margin-bottom: 20px;
	}

	.check-icon {
		width: 32px;
		height: 32px;
		background: #44ff44;
		color: #000;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: bold;
	}

	.current-learning-item {
		font-size: 12px;
		color: rgba(170, 255, 170, 0.6);
		margin: 15px 0;
		padding: 8px 12px;
		background: rgba(0, 0, 0, 0.2);
		border-left: 2px solid rgba(68, 255, 68, 0.4);
		border-radius: 0 4px 4px 0;
		animation: itemFade 0.3s ease;
		font-style: italic;
	}

	@keyframes itemFade {
		from { opacity: 0; transform: translateX(-10px); }
		to { opacity: 1; transform: translateX(0); }
	}

	.level-up-info {
		color: #88ff88;
		font-size: 18px;
		margin: 15px 0 20px 0;
	}

	.warning-text {
		color: #ffaa00;
		font-size: 14px;
		margin: 5px 0 20px 0;
	}

	.hint-text {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.4);
		margin-top: 15px;
	}

	.victory-screen {
		max-width: 500px;
	}
</style>
