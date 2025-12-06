<script lang="ts">
	import { settings, updateSetting, resetSettings } from '$lib/stores/settingsStore';
	import { setMasterVolume, setBGMVolume, setSFXVolume, toggleMute, playSFX } from '$lib/audio/AudioManager';

	let { onClose = () => {} }: { onClose?: () => void } = $props();

	// 현재 탭
	let currentTab = $state<'audio' | 'graphics' | 'gameplay' | 'accessibility' | 'controls'>('audio');

	// 설정 변경 핸들러
	function handleVolumeChange(type: 'master' | 'bgm' | 'sfx', value: number) {
		if (type === 'master') {
			setMasterVolume(value);
			updateSetting('masterVolume', value);
		} else if (type === 'bgm') {
			setBGMVolume(value);
			updateSetting('bgmVolume', value);
		} else {
			setSFXVolume(value);
			updateSetting('sfxVolume', value);
		}
	}

	function handleMuteToggle() {
		toggleMute();
		updateSetting('muted', !$settings.muted);
	}

	function handleTabChange(tab: typeof currentTab) {
		currentTab = tab;
		playSFX('ui_click');
	}

	function handleSliderChange() {
		playSFX('ui_hover');
	}

	function handleClose() {
		playSFX('ui_click');
		onClose();
	}

	function handleReset() {
		if (confirm('Are you sure you want to reset all settings to default?')) {
			resetSettings();
			playSFX('ui_click');
		}
	}

	// 탭 목록
	const tabs = [
		{ id: 'audio' as const, name: 'Audio', icon: '🔊' },
		{ id: 'graphics' as const, name: 'Graphics', icon: '🖥️' },
		{ id: 'gameplay' as const, name: 'Gameplay', icon: '🎮' },
		{ id: 'accessibility' as const, name: 'Accessibility', icon: '♿' },
		{ id: 'controls' as const, name: 'Controls', icon: '⌨️' }
	];
</script>

