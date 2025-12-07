# Combat System

> 관련 파일: `PlayerCombat.svelte`, `EnemyAI.svelte`, `Scene.svelte`, `combat/constants.ts`

## Player Combat States

```typescript
type PlayerState = 'idle' | 'attacking' | 'guarding' | 'dodging' | 'stunned' | 'parrying';
```

### State Transitions
```
idle → attacking    (LMB 클릭 또는 충전 후 해제)
idle → guarding     (RMB 홀드)
idle → parrying     (E키, 300ms 윈도우)
idle → dodging      (Shift + 방향키, 400ms)
attacking → idle    (애니메이션 완료)
guarding → idle     (RMB 해제)
parrying → idle     (윈도우 종료)
dodging → idle      (무적 시간 종료)
stunned → idle      (스턴 지속시간 종료)
```

## Combat Actions

### Light Attack (LMB 클릭)
| 속성 | 값 |
|------|-----|
| 스태미나 | 10 |
| 데미지 | 10 (LIGHT_ATTACK_DAMAGE) |
| 쿨다운 | 500ms |
| 범위 | 3.24m (MELEE_ATTACK_RANGE) |

### Heavy Attack (LMB 2초 이상 충전)
| 속성 | 값 |
|------|-----|
| 스태미나 | 25 |
| 데미지 | 25 (HEAVY_ATTACK_DAMAGE) |
| 쿨다운 | 1000ms |
| 범위 | 3.56m (HEAVY_ATTACK_RANGE, +10%) |
| 충전 임계값 | 2000ms |

### Guard (RMB 홀드)
| 속성 | 값 |
|------|-----|
| 스태미나 소모 | 5/초 |
| 데미지 감소 | 70% |
| 상태 | 'guarding' 유지 |

### Parry (E키)
| 속성 | 값 |
|------|-----|
| 스태미나 | 15 |
| 활성 윈도우 | 300ms |
| 성공 효과 | 적 1.5~2초 스턴 |

### Dodge (Shift + WASD)
| 속성 | 값 |
|------|-----|
| 스태미나 | 20 |
| 무적 시간 | 400ms |
| 방향 | forward, backward, left, right |

## Stamina System

```typescript
// constants.ts
MAX_STAMINA = 100
STAMINA_REGEN_RATE = 2  // per 100ms (20/초)

// 재생 조건: state === 'idle' && !isGuarding
```

## Damage Calculation

### Player → Enemy
```typescript
let damage = isHeavyAttack ? HEAVY_ATTACK_DAMAGE : LIGHT_ATTACK_DAMAGE;
if (enemyState === 'stunned') {
  damage *= 1.5;  // 스턴 보너스
}
enemyHealth -= damage;
```

### Enemy → Player
```typescript
let damage = enemyBaseDamage + (bossLevel * 5);
if (playerState === 'dodging') return;  // 무적
if (playerState === 'parrying') {
  applyStunToEnemy(1500 + Math.random() * 500);
  return;
}
if (playerState === 'guarding') {
  damage *= 0.3;  // 70% 감소
}
playerHealth -= damage;
```

## Collision Detection (Scene.svelte)

```typescript
useTask(() => {
  const distance = playerPos.distanceTo(enemyPos);
  const attackRange = isHeavyAttack ? HEAVY_ATTACK_RANGE : MELEE_ATTACK_RANGE;

  // 플레이어 공격 히트
  if (playerState === 'attacking' && distance < attackRange && !playerAttackHit) {
    enemyRef.takeDamage(currentDamage);
    playerAttackHit = true;
  }

  // 적 공격 히트
  if (enemyState === 'attacking' && distance < attackRange && !enemyAttackHit) {
    // 패리/가드/데미지 처리
    enemyAttackHit = true;
  }
});
```

## Enemy Combat

### Current States (실제 구현)
```typescript
type EnemyState = 'idle' | 'attacking' | 'stunned' | 'chasing';
// TODO: 'predicting', 'retreating' 추가 필요
```

### Boss Level Scaling
| 레벨 | 체력 | 이동속도 | Light 데미지 | Heavy 데미지 | 예측 정확도 |
|------|------|----------|--------------|--------------|-------------|
| 1 | 120 | 3.5 | 15 | 25 | 45% |
| 2 | 140 | 4.0 | 20 | 35 | 60% |
| 3 | 160 | 4.5 | 25 | 45 | 75% |
| n | 100+20n | 3+0.5n | 10+5n | 15+10n | min(90%, 30+15n)% |

## Input Bindings (PlayerCombat.svelte)

| 입력 | 액션 |
|------|------|
| W/A/S/D | 이동 |
| LMB (클릭) | 약공격 |
| LMB (2초 홀드) | 강공격 |
| RMB (홀드) | 가드 |
| E | 패리 |
| Shift + 방향 | 회피 |
| V | 카메라 전환 |

## Component Exports

### PlayerCombat.svelte
```typescript
export function takeDamage(amount: number): void;
export function getPosition(): Vector3;
export function isInAttackState(): boolean;
export function isParrying(): boolean;
export function isGuarding(): boolean;
export function getRigidBody(): RigidBody;
```

### EnemyAI.svelte
```typescript
export function takeDamage(amount: number): void;
export function applyStun(duration: number): void;
export function getPosition(): Vector3;
export function isAttacking(): boolean;
export function getRigidBody(): RigidBody;
```

## Action Recording

플레이어 액션 발생 시 AI 학습을 위해 기록:

```typescript
// PlayerCombat.svelte에서 호출
recordAction({
  type: 'light_attack' | 'heavy_attack' | 'dodge_left' | 'dodge_right' | 'parry' | 'guard',
  timestamp: Date.now(),
  playerHealth: currentHealth,
  enemyHealth: currentEnemyHealth,
  distanceToEnemy: distance
});
```
