# UI/UX Development

> 관련 파일: `GameUI.svelte`, `SettingsMenu.svelte`, `LoadingScreen.svelte`, `KeyboardHints.svelte`

## UI Structure

```
GameUI.svelte (288L)
├── HUD (게임 중)
│   ├── Player Stats (좌하단) - HP/SP 바
│   ├── Boss Health (상단 중앙)
│   ├── Round Counter (우상단)
│   └── Controls Hint (좌측)
├── Overlays
│   ├── Menu Screen
│   ├── Paused Screen
│   ├── Game Over Screen
│   └── Victory Screen
└── Debug Panel (AI 통계)

SettingsMenu.svelte (652L)
├── 그래픽 설정
├── 오디오 설정
├── 조작 설정
├── 업적
└── 통계
```

## Store Subscriptions

```svelte
<script>
  import {
    gameState,
    playerHealth, playerMaxHealth,
    playerStamina, playerMaxStamina,
    enemyHealth, enemyMaxHealth,
    currentRound, bossLevel,
    aiLearningData
  } from '$lib/stores/gameStore';
</script>
```

## Health/Stamina Bars

```svelte
<div class="player-stats">
  <!-- HP Bar -->
  <div class="stat-bar">
    <div class="bar-label">HP</div>
    <div class="bar-container">
      <div
        class="bar-fill health"
        style="width: {($playerHealth / $playerMaxHealth) * 100}%"
      />
      <span class="bar-text">
        {Math.round($playerHealth)} / {$playerMaxHealth}
      </span>
    </div>
  </div>

  <!-- SP Bar -->
  <div class="stat-bar">
    <div class="bar-label">SP</div>
    <div class="bar-container">
      <div
        class="bar-fill stamina"
        style="width: {($playerStamina / $playerMaxStamina) * 100}%"
      />
    </div>
  </div>
</div>
```

### Bar Styling
```css
.bar-container {
  width: 200px;
  height: 20px;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.bar-fill.health {
  background: linear-gradient(to right, #22c55e, #44ff44);
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
}

.bar-fill.stamina {
  background: linear-gradient(to right, #3b82f6, #60a5fa);
}
```

## Boss Health Bar

```svelte
<div class="boss-health">
  <div class="boss-name">BOSS Lv.{$bossLevel}</div>
  <div class="boss-bar-container">
    <div
      class="bar-fill boss"
      style="width: {($enemyHealth / $enemyMaxHealth) * 100}%"
    />
  </div>
</div>
```

## Overlay Screens

### State-Based Rendering
```svelte
{#if $gameState === 'menu'}
  <div class="overlay menu">
    <h1>ADAPTIVE BOSS</h1>
    <p>AI가 당신의 전투 패턴을 학습합니다</p>
    <button onclick={startGame}>START</button>
    <button onclick={openSettings}>SETTINGS</button>
  </div>
{/if}

{#if $gameState === 'dead'}
  <div class="overlay game-over">
    <h1>DEFEATED</h1>
    <p>Round {$currentRound}에서 패배</p>
    <button onclick={retry}>RETRY</button>
    <button onclick={backToMenu}>MENU</button>
  </div>
{/if}

{#if $gameState === 'victory'}
  <div class="overlay victory">
    <h1>VICTORY!</h1>
    <p>Round {$currentRound} 클리어!</p>
    <button onclick={nextRound}>NEXT ROUND</button>
  </div>
{/if}

{#if $gameState === 'paused'}
  <div class="overlay paused">
    <h1>PAUSED</h1>
    <button onclick={resumeGame}>RESUME</button>
    <button onclick={openSettings}>SETTINGS</button>
    <button onclick={backToMenu}>QUIT</button>
  </div>
{/if}
```

### Overlay Styling
```css
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  z-index: 100;
}

.overlay h1 {
  font-size: 4rem;
  color: #e94560;
  text-shadow: 0 0 20px rgba(233, 69, 96, 0.5);
}

.overlay button {
  margin: 10px;
  padding: 15px 40px;
  font-size: 1.2rem;
  background: #e94560;
  border: none;
  color: white;
  cursor: pointer;
  transition: all 0.3s;
}

.overlay button:hover {
  background: #ff6b6b;
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(233, 69, 96, 0.5);
}
```

