# Combat System Development

## Core Components

- **PlayerCombat.svelte** - 플레이어 전투 로직
- **EnemyAI.svelte** - 적 전투 로직
- **Scene.svelte** - 충돌 감지 오케스트레이션

## Player Combat States

```typescript
type PlayerState = 'idle' | 'attacking' | 'guarding' | 'dodging' | 'stunned' | 'parrying';
```

### State Transitions
```
idle → attacking (LMB/Q)
idle → guarding (RMB hold)
idle → parrying (E, 200ms window)
idle → dodging (Shift, 400ms)
attacking → idle (애니메이션 완료)
stunned → idle (스턴 시간 종료)
```

## Combat Actions

### Light Attack (LMB)
```typescript
{
  stamina: 10,
  damage: 12,
  duration: 400ms,
  recordAction: 'attack_light'
}
```

### Heavy Attack (Q)
```typescript
{
  stamina: 25,
  damage: 25,
  duration: 600ms,
  recordAction: 'attack_heavy'
}
```

### Guard (RMB Hold)
```typescript
{
  stamina: 5/sec,
  damageReduction: 0.7,  // 70% 감소
  state: 'guarding'
}
```

### Parry (E)
```typescript
{
  stamina: 15,
  window: 200ms,
  effect: 'enemy stun',
  recordAction: 'parry'
}
```

### Dodge (Shift + Direction)
```typescript
{
  stamina: 20,
  invulnerability: 400ms,
  directions: ['forward', 'backward', 'left', 'right'],
  recordAction: 'dodge_${direction}'
}
```

## Stamina System

```typescript
// 설정
const maxStamina = 100;
const staminaRegenRate = 15; // per second

// 재생 로직 (useTask)
if (stamina < maxStamina && state === 'idle') {
  stamina = Math.min(maxStamina, stamina + regenRate * delta);
}

// 소모 체크
if (stamina >= cost) {
  stamina -= cost;
  performAction();
}
```

## Damage System

### Player Taking Damage
```typescript
function takeDamage(amount: number) {
  if (isDodging) return;  // 무적

  let finalDamage = amount;
  if (isGuarding) {
    finalDamage *= 0.3;  // 30%만 받음
  }

  playerHealth.update(h => Math.max(0, h - finalDamage));
}
```

### Enemy Taking Damage
```typescript
function takeDamage(amount: number) {
  if (state === 'stunned') {
    amount *= 1.5;  // 스턴 중 추가 데미지
  }
  enemyHealth.update(h => Math.max(0, h - amount));
}
```

## Collision Detection

### Scene.svelte - 매 프레임 체크
```typescript
useTask(() => {
  const playerPos = playerRef?.getPosition();
  const enemyPos = enemyRef?.getPosition();

  if (!playerPos || !enemyPos) return;

  const distance = playerPos.distanceTo(enemyPos);
  const attackRange = 2.5;

  // 플레이어 → 적 공격
  if (playerRef.isInAttackState() && distance < attackRange) {
    if (!playerAttackHit) {
      enemyRef.takeDamage(currentDamage);
      playerAttackHit = true;
    }
  }

  // 적 → 플레이어 공격
  if (enemyRef.isAttacking() && distance < attackRange) {
    if (!enemyAttackHit) {
      // 패리 체크
      if (playerRef.isParrying()) {
        enemyRef.applyStun(2000);
      } else {
        playerRef.takeDamage(enemyDamage);
      }
      enemyAttackHit = true;
    }
  }
});
```

## Enemy Combat

### Enemy States
```typescript
type EnemyState = 'idle' | 'chasing' | 'attacking' | 'stunned' | 'predicting' | 'retreating';
```

### Enemy Attack Pattern
```typescript
// 기본 공격
{
  baseDamage: 15,
  damagePerLevel: 5,
  attackCooldown: 2000ms,
  attackDuration: 500ms
}

// 예측 공격
{
  damage: baseDamage * 1.5,
  accuracy: 0.3 + (bossLevel * 0.15)
}
```

### Stun Mechanic
```typescript
function applyStun(duration: number) {
  state = 'stunned';
  setTimeout(() => {
    state = 'idle';
  }, duration);
}
```

## Input Handling

### PlayerCombat.svelte
```typescript
// 키 입력
window.addEventListener('keydown', (e) => {
  switch(e.code) {
    case 'KeyW': moveForward = true; break;
    case 'KeyS': moveBackward = true; break;
    case 'KeyA': moveLeft = true; break;
    case 'KeyD': moveRight = true; break;
    case 'ShiftLeft': if (canDodge()) dodge(); break;
    case 'KeyQ': if (canHeavyAttack()) heavyAttack(); break;
    case 'KeyE': if (canParry()) parry(); break;
  }
});

// 마우스 입력
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) lightAttack();      // LMB
  if (e.button === 2) startGuard();       // RMB
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 2) endGuard();
});
```

## Component Exports

### PlayerCombat.svelte
```typescript
export function takeDamage(amount: number): void;
export function getPosition(): Vector3;
export function isInAttackState(): boolean;
export function isParrying(): boolean;
export function isGuarding(): boolean;
```

### EnemyAI.svelte
```typescript
export function takeDamage(amount: number): void;
export function applyStun(duration: number): void;
export function getPosition(): Vector3;
export function isAttacking(): boolean;
```

## Game Flow

### Round System
```typescript
// gameStore.ts
function resetGame() {
  playerHealth.set(100);
  playerStamina.set(100);
  enemyHealth.set(100 + bossLevel * 20);
  playerState.set('idle');
  enemyState.set('idle');
}

function nextRound() {
  bossLevel.update(l => l + 1);
  currentRound.update(r => r + 1);
  resetGame();
}
```

### Victory/Death Conditions
```typescript
// 파생 스토어
const isPlayerAlive = derived(playerHealth, h => h > 0);
const isEnemyAlive = derived(enemyHealth, h => h > 0);

// 게임 상태 변경
$effect(() => {
  if (!$isPlayerAlive) gameState.set('dead');
  if (!$isEnemyAlive) gameState.set('victory');
});
```

## Key Files

| 파일 | 역할 |
|------|------|
| `PlayerCombat.svelte` | 플레이어 입력, 상태, 전투 |
| `EnemyAI.svelte` | 적 AI, 공격 패턴 |
| `Scene.svelte` | 충돌 감지, 데미지 전달 |
| `gameStore.ts` | 체력, 스태미나, 상태 스토어 |
