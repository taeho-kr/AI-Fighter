# 3D Graphics & Physics

> 관련 파일: `Scene.svelte`, `Arena.svelte`, `CameraController.svelte`, `HumanoidModel.svelte`

## Threlte Setup

### Canvas (Game.svelte)
```svelte
<Canvas>
  <Scene />
</Canvas>
```

### World (Scene.svelte)
```svelte
<World gravity={[0, -9.81, 0]}>
  <!-- 모든 물리 객체 -->
</World>
```

## Physics (Rapier 3D)

### RigidBody Types
```svelte
<!-- 동적 객체 (캐릭터) -->
<RigidBody type="dynamic" linearDamping={5} angularDamping={5}>

<!-- 고정 객체 (환경) -->
<RigidBody type="fixed">
```

### Collider Shapes
```svelte
<!-- 캐릭터 (캡슐) -->
<Collider shape="capsule" args={[halfHeight, radius]} />

<!-- 바닥/벽 (박스) -->
<Collider shape="cuboid" args={[halfWidth, halfHeight, halfDepth]} />

<!-- 기둥 (실린더) -->
<Collider shape="cylinder" args={[halfHeight, radius]} />
```

### Physics Properties
```svelte
<RigidBody
  linearDamping={5}      // 이동 감속
  angularDamping={5}     // 회전 감속
  mass={1}               // 질량
  restitution={0}        // 반발력 (탄성)
  friction={0.5}         // 마찰력
>
```

## Lighting System

```svelte
<!-- 메인 태양광 (그림자 생성) -->
<T.DirectionalLight
  intensity={1.5}
  position={[10, 20, 10]}
  castShadow
>
  <T.OrthographicCamera
    args={[-20, 20, 20, -20, 0.1, 50]}
    attach="shadow-camera"
  />
</T.DirectionalLight>

<!-- 앰비언트 (기본 밝기) -->
<T.AmbientLight intensity={0.3} />

<!-- 포인트 라이트 (기둥 글로우) -->
<T.PointLight
  color="#ff4444"
  intensity={20}
  distance={15}
  decay={2}
/>
```

### Shadow Setup
```svelte
<!-- 그림자 생성 -->
<T.Mesh castShadow>

<!-- 그림자 수신 -->
<T.Mesh receiveShadow>
```

## HumanoidModel (998 lines)

### Joint Structure
```
Root
├── Torso (몸통)
│   ├── Head (머리)
│   ├── LeftShoulder → LeftUpperArm → LeftLowerArm → LeftHand
│   ├── RightShoulder → RightUpperArm → RightLowerArm → RightHand
│   └── Weapon (오른손에 부착)
└── Hips (골반)
    ├── LeftUpperLeg → LeftLowerLeg → LeftFoot
    └── RightUpperLeg → RightLowerLeg → RightFoot
```

### Animation States
```typescript
type AnimationState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack_light'
  | 'attack_heavy'
  | 'guard'
  | 'dodge'
  | 'stunned';
```

### Joint Calculation (Performance Issue)
```typescript
// 매 프레임 100+ 라인의 관절 계산 실행
// TODO: 메모이제이션 필요
const joints = $derived.by(() => {
  // 복잡한 관절 위치/회전 계산
  // animationState에 따른 포즈 보간
});
```

## Arena Environment (Arena.svelte)

### Floor
```svelte
<RigidBody type="fixed">
  <Collider shape="cuboid" args={[25, 0.5, 25]} />
  <T.Mesh receiveShadow position.y={-0.5}>
    <T.BoxGeometry args={[50, 1, 50]} />
    <T.MeshStandardMaterial color="#16213e" />
  </T.Mesh>
</RigidBody>
```

### Decorative Rings
```svelte
<T.Mesh rotation.x={-Math.PI / 2} position.y={0.01}>
  <T.RingGeometry args={[innerRadius, outerRadius, 64]} />
  <T.MeshStandardMaterial
    color="#0f3460"
    emissive="#0f3460"
    emissiveIntensity={0.2}
  />
</T.Mesh>
```

### Pillars
```svelte
<RigidBody type="fixed" position={pillarPos}>
  <Collider shape="cylinder" args={[2, 0.5]} />
  <T.Mesh castShadow>
    <T.CylinderGeometry args={[0.5, 0.5, 4, 16]} />
    <T.MeshStandardMaterial color="#1a1a2e" />
  </T.Mesh>
  <!-- 상단 글로우 -->
  <T.PointLight color="#ff4444" intensity={20} position.y={2.5} />
</RigidBody>
```

## Camera (CameraController.svelte)

### Modes
- **1인칭**: 캐릭터 머리 위치
- **3인칭**: 캐릭터 뒤쪽 오프셋

### Controls
- 마우스 이동: 카메라 회전
- V 키: 모드 전환
- Pointer Lock 사용

```typescript
useTask((delta) => {
  // 스무스 팔로우
  cameraPos.lerp(targetPos, lerpFactor * delta);
});
```

## Geometry Patterns

### Character
```svelte
<T.Mesh castShadow>
  <T.CapsuleGeometry args={[radius, height, radialSegments, heightSegments]} />
  <T.MeshStandardMaterial color={characterColor} />
</T.Mesh>
```

### Weapon
```svelte
<T.Group position={weaponPosition} rotation={weaponRotation}>
  <!-- 손잡이 -->
  <T.Mesh>
    <T.CylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
    <T.MeshStandardMaterial color="#8B4513" />
  </T.Mesh>
  <!-- 날 -->
  <T.Mesh>
    <T.BoxGeometry args={[0.05, 0.6, 0.02]} />
    <T.MeshStandardMaterial color="#C0C0C0" metalness={0.8} />
  </T.Mesh>
</T.Group>
```

## Materials

### Standard PBR
```svelte
<T.MeshStandardMaterial
  color="#22c55e"
  metalness={0.1}
  roughness={0.8}
/>
```

### Emissive (Glow)
```svelte
<T.MeshStandardMaterial
  color="#ffaa00"
  emissive="#ffaa00"
  emissiveIntensity={0.5}
/>
```

## Color Palette

| 용도 | 색상 |
|------|------|
| 배경/스카이 | `#1a1a2e` |
| 바닥 | `#16213e` |
| 바닥 링 | `#0f3460` |
| 플레이어 | `#22c55e` (녹색) |
| 적 | `#ff4444` (빨강) |
| 포인트라이트 | `#ff4444` |
| 골드/경고 | `#ffaa00` |

## useTask Hook

```typescript
import { useTask } from '@threlte/core';

useTask((delta) => {
  // delta: 이전 프레임 이후 경과 시간 (초)
  // 60fps → delta ≈ 0.0167
  position.x += velocity * delta;
});
```

## Performance Notes

### 현재 이슈
- HumanoidModel의 `joints` 계산이 매 프레임 실행
- 100+ 라인의 복잡한 수학 연산

### 최적화 제안
```typescript
// 이전: 매 프레임 전체 재계산
const joints = $derived.by(() => { ... });

// 개선: animationState 변경 시에만 계산
let cachedJoints = $state({});
$effect(() => {
  if (animationStateChanged) {
    cachedJoints = calculateJoints(animationState);
  }
});
```