## Controls Guide (KeyboardHints.svelte)

```svelte
<div class="controls-panel">
  <div class="control"><kbd>WASD</kbd> 이동</div>
  <div class="control"><kbd>LMB</kbd> 약공격</div>
  <div class="control"><kbd>LMB 홀드</kbd> 강공격</div>
  <div class="control"><kbd>RMB</kbd> 가드</div>
  <div class="control"><kbd>E</kbd> 패리</div>
  <div class="control"><kbd>Shift</kbd> 회피</div>
  <div class="control"><kbd>V</kbd> 카메라</div>
  <div class="control"><kbd>ESC</kbd> 일시정지</div>
</div>
```

## Color Palette

| 용도 | 색상 |
|------|------|
| 배경/오버레이 | `rgba(0, 0, 0, 0.85)` |
| 패널 배경 | `#1a1a2e`, `#16213e` |
| 메인 강조 | `#e94560` |
| 체력 (녹색) | `#22c55e` → `#44ff44` |
| 스태미나 (파랑) | `#3b82f6` → `#60a5fa` |
| 보스 체력 (빨강) | `#e94560` → `#ff6b6b` |
| 경고/골드 | `#ffaa00` |
| 텍스트 | `#ffffff`, `#aaa` |

## Text Effects

### Glow
```css
.glow-text {
  color: #e94560;
  text-shadow:
    0 0 10px rgba(233, 69, 96, 0.5),
    0 0 20px rgba(233, 69, 96, 0.3);
}
```

### Keyboard Keys
```css
kbd {
  display: inline-block;
  padding: 2px 8px;
  background: #333;
  border: 1px solid #555;
  border-radius: 3px;
  font-family: monospace;
  min-width: 24px;
  text-align: center;
}
```

## Pointer Events

```css
/* 기본: 3D 인터랙션 허용 */
.game-ui {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* 버튼만 클릭 가능 */
.game-ui button,
.game-ui .interactive {
  pointer-events: auto;
}
```

## Animations

### Transitions
```css
.bar-fill {
  transition: width 0.3s ease;
}

button {
  transition: all 0.3s ease;
}
```

### Svelte Transitions
```svelte
{#if show}
  <div transition:fade={{ duration: 300 }}>
    ...
  </div>
{/if}

{#if show}
  <div transition:fly={{ y: 20, duration: 200 }}>
    ...
  </div>
{/if}
```

## DamageNumber.svelte

```svelte
<script>
  let { damage, position, isCritical } = $props();
</script>

<div
  class="damage-number"
  class:critical={isCritical}
  style="left: {position.x}px; top: {position.y}px"
>
  {damage}
</div>

<style>
.damage-number {
  position: absolute;
  font-weight: bold;
  color: #ff4444;
  animation: float-up 1s ease-out forwards;
}

.critical {
  font-size: 1.5em;
  color: #ffaa00;
}

@keyframes float-up {
  0% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-50px); }
}
</style>
```

## AI Debug Panel

```svelte
{#if showDebugPanel}
  <div class="debug-panel">
    <h3>AI Learning Stats</h3>
    <div>Light Attacks: {$aiLearningData.attackPatterns.light}</div>
    <div>Heavy Attacks: {$aiLearningData.attackPatterns.heavy}</div>
    <div>Dodge Left: {$aiLearningData.dodgeDirections.left}</div>
    <div>Dodge Right: {$aiLearningData.dodgeDirections.right}</div>
    <div>Parries: {$aiLearningData.defensiveActions.parry}</div>
    <div>DQN Epsilon: {$aiStats.explorationRate.toFixed(3)}</div>
  </div>
{/if}
```

## Responsive Considerations

```css
/* 최소 지원 해상도: 1280x720 */
@media (max-width: 1280px) {
  .boss-bar-container {
    width: 300px;
  }
  .bar-container {
    width: 150px;
  }
}
```
