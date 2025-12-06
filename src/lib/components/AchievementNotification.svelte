<script lang="ts">
	import { achievements, type Achievement } from '$lib/stores/settingsStore';
	import { playSFX } from '$lib/audio/AudioManager';
	import { onMount } from 'svelte';

	// 알림 큐
	let notifications = $state<Achievement[]>([]);
	let currentNotification = $state<Achievement | null>(null);
	let isVisible = $state(false);

	// 새 업적 해제 감지
	let previousAchievements = new Map<string, boolean>();

	onMount(() => {
		// 초기 상태 저장
		const initial = $achievements;
		initial.forEach((ach, id) => {
			previousAchievements.set(id, ach.unlocked);
		});
	});

	// 업적 변경 감지
	$effect(() => {
		const current = $achievements;

		current.forEach((ach, id) => {
			const wasUnlocked = previousAchievements.get(id) || false;
			if (ach.unlocked && !wasUnlocked) {
				// 새로 해제된 업적
				showNotification(ach);
			}
			previousAchievements.set(id, ach.unlocked);
		});
	});

	function showNotification(achievement: Achievement) {
		notifications.push(achievement);
		processQueue();
	}

	function processQueue() {
		if (isVisible || notifications.length === 0) return;

		currentNotification = notifications.shift() || null;
		if (!currentNotification) return;

		isVisible = true;
		playSFX('victory');

		// 3초 후 숨김
		setTimeout(() => {
			isVisible = false;
			currentNotification = null;

			// 다음 알림 처리
			setTimeout(() => {
				processQueue();
			}, 500);
		}, 3000);
	}
</script>

{#if isVisible && currentNotification}
	<div class="achievement-notification" class:show={isVisible}>
		<div class="achievement-icon">{currentNotification.icon}</div>
		<div class="achievement-content">
			<div class="achievement-header">ACHIEVEMENT UNLOCKED</div>
			<div class="achievement-name">{currentNotification.name}</div>
			<div class="achievement-description">{currentNotification.description}</div>
		</div>
	</div>
{/if}

<style>
	.achievement-notification {
		position: fixed;
		top: 80px;
		left: 50%;
		transform: translateX(-50%) translateY(-120%);
		background: linear-gradient(135deg, rgba(30, 30, 50, 0.95), rgba(50, 50, 80, 0.95));
		border: 2px solid #ffd700;
		border-radius: 12px;
		padding: 15px 25px;
		display: flex;
		align-items: center;
		gap: 15px;
		z-index: 500;
		box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
		transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.achievement-notification.show {
		transform: translateX(-50%) translateY(0);
	}

	.achievement-icon {
		font-size: 40px;
		width: 60px;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 215, 0, 0.1);
		border-radius: 50%;
		border: 2px solid rgba(255, 215, 0, 0.3);
	}

	.achievement-content {
		text-align: left;
	}

	.achievement-header {
		font-size: 10px;
		color: #ffd700;
		letter-spacing: 2px;
		margin-bottom: 5px;
	}

	.achievement-name {
		font-size: 18px;
		color: white;
		font-weight: bold;
		margin-bottom: 3px;
	}

	.achievement-description {
		font-size: 12px;
		color: rgba(255, 255, 255, 0.6);
	}
</style>
