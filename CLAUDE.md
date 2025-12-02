# Threlte Game - AI Adaptive Combat

## Project Overview

3D 적응형 보스 전투 게임. AI가 플레이어의 전투 패턴을 학습하고 전략을 조정함.

## Tech Stack

- **Framework**: Svelte 5 + SvelteKit 2
- **3D Engine**: Three.js + Threlte
- **Physics**: Rapier 3D
- **Language**: TypeScript (strict mode)
- **Build**: Vite

## Commands

```bash
npm run dev      # 개발 서버 (HMR)
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 미리보기
npm run check    # TypeScript 타입 체크
```

## Project Structure

```
src/
├── routes/
│   ├── +layout.svelte    # 루트 레이아웃
│   └── +page.svelte      # 게임 진입점
├── lib/
│   ├── components/       # Svelte 컴포넌트
│   │   ├── Game.svelte          # 메인 오케스트레이터
│   │   ├── Scene.svelte         # 3D 씬 설정
│   │   ├── Arena.svelte         # 전투 아레나
│   │   ├── PlayerCombat.svelte  # 플레이어 캐릭터
│   │   ├── EnemyAI.svelte       # 보스 AI
│   │   ├── CameraController.svelte
│   │   └── GameUI.svelte        # HUD & 메뉴
│   └── stores/
│       └── gameStore.ts   # 중앙 상태 관리
├── app.css               # 글로벌 스타일
└── app.html
```

## Component Hierarchy

```
+page.svelte
└── Game.svelte
    └── Canvas (Threlte)
        └── Scene.svelte
            ├── CameraController
            ├── Lighting (Directional + Ambient)
            ├── Arena
            ├── PlayerCombat
            └── EnemyAI
        └── GameUI (Canvas 외부)
```

## Development Conventions

### Svelte 5 Runes
- `$state` - 반응형 상태
- `$derived` - 계산된 값
- `$effect` - 사이드 이펙트

### Store Pattern
```typescript
import { get } from 'svelte/store';
import { playerHealth } from '$lib/stores/gameStore';

// 읽기
const health = get(playerHealth);

// 반응형 (템플릿)
{$playerHealth}
```

### 3D Component Pattern
```svelte
<script>
  import { T, useTask } from '@threlte/core';
  import { RigidBody, Collider } from '@threlte/rapier';

  useTask((delta) => {
    // 프레임별 업데이트
  });
</script>

<RigidBody>
  <Collider shape="capsule" />
  <T.Mesh castShadow>
    <T.CapsuleGeometry />
    <T.MeshStandardMaterial />
  </T.Mesh>
</RigidBody>
```

## Related Docs

- [CLAUDE-3D.md](./CLAUDE-3D.md) - 3D 그래픽 & 물리
- [CLAUDE-COMBAT.md](./CLAUDE-COMBAT.md) - 전투 시스템
- [CLAUDE-AI.md](./CLAUDE-AI.md) - AI 학습 시스템
- [CLAUDE-UI.md](./CLAUDE-UI.md) - UI/UX 개발
