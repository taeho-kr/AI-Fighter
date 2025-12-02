# 3D Graphics & Physics Development

## Threlte Architecture

### Canvas Setup (Game.svelte)
```svelte
<Canvas>
  <Scene />
</Canvas>
```

### World & Physics (Scene.svelte)
```svelte
<World>
  <!-- 모든 물리 객체는 World 내부에 -->
</World>
```

## Core Components

### Scene.svelte
- World 컨테이너 (물리)
- 조명 시스템 설정
- 씬 오케스트레이션
- 공격 충돌 감지

### Arena.svelte
- 고정 강체 (ground, walls)
- 장식 요소 (rings, pillars)
- 물리 콜라이더

### CameraController.svelte
- 1인칭/3인칭 모드
- 포인터 락 마우스 컨트롤
- Lerp 기반 스무스 팔로우

## Lighting System

```svelte
<!-- 메인 태양광 -->
<T.DirectionalLight
  intensity={1.5}
  castShadow
  position={[10, 20, 10]}
>
  <T.OrthographicCamera
    args={[-20, 20, 20, -20, 0.1, 50]}
    attach="shadow-camera"
  />
</T.DirectionalLight>

<!-- 필 라이트 -->
<T.AmbientLight intensity={0.3} />

<!-- 포인트 라이트 (필러) -->
<T.PointLight color="#ff4444" intensity={20} />
```

### Shadow Configuration
- `castShadow`: 캐릭터 메시에 적용
- `receiveShadow`: 바닥/벽에 적용
- OrthographicCamera로 그림자 영역 정의

## Physics (Rapier)

### RigidBody Types
```svelte
<!-- 동적 (움직이는 객체) -->
<RigidBody type="dynamic" linearDamping={5}>

<!-- 고정 (환경) -->
<RigidBody type="fixed">
```

### Collider Shapes
```svelte
<!-- 캐릭터 -->
<Collider shape="capsule" args={[0.5, 0.3]} />

<!-- 바닥/벽 -->
<Collider shape="cuboid" args={[size, height, depth]} />

<!-- 필러 -->
<Collider shape="cylinder" args={[height, radius]} />
```

### Physics Properties
```svelte
<RigidBody
  linearDamping={5}      <!-- 이동 감속 -->
  mass={1}
  restitution={0}        <!-- 반발력 -->
>
```

## Geometry Patterns

### Character Model
```svelte
<!-- 몸체 -->
<T.Mesh>
  <T.CapsuleGeometry args={[0.3, 1, 8, 16]} />
  <T.MeshStandardMaterial color="#색상" />
</T.Mesh>

<!-- 머리 -->
<T.Mesh position={[0, 1, 0]}>
  <T.SphereGeometry args={[0.25, 16, 16]} />
</T.Mesh>
```

### Weapon
```svelte
<T.Group position={weaponPos} rotation={weaponRot}>
  <!-- 손잡이 -->
  <T.Mesh>
    <T.CylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
  </T.Mesh>
  <!-- 날 -->
  <T.Mesh>
    <T.BoxGeometry args={[0.05, 0.6, 0.02]} />
  </T.Mesh>
</T.Group>
```

### Environment
```svelte
<!-- 스카이 스피어 -->
<T.Mesh>
  <T.SphereGeometry args={[100, 32, 32]} />
  <T.MeshBasicMaterial color="#1a1a2e" side={BackSide} />
</T.Mesh>

<!-- 바닥 링 -->
<T.Mesh rotation.x={-Math.PI / 2}>
  <T.RingGeometry args={[innerR, outerR, 64]} />
</T.Mesh>
```

## Materials

### MeshStandardMaterial (PBR)
```svelte
<T.MeshStandardMaterial
  color="#22c55e"
  emissive="#색상"
  emissiveIntensity={0.2}
/>
```

### Glow Effect
```svelte
<T.MeshStandardMaterial
  color="#ffaa00"
  emissive="#ffaa00"
  emissiveIntensity={0.5}
/>
```

## Frame Updates

### useTask Hook
```typescript
import { useTask } from '@threlte/core';

useTask((delta) => {
  // delta: 프레임 간 시간 (초)
  // 매 프레임 호출
  position.x += velocity * delta;
});
```

## Key File Locations

| 파일 | 역할 |
|------|------|
| `Scene.svelte` | 3D 씬 구성, 조명, World |
| `Arena.svelte` | 환경 지오메트리, 물리 |
| `CameraController.svelte` | 카메라 로직 |
| `PlayerCombat.svelte` | 플레이어 3D 모델 |
| `EnemyAI.svelte` | 적 3D 모델 |

## Color Palette

- 배경: `#1a1a2e`
- 바닥: `#16213e`, `#0f3460`
- 플레이어: `#22c55e` (녹색)
- 적: `#ff4444` (빨강)
- 포인트라이트: `#ff4444` (빨강 글로우)
- 골드/경고: `#ffaa00`
