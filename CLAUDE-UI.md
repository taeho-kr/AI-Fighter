# UI/UX Development

## Main Component

**GameUI.svelte** - 모든 UI 요소 담당 (Canvas 외부에 렌더링)

## UI Structure

```
GameUI.svelte
├── HUD (게임 중 표시)
│   ├── Player Stats (좌하단)
│   │   ├── Health Bar
│   │   └── Stamina Bar
│   ├── Boss Health (상단 중앙)
│   ├── Round Counter (우상단)
│   ├── Camera Mode (우하단)
│   └── Controls Guide (좌측)
├── Overlays (상태별 화면)
│   ├── Main Menu
│   ├── Game Over Screen
│   └── Victory Screen
└── AI Stats Panel (디버그)
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
    cameraMode, aiLearningData
  } from '$lib/stores/gameStore';
</script>
```

## Health/Stamina Bars

### HTML Structure
```svelte
<div class="player-stats">
  <div class="stat-bar health-bar">
    <div class="stat-label">HP</div>
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

  <div class="stat-bar stamina-bar">
    <div class="stat-label">SP</div>
    <div class="bar-container">
      <div
        class="bar-fill stamina"
        style="width: {($playerStamina / $playerMaxStamina) * 100}%"
      />
    </div>
  </div>
</div>
```

### CSS Styling
```css
.player-stats {
  position: absolute;
  bottom: 20px;
  left: 20px;
}

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

```css
.boss-health {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
}

.boss-bar-container {
  width: 400px;
  height: 25px;
}

.bar-fill.boss {
  background: linear-gradient(to right, #e94560, #ff6b6b);
}
```

## Overlay Screens

### Menu Screen
```svelte
{#if $gameState === 'menu'}
  <div class="overlay menu">
    <h1>ADAPTIVE BOSS</h1>
    <p>AI가 당신의 전투 패턴을 학습합니다</p>
    <button on:click={startGame}>START</button>
  </div>
{/if}
```

### Game Over Screen
```svelte
{#if $gameState === 'dead'}
  <div class="overlay game-over">
    <h1>DEFEATED</h1>
    <p>Round {$currentRound}에서 패배</p>
    <button on:click={retry}>RETRY</button>
    <button on:click={backToMenu}>MENU</button>
  </div>
{/if}
```

### Victory Screen
```svelte
{#if $gameState === 'victory'}
  <div class="overlay victory">
    <h1>VICTORY!</h1>
    <p>Round {$currentRound} 클리어!</p>
    <button on:click={nextRound}>NEXT ROUND</button>
  </div>
{/if}
```

### Overlay CSS
```css
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
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
}
```

## Controls Guide

```svelte
<div class="controls-panel" class:collapsed={controlsCollapsed}>
  <button class="toggle" on:click={() => controlsCollapsed = !controlsCollapsed}>
    {controlsCollapsed ? '>' : '<'}
  </button>

  {#if !controlsCollapsed}
    <div class="controls-list">
      <div class="control"><kbd>WASD</kbd> 이동</div>
      <div class="control"><kbd>LMB</kbd> 약공격</div>
      <div class="control"><kbd>Q</kbd> 강공격</div>
      <div class="control"><kbd>RMB</kbd> 가드</div>
      <div class="control"><kbd>E</kbd> 패리</div>
      <div class="control"><kbd>Shift</kbd> 회피</div>
      <div class="control"><kbd>V</kbd> 카메라 전환</div>
    </div>
  {/if}
</div>
```

## Color Palette

| 용도 | 색상 |
|------|------|
| 배경/오버레이 | `rgba(0, 0, 0, 0.8)` |
| 어두운 패널 | `#1a1a2e`, `#16213e` |
| 메인 강조 | `#e94560` |
| 체력 (녹색) | `#22c55e`, `#44ff44` |
| 스태미나 (파랑) | `#3b82f6`, `#60a5fa` |
| 보스 체력 (빨강) | `#e94560`, `#ff6b6b` |
| 경고/골드 | `#ffaa00` |
| 텍스트 | `#ffffff`, `#aaa` |

## Text Effects

### Glow Text
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
}
```

## Responsive Considerations

```css
/* 포인터 이벤트 관리 */
.game-ui {
  position: absolute;
  inset: 0;
  pointer-events: none;  /* 3D 인터랙션 허용 */
}

.game-ui button,
.game-ui .interactive {
  pointer-events: auto;  /* 버튼만 클릭 가능 */
}
```

## Animation Patterns

### Bar Transitions
```css
.bar-fill {
  transition: width 0.3s ease;
}
```

### Button Hover
```css
button {
  transition: all 0.3s ease;
}

button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px rgba(233, 69, 96, 0.5);
}
```

### Fade In/Out
```svelte
{#if show}
  <div class="overlay" transition:fade={{ duration: 300 }}>
    ...
  </div>
{/if}
```

## State-Based Visibility

```svelte
<!-- 게임 중에만 HUD 표시 -->
{#if $gameState === 'playing'}
  <div class="hud">
    <!-- HUD 요소들 -->
  </div>
{/if}

<!-- 일시정지/메뉴에서 커서 표시 -->
{#if $gameState !== 'playing'}
  <style>
    :global(body) { cursor: auto; }
  </style>
{/if}
```

## AI Stats Debug Panel

```svelte
{#if showDebugPanel}
  <div class="debug-panel">
    <h3>AI Learning Stats</h3>
    <p>Light: {$aiLearningData.attackPatterns.light}</p>
    <p>Heavy: {$aiLearningData.attackPatterns.heavy}</p>
    <p>Dodge L: {$aiLearningData.dodgeDirections.left}</p>
    <p>Dodge R: {$aiLearningData.dodgeDirections.right}</p>
    <p>Parries: {$aiLearningData.defensiveActions.parry}</p>
  </div>
{/if}
```

## Key File

| 파일 | 역할 |
|------|------|
| `GameUI.svelte` | 모든 UI/HUD 컴포넌트 |
| `app.css` | 글로벌 리셋 스타일 |
| `gameStore.ts` | UI에서 구독하는 상태들 |
