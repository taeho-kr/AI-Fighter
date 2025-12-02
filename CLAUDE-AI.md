# AI Learning System Development

## Overview

보스 AI가 플레이어의 전투 패턴을 실시간으로 학습하고 전략을 조정하는 시스템.

## Core Components

- **gameStore.ts** - 학습 데이터 저장
- **EnemyAI.svelte** - 학습 기반 행동

## Data Structures

### Action Record
```typescript
interface ActionRecord {
  action: string;      // 'attack_light', 'dodge_left', 'parry', etc.
  timestamp: number;   // Date.now()
}
```

### Learning Data
```typescript
interface AILearningData {
  attackPatterns: {
    light: number;     // light attack 빈도
    heavy: number;     // heavy attack 빈도
  };
  dodgeDirections: {
    forward: number;
    backward: number;
    left: number;
    right: number;
  };
  defensiveActions: {
    guard: number;     // 가드 빈도
    parry: number;     // 패리 빈도
  };
  attackTimings: number[];        // 공격 간 시간 간격
  dodgedAttackTypes: string[];    // 회피한 공격 유형
}
```

## Store Implementation

### gameStore.ts
```typescript
import { writable, derived } from 'svelte/store';

// 최근 100개 액션 기록
export const playerActionHistory = writable<ActionRecord[]>([]);

// 분석된 학습 데이터
export const aiLearningData = writable<AILearningData>({
  attackPatterns: { light: 0, heavy: 0 },
  dodgeDirections: { forward: 0, backward: 0, left: 0, right: 0 },
  defensiveActions: { guard: 0, parry: 0 },
  attackTimings: [],
  dodgedAttackTypes: []
});
```

### Recording Actions
```typescript
export function recordAction(action: string) {
  const record: ActionRecord = {
    action,
    timestamp: Date.now()
  };

  playerActionHistory.update(history => {
    const updated = [...history, record];
    // 최대 100개 유지
    return updated.slice(-100);
  });

  // 학습 데이터 업데이트
  updateLearningData(action);
}
```

### Updating Learning Data
```typescript
function updateLearningData(action: string) {
  aiLearningData.update(data => {
    // 공격 패턴
    if (action === 'attack_light') data.attackPatterns.light++;
    if (action === 'attack_heavy') data.attackPatterns.heavy++;

    // 회피 방향
    if (action.startsWith('dodge_')) {
      const direction = action.replace('dodge_', '');
      data.dodgeDirections[direction]++;
    }

    // 방어 행동
    if (action === 'guard') data.defensiveActions.guard++;
    if (action === 'parry') data.defensiveActions.parry++;

    // 공격 타이밍 계산
    // ...

    return { ...data };
  });
}
```

## AI Behavior (EnemyAI.svelte)

### Pattern Analysis
```typescript
let analyzeTimer = 0;
const analyzeInterval = 0.3; // 300ms마다 분석

useTask((delta) => {
  analyzeTimer += delta;

  if (analyzeTimer >= analyzeInterval) {
    analyzeTimer = 0;
    analyzePlayerPatterns();
  }
});
```

### Dodge Direction Prediction
```typescript
function predictDodgeDirection(): string {
  const dodges = $aiLearningData.dodgeDirections;
  const total = dodges.forward + dodges.backward + dodges.left + dodges.right;

  if (total < 5) return 'random'; // 데이터 부족

  // 가장 빈번한 방향 찾기
  let maxDir = 'forward';
  let maxCount = dodges.forward;

  for (const [dir, count] of Object.entries(dodges)) {
    if (count > maxCount) {
      maxCount = count;
      maxDir = dir;
    }
  }

  return maxDir;
}
```

### Attack Type Prediction
```typescript
function predictNextAttack(): 'light' | 'heavy' {
  const attacks = $aiLearningData.attackPatterns;
  const total = attacks.light + attacks.heavy;

  if (total < 3) return 'light'; // 기본값

  // 더 자주 쓰는 공격 유형 반환
  return attacks.heavy > attacks.light ? 'heavy' : 'light';
}
```

