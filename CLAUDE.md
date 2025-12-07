# AI-Fighter - Adaptive Boss Combat Game

## Overview

3D 적응형 보스 전투 게임. DQN 기반 AI가 플레이어의 전투 패턴을 학습하고 전략을 조정함.

## Tech Stack

- **Framework**: Svelte 5 (Runes) + Vite + Electron
- **3D Engine**: Three.js + Threlte v9
- **Physics**: Rapier 3D
- **AI**: TensorFlow.js (DQN)
- **Language**: TypeScript (strict mode)

## Commands

```bash
npm run dev        # Electron 개발 모드
npm run build      # 프로덕션 빌드
npm run preview    # Vite 빌드 미리보기
npm run check      # TypeScript 타입 체크
```

## Project Structure

```
src/
├── App.svelte              # 진입점
├── main.ts                 # Electron 부트스트랩
├── lib/
│   ├── components/         # Svelte 컴포넌트 (14개)
│   │   ├── Game.svelte              # Canvas 오케스트레이터 (39L)
│   │   ├── Scene.svelte             # 물리/충돌/조명 (236L)
│   │   ├── Arena.svelte             # 환경 지오메트리 (47L)
│   │   ├── PlayerCombat.svelte      # 플레이어 로직 (1002L) ⚠️
│   │   ├── EnemyAI.svelte           # 보스 AI (746L) ⚠️
│   │   ├── HumanoidModel.svelte     # 휴머노이드 렌더링 (998L) ⚠️
│   │   ├── CharacterModel.svelte    # 캐릭터 래퍼 (188L)
│   │   ├── CameraController.svelte  # 카메라 로직 (117L)
│   │   ├── GameUI.svelte            # HUD/메뉴 (288L)
│   │   ├── DamageNumber.svelte      # 데미지 표시 (91L)
│   │   ├── LoadingScreen.svelte     # 로딩 화면 (226L)
│   │   ├── KeyboardHints.svelte     # 키 가이드 (169L)
│   │   ├── SettingsMenu.svelte      # 설정 메뉴 (652L)
│   │   └── AchievementNotification.svelte (130L)
│   ├── stores/
│   │   ├── gameStore.ts       # 게임 상태 & AI 학습 데이터
│   │   └── settingsStore.ts   # 설정, 업적, 통계
│   ├── ai/
│   │   ├── DQN.ts             # Deep Q-Network (사용 중)
│   │   └── QLearning.ts       # Q-Learning (미사용)
│   ├── combat/
│   │   └── constants.ts       # 전투 상수 (범위, 데미지 등)
│   ├── audio/
│   │   └── AudioManager.ts    # 사운드 시스템 (미연동)
│   ├── textures/
│   │   └── sharedTextures.ts  # 텍스처 캐싱
│   └── steam/
│       └── steamworks.ts      # Steam 연동
├── app.css
└── app.html
```

## Component Hierarchy

```
App.svelte
└── Game.svelte
    ├── Canvas (Threlte)
    │   └── Scene.svelte
    │       ├── World (Rapier)
    │       ├── CameraController
    │       ├── Lighting
    │       ├── Arena
    │       ├── PlayerCombat → HumanoidModel
    │       ├── EnemyAI → HumanoidModel
    │       └── DamageNumber[]
    └── GameUI.svelte
```

## Game States

```typescript
type GameState = 'menu' | 'playing' | 'paused' | 'dead' | 'victory';
type PlayerState = 'idle' | 'attacking' | 'guarding' | 'dodging' | 'stunned' | 'parrying';
type EnemyState = 'idle' | 'attacking' | 'stunned' | 'chasing';
// ⚠️ 문서에 있던 'predicting', 'retreating'은 미구현
```

## Key Constants (combat/constants.ts)

```typescript
CHARACTER_HEIGHT = 1.8  // 기준 높이 (미터)
MELEE_ATTACK_RANGE = 3.24
HEAVY_ATTACK_RANGE = 3.56
LIGHT_ATTACK_DAMAGE = 10
HEAVY_ATTACK_DAMAGE = 25
MAX_STAMINA = 100
STAMINA_REGEN_RATE = 2  // per 100ms
```

## Related Documentation

| 파일 | 내용 |
|------|------|
| [CLAUDE-3D.md](./CLAUDE-3D.md) | 3D 그래픽, 물리, 조명 |
| [CLAUDE-COMBAT.md](./CLAUDE-COMBAT.md) | 전투 시스템, 상태 머신 |
| [CLAUDE-AI.md](./CLAUDE-AI.md) | DQN 학습, 패턴 분석 |
| [CLAUDE-UI.md](./CLAUDE-UI.md) | UI 컴포넌트, 스타일링 |

---

## Known Issues & TODOs

### Completed (v1.1)
- [x] Enemy 상태 머신에 `predicting`, `retreating` 추가
- [x] DQN 상태 벡터 확장 (12차원 → 20차원)
- [x] 학습 데이터 localStorage 저장
- [x] `recordMovement()` PlayerCombat에 연동
- [x] 미사용 코드 정리 (`QLearning.ts`, `_parryCooldown` 삭제)
- [x] AudioManager 전투 시스템 연동 (playSFX 호출)

### Remaining
- [ ] DQN과 통계학습 시스템 통합 또는 단일화
- [ ] 대형 컴포넌트 분리 (PlayerCombat 1000줄, HumanoidModel 998줄)
- [ ] 난이도 설정을 게임 로직에 반영
- [ ] 휴머노이드 관절 계산 메모이제이션

---

## Development Conventions

### Svelte 5 Runes
```typescript
let health = $state(100);           // 반응형 상태
let maxHealth = $derived(health);   // 계산된 값
$effect(() => { /* 사이드 이펙트 */ });
```

### Store Pattern
```typescript
import { get } from 'svelte/store';
import { playerHealth } from '$lib/stores/gameStore';

const health = get(playerHealth);  // 일회성 읽기
$playerHealth                       // 반응형 구독
```

### 3D Component Pattern
```svelte
<script>
  import { T, useTask } from '@threlte/core';
  import { RigidBody, Collider } from '@threlte/rapier';

  useTask((delta) => {
    // 매 프레임 업데이트, delta는 초 단위
  });
</script>

<RigidBody type="dynamic" linearDamping={5}>
  <Collider shape="capsule" args={[0.5, 0.3]} />
  <T.Mesh castShadow>
    <T.CapsuleGeometry args={[0.3, 1, 8, 16]} />
    <T.MeshStandardMaterial color="#22c55e" />
  </T.Mesh>
</RigidBody>
```

### AI 학습 기록
```typescript
import { recordAction } from '$lib/stores/gameStore';

// 플레이어 액션 발생 시
recordAction({ type: 'light_attack', timestamp: Date.now(), ... });
```
