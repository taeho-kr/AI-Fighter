<script lang="ts">
	import { onMount } from 'svelte';

	let { onComplete = () => {}, loadingTasks = [] as string[] }: {
		onComplete?: () => void,
		loadingTasks?: string[]
	} = $props();

	let progress = $state(0);
	let currentTask = $state('Initializing...');
	let taskIndex = $state(0);
	let isComplete = $state(false);

	// 기본 로딩 태스크
	const defaultTasks = [
		'Loading 3D Engine...',
		'Initializing Physics...',
		'Loading Character Models...',
		'Preparing AI System...',
		'Loading Audio...',
		'Finalizing...'
	];

	const tasks = loadingTasks.length > 0 ? loadingTasks : defaultTasks;

	onMount(() => {
		// 프로그레시브 로딩 시뮬레이션
		let elapsed = 0;
		const totalDuration = 2500; // 2.5초
		const taskDuration = totalDuration / tasks.length;

		function updateProgress() {
			elapsed += 50;
			progress = Math.min((elapsed / totalDuration) * 100, 100);

			// 현재 태스크 업데이트
			const newIndex = Math.min(Math.floor(elapsed / taskDuration), tasks.length - 1);
			if (newIndex !== taskIndex) {
				taskIndex = newIndex;
				currentTask = tasks[taskIndex];
			}

			if (elapsed < totalDuration) {
				setTimeout(updateProgress, 50);
			} else {
				// 로딩 완료
				isComplete = true;
				currentTask = 'Ready!';

				// 잠시 후 완료 콜백
				setTimeout(() => {
					onComplete();
				}, 500);
			}
		}

		currentTask = tasks[0];
		updateProgress();
	});
</script>

<div class="loading-screen" class:fade-out={isComplete}>
	<div class="loading-content">
		<!-- 게임 로고 -->
		<div class="logo">
			<h1>AI FIGHTER</h1>
			<p class="tagline">Adaptive Combat Experience</p>
		</div>

		<!-- 로딩 바 -->
		<div class="loading-bar-container">
			<div class="loading-bar">
				<div class="loading-fill" style="width: {progress}%"></div>
			</div>
			<div class="progress-text">{Math.floor(progress)}%</div>
		</div>

		<!-- 현재 태스크 -->
		<p class="current-task">{currentTask}</p>

		<!-- 로딩 애니메이션 -->
		<div class="loading-animation">
			<div class="spinner"></div>
		</div>

		<!-- 팁 표시 -->
		<div class="tips">
			<p class="tip">TIP: The AI learns your fighting patterns. Vary your strategy to stay unpredictable!</p>
		</div>
	</div>

	<!-- 버전 정보 -->
	<div class="version-info">
		<span>v1.0.0</span>
	</div>
</div>

<style>
	.loading-screen {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		transition: opacity 0.5s ease;
	}

	.loading-screen.fade-out {
		opacity: 0;
		pointer-events: none;
	}

	.loading-content {
		text-align: center;
		max-width: 500px;
		padding: 40px;
	}

	.logo {
		margin-bottom: 50px;
	}

	.logo h1 {
		font-size: 64px;
		color: #e94560;
		margin: 0;
		text-shadow: 0 0 30px rgba(233, 69, 96, 0.5);
		letter-spacing: 8px;
		font-weight: bold;
	}

	.tagline {
		font-size: 16px;
		color: rgba(255, 255, 255, 0.6);
		margin-top: 10px;
		letter-spacing: 4px;
		text-transform: uppercase;
	}

	.loading-bar-container {
		display: flex;
		align-items: center;
		gap: 15px;
		margin-bottom: 20px;
	}

	.loading-bar {
		flex: 1;
		height: 8px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		overflow: hidden;
	}

	.loading-fill {
		height: 100%;
		background: linear-gradient(90deg, #e94560, #ff6b8a);
		border-radius: 4px;
		transition: width 0.1s ease;
		box-shadow: 0 0 15px rgba(233, 69, 96, 0.5);
	}

	.progress-text {
		color: #e94560;
		font-size: 14px;
		font-weight: bold;
		min-width: 45px;
		text-align: right;
	}

	.current-task {
		color: rgba(255, 255, 255, 0.7);
		font-size: 14px;
		margin-bottom: 30px;
		min-height: 20px;
	}

	.loading-animation {
		display: flex;
		justify-content: center;
		margin-bottom: 40px;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: #e94560;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.tips {
		padding: 20px;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.tip {
		color: rgba(255, 255, 255, 0.5);
		font-size: 13px;
		margin: 0;
		font-style: italic;
	}

	.version-info {
		position: absolute;
		bottom: 20px;
		right: 20px;
		color: rgba(255, 255, 255, 0.3);
		font-size: 12px;
	}
</style>