### Counter Strategy
```typescript
function chooseCounterStrategy() {
  const predicted = predictNextAttack();
  const dodgeDir = predictDodgeDirection();

  if (predicted === 'heavy') {
    // 헤비 공격 예측 시 빠른 선공
    return 'preemptive_attack';
  }

  if ($aiLearningData.defensiveActions.parry > 5) {
    // 패리 자주 사용 시 페이크 공격
    return 'feint_attack';
  }

  // 예측된 회피 방향으로 공격
  return `attack_towards_${dodgeDir}`;
}
```

## Boss Level Scaling

### Stats per Level
```typescript
const levelScaling = {
  speed: 0.5,           // +0.5 per level
  damage: {
    base: 5,
    predicted: 10
  },
  predictionAccuracy: 0.15  // +15% per level
};
```

### Prediction Accuracy
```typescript
function shouldUsePrediction(): boolean {
  const baseAccuracy = 0.3;
  const levelBonus = bossLevel * 0.15;
  const totalAccuracy = Math.min(0.9, baseAccuracy + levelBonus);

  return Math.random() < totalAccuracy;
}
```

## AI State Machine

### States
```typescript
type EnemyState = 'idle' | 'chasing' | 'attacking' | 'stunned' | 'predicting' | 'retreating';
```

### State Logic
```typescript
useTask((delta) => {
  switch (state) {
    case 'idle':
      if (playerDistance < detectionRange) {
        state = 'chasing';
      }
      break;

    case 'chasing':
      moveTowardsPlayer(delta);
      if (playerDistance < attackRange) {
        if (shouldUsePrediction()) {
          state = 'predicting';
        } else {
          state = 'attacking';
        }
      }
      break;

    case 'predicting':
      // 예측 기반 공격 준비
      const predictedDir = predictDodgeDirection();
      performPredictedAttack(predictedDir);
      state = 'attacking';
      break;

    case 'attacking':
      // 공격 애니메이션 진행
      if (attackComplete) {
        state = 'retreating';
      }
      break;

    case 'retreating':
      moveAwayFromPlayer(delta);
      if (retreatComplete || cooldownOver) {
        state = 'idle';
      }
      break;

    case 'stunned':
      // 스턴 타이머에 의해 자동 해제
      break;
  }
});
```

## Learning Reset

### Per Round
```typescript
// 라운드 간 학습 데이터 유지
// 보스가 플레이어를 "기억"함
```

### Full Reset
```typescript
function resetAILearning() {
  aiLearningData.set({
    attackPatterns: { light: 0, heavy: 0 },
    dodgeDirections: { forward: 0, backward: 0, left: 0, right: 0 },
    defensiveActions: { guard: 0, parry: 0 },
    attackTimings: [],
    dodgedAttackTypes: []
  });
  playerActionHistory.set([]);
}
```

## Debug/Stats Display

### GameUI.svelte에서 표시
```svelte
{#if showAIStats}
  <div class="ai-stats">
    <p>Light attacks: {$aiLearningData.attackPatterns.light}</p>
    <p>Heavy attacks: {$aiLearningData.attackPatterns.heavy}</p>
    <p>Favorite dodge: {getMostFrequentDodge()}</p>
    <p>Parry count: {$aiLearningData.defensiveActions.parry}</p>
  </div>
{/if}
```

## Extending the AI

### Adding New Patterns
1. `ActionRecord` 타입에 새 액션 추가
2. `recordAction()` 호출 지점 추가
3. `AILearningData`에 새 분석 필드 추가
4. `EnemyAI.svelte`에서 새 패턴 활용

### Improving Predictions
- 시퀀스 기반 예측 (마르코프 체인)
- 시간 기반 패턴 (특정 체력에서의 행동)
- 반응 시간 학습

## Key Files

| 파일 | 역할 |
|------|------|
| `gameStore.ts` | 학습 데이터 스토어, recordAction |
| `EnemyAI.svelte` | 패턴 분석, 예측 로직 |
| `PlayerCombat.svelte` | recordAction 호출 지점 |
| `GameUI.svelte` | AI 통계 디스플레이 |