<div class="settings-overlay">
	<div class="settings-panel">
		<div class="settings-header">
			<h2>SETTINGS</h2>
			<button class="close-btn" onclick={handleClose}>×</button>
		</div>

		<!-- 탭 네비게이션 -->
		<div class="tabs">
			{#each tabs as tab}
				<button
					class="tab-btn"
					class:active={currentTab === tab.id}
					onclick={() => handleTabChange(tab.id)}
				>
					<span class="tab-icon">{tab.icon}</span>
					<span class="tab-name">{tab.name}</span>
				</button>
			{/each}
		</div>

		<!-- 탭 컨텐츠 -->
		<div class="tab-content">
			<!-- 오디오 설정 -->
			{#if currentTab === 'audio'}
				<div class="settings-section">
					<div class="setting-item">
						<label>Master Volume</label>
						<div class="slider-container">
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={$settings.masterVolume}
								oninput={(e) => handleVolumeChange('master', parseFloat(e.currentTarget.value))}
								onchange={handleSliderChange}
							/>
							<span class="value">{Math.round($settings.masterVolume * 100)}%</span>
						</div>
					</div>

					<div class="setting-item">
						<label>Music Volume</label>
						<div class="slider-container">
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={$settings.bgmVolume}
								oninput={(e) => handleVolumeChange('bgm', parseFloat(e.currentTarget.value))}
								onchange={handleSliderChange}
							/>
							<span class="value">{Math.round($settings.bgmVolume * 100)}%</span>
						</div>
					</div>

					<div class="setting-item">
						<label>SFX Volume</label>
						<div class="slider-container">
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={$settings.sfxVolume}
								oninput={(e) => handleVolumeChange('sfx', parseFloat(e.currentTarget.value))}
								onchange={handleSliderChange}
							/>
							<span class="value">{Math.round($settings.sfxVolume * 100)}%</span>
						</div>
					</div>

					<div class="setting-item toggle-item">
						<label>Mute All</label>
						<button
							class="toggle-btn"
							class:active={$settings.muted}
							onclick={handleMuteToggle}
						>
							{$settings.muted ? 'ON' : 'OFF'}
						</button>
					</div>
				</div>
			{/if}

			<!-- 그래픽 설정 -->
			{#if currentTab === 'graphics'}
				<div class="settings-section">
					<div class="setting-item">
						<label>Graphics Quality</label>
						<select
							value={$settings.graphicsQuality}
							onchange={(e) => updateSetting('graphicsQuality', e.currentTarget.value as 'low' | 'medium' | 'high')}
						>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>

					<div class="setting-item">
						<label>Shadow Quality</label>
						<select
							value={$settings.shadowQuality}
							onchange={(e) => updateSetting('shadowQuality', e.currentTarget.value as 'off' | 'low' | 'medium' | 'high')}
						>
							<option value="off">Off</option>
							<option value="low">Low</option>
							<option value="medium">Medium</option>
							<option value="high">High</option>
						</select>
					</div>

					<div class="setting-item toggle-item">
						<label>Show FPS</label>
						<button
							class="toggle-btn"
							class:active={$settings.showFPS}
							onclick={() => updateSetting('showFPS', !$settings.showFPS)}
						>
							{$settings.showFPS ? 'ON' : 'OFF'}
						</button>
					</div>

					<div class="setting-item toggle-item">
						<label>Particles</label>
						<button
							class="toggle-btn"
							class:active={$settings.enableParticles}
							onclick={() => updateSetting('enableParticles', !$settings.enableParticles)}
						>
							{$settings.enableParticles ? 'ON' : 'OFF'}
						</button>
					</div>

					<div class="setting-item toggle-item">
						<label>Post Processing</label>
						<button
							class="toggle-btn"
							class:active={$settings.enablePostProcessing}
							onclick={() => updateSetting('enablePostProcessing', !$settings.enablePostProcessing)}
						>
							{$settings.enablePostProcessing ? 'ON' : 'OFF'}
						</button>
					</div>
				</div>
			{/if}

			<!-- 게임플레이 설정 -->
			{#if currentTab === 'gameplay'}
				<div class="settings-section">
					<div class="setting-item">
						<label>Difficulty</label>
						<select
							value={$settings.difficulty}
							onchange={(e) => updateSetting('difficulty', e.currentTarget.value as 'easy' | 'normal' | 'hard')}
						>
							<option value="easy">Easy</option>
							<option value="normal">Normal</option>
							<option value="hard">Hard</option>
						</select>
					</div>

					<div class="setting-item toggle-item">
						<label>Camera Shake</label>
						<button
							class="toggle-btn"
							class:active={$settings.cameraShake}
							onclick={() => updateSetting('cameraShake', !$settings.cameraShake)}
						>
							{$settings.cameraShake ? 'ON' : 'OFF'}
						</button>
					</div>

					<div class="setting-item toggle-item">
						<label>Screen Flash</label>
						<button
							class="toggle-btn"
							class:active={$settings.screenFlash}
							onclick={() => updateSetting('screenFlash', !$settings.screenFlash)}
						>
							{$settings.screenFlash ? 'ON' : 'OFF'}
						</button>
					</div>

					<div class="setting-item toggle-item">
						<label>Damage Numbers</label>
						<button
							class="toggle-btn"
							class:active={$settings.showDamageNumbers}
							onclick={() => updateSetting('showDamageNumbers', !$settings.showDamageNumbers)}
						>
							{$settings.showDamageNumbers ? 'ON' : 'OFF'}
						</button>
					</div>

					<div class="setting-item toggle-item">
						<label>Tutorial Hints</label>
						<button
							class="toggle-btn"
							class:active={$settings.showTutorialHints}
							onclick={() => updateSetting('showTutorialHints', !$settings.showTutorialHints)}
						>
							{$settings.showTutorialHints ? 'ON' : 'OFF'}
						</button>
					</div>
				</div>
			{/if}

			<!-- 접근성 설정 -->
			{#if currentTab === 'accessibility'}
				<div class="settings-section">
					<div class="setting-item">
						<label>Colorblind Mode</label>
						<select
							value={$settings.colorblindMode}
							onchange={(e) => updateSetting('colorblindMode', e.currentTarget.value as 'off' | 'protanopia' | 'deuteranopia' | 'tritanopia')}
						>
							<option value="off">Off</option>
							<option value="protanopia">Protanopia (Red-Blind)</option>
							<option value="deuteranopia">Deuteranopia (Green-Blind)</option>
							<option value="tritanopia">Tritanopia (Blue-Blind)</option>
						</select>
					</div>

					<div class="setting-item toggle-item">
						<label>High Contrast</label>
						<button
							class="toggle-btn"
							class:active={$settings.highContrast}
							onclick={() => updateSetting('highContrast', !$settings.highContrast)}
						>
							{$settings.highContrast ? 'ON' : 'OFF'}
						</button>
					</div>

					<div class="setting-item toggle-item">
						<label>Reduced Motion</label>
						<button
							class="toggle-btn"
							class:active={$settings.reducedMotion}
							onclick={() => updateSetting('reducedMotion', !$settings.reducedMotion)}
						>
							{$settings.reducedMotion ? 'ON' : 'OFF'}
						</button>
					</div>

					<div class="setting-item toggle-item">
						<label>Large Text</label>
						<button
							class="toggle-btn"
							class:active={$settings.largeText}
							onclick={() => updateSetting('largeText', !$settings.largeText)}
						>
							{$settings.largeText ? 'ON' : 'OFF'}
						</button>
					</div>
				</div>
			{/if}

			<!-- 컨트롤 설정 -->
			{#if currentTab === 'controls'}
				<div class="settings-section">
					<div class="setting-item">
						<label>Mouse Sensitivity</label>
						<div class="slider-container">
							<input
								type="range"
								min="0.1"
								max="3"
								step="0.1"
								value={$settings.mouseSensitivity}
								oninput={(e) => updateSetting('mouseSensitivity', parseFloat(e.currentTarget.value))}
								onchange={handleSliderChange}
							/>
							<span class="value">{$settings.mouseSensitivity.toFixed(1)}x</span>
						</div>
					</div>

					<div class="setting-item toggle-item">
						<label>Invert Y-Axis</label>
						<button
							class="toggle-btn"
							class:active={$settings.invertY}
							onclick={() => updateSetting('invertY', !$settings.invertY)}
						>
							{$settings.invertY ? 'ON' : 'OFF'}
						</button>
					</div>

					<div class="controls-info">
						<h3>Keyboard Controls</h3>
						<div class="control-row"><span class="key">W A S D</span> Move</div>
						<div class="control-row"><span class="key">Shift</span> Dodge</div>
						<div class="control-row"><span class="key">V</span> Toggle Camera</div>
						<div class="control-row"><span class="key">ESC</span> Pause</div>

						<h3>Mouse Controls</h3>
						<div class="control-row"><span class="key">Left Click</span> Light Attack</div>
						<div class="control-row"><span class="key">Hold Left</span> Heavy Attack</div>
						<div class="control-row"><span class="key">Right Click</span> Block/Parry</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- 푸터 -->
		<div class="settings-footer">
			<button class="reset-btn" onclick={handleReset}>Reset to Default</button>
			<button class="apply-btn" onclick={handleClose}>Apply & Close</button>
		</div>
	</div>
</div>

<style>
	.settings-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 300;
	}

	.settings-panel {
		background: linear-gradient(135deg, rgba(30, 30, 50, 0.95), rgba(20, 20, 35, 0.95));
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 16px;
		width: 90%;
		max-width: 700px;
		max-height: 85vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
	}

	.settings-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 25px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.settings-header h2 {
		margin: 0;
		font-size: 28px;
		color: #e94560;
		letter-spacing: 4px;
	}

	.close-btn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.6);
		font-size: 32px;
		cursor: pointer;
		padding: 0;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.close-btn:hover {
		color: #e94560;
		transform: scale(1.1);
	}

	.tabs {
		display: flex;
		padding: 0 15px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		overflow-x: auto;
	}

	.tab-btn {
		background: none;
		border: none;
		color: rgba(255, 255, 255, 0.5);
		padding: 15px 20px;
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
		border-bottom: 2px solid transparent;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.tab-btn:hover {
		color: rgba(255, 255, 255, 0.8);
	}

	.tab-btn.active {
		color: #e94560;
		border-bottom-color: #e94560;
	}

	.tab-icon {
		font-size: 18px;
	}

	.tab-content {
		flex: 1;
		overflow-y: auto;
		padding: 25px;
	}

	.settings-section {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.setting-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 15px;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.setting-item label {
		color: rgba(255, 255, 255, 0.9);
		font-size: 15px;
	}

	.slider-container {
		display: flex;
		align-items: center;
		gap: 15px;
	}

	.slider-container input[type="range"] {
		width: 150px;
		height: 6px;
		-webkit-appearance: none;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		outline: none;
	}

	.slider-container input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 18px;
		height: 18px;
		background: #e94560;
		border-radius: 50%;
		cursor: pointer;
		transition: transform 0.2s;
	}

	.slider-container input[type="range"]::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}

	.value {
		color: #e94560;
		font-size: 14px;
		min-width: 50px;
		text-align: right;
	}

	select {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		padding: 8px 15px;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
		outline: none;
	}

	select:focus {
		border-color: #e94560;
	}

	.toggle-btn {
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: rgba(255, 255, 255, 0.6);
		padding: 8px 20px;
		border-radius: 6px;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s;
		min-width: 70px;
	}

	.toggle-btn.active {
		background: rgba(233, 69, 96, 0.3);
		border-color: #e94560;
		color: #e94560;
	}

	.toggle-btn:hover {
		border-color: #e94560;
	}

	.controls-info {
		margin-top: 20px;
		padding: 15px;
		background: rgba(255, 255, 255, 0.02);
		border-radius: 8px;
	}

	.controls-info h3 {
		color: #4fc3f7;
		font-size: 14px;
		margin: 0 0 10px 0;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.controls-info h3:not(:first-child) {
		margin-top: 20px;
	}

	.control-row {
		display: flex;
		align-items: center;
		gap: 15px;
		padding: 6px 0;
		color: rgba(255, 255, 255, 0.7);
		font-size: 13px;
	}

	.key {
		background: rgba(233, 69, 96, 0.2);
		border: 1px solid rgba(233, 69, 96, 0.4);
		padding: 4px 10px;
		border-radius: 4px;
		font-size: 12px;
		min-width: 80px;
		text-align: center;
		color: #e94560;
	}

	.settings-footer {
		display: flex;
		justify-content: space-between;
		padding: 20px 25px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.reset-btn {
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: rgba(255, 255, 255, 0.6);
		padding: 12px 25px;
		border-radius: 8px;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.reset-btn:hover {
		background: rgba(255, 100, 100, 0.1);
		border-color: rgba(255, 100, 100, 0.5);
		color: #ff6666;
	}

	.apply-btn {
		background: #e94560;
		border: none;
		color: white;
		padding: 12px 30px;
		border-radius: 8px;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.apply-btn:hover {
		background: #ff6b8a;
		transform: scale(1.02);
	}
</style>
