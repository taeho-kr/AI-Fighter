# AI Learning System

> 관련 파일: `ai/DQN.ts`, `EnemyAI.svelte`, `stores/gameStore.ts`

## Architecture Overview

```
┌─────────────────┐     recordAction()     ┌──────────────────┐
│ PlayerCombat    │ ──────────────────────→│ gameStore        │
│ (액션 발생)      │                        │ - actionHistory  │
└─────────────────┘                        │ - aiLearningData │
                                           └────────┬─────────┘
                                                    │ subscribe
                                                    ▼
┌─────────────────┐     selectAction()     ┌──────────────────┐
│ DQN Agent       │ ←────────────────────→│ EnemyAI          │
│ (TensorFlow.js) │                        │ (행동 결정)       │
└─────────────────┘                        └──────────────────┘
```

## DQN (Deep Q-Network) - ai/DQN.ts

### Network Architecture
```
Input Layer:  12 neurons (state vector)
Hidden 1:     64 neurons (ReLU)
Hidden 2:     64 neurons (ReLU)
Hidden 3:     32 neurons (ReLU)
Output Layer: 9 neurons (Q-values per action)
```

### State Vector (12 dimensions)
| Index | 값 | 범위 |
|-------|-----|------|
| 0 | playerHealth / maxHealth | 0~1 |
| 1 | enemyHealth / maxHealth | 0~1 |
| 2 | playerStamina / maxStamina | 0~1 |
| 3 | distance / maxDistance | 0~1 |
| 4 | isPlayerAttacking | 0/1 |
| 5 | isPlayerGuarding | 0/1 |
| 6 | isPlayerDodging | 0/1 |
| 7-11 | 패턴 빈도 (정규화) | 0~1 |

### Actions (9 types)
```typescript
type AIAction =
  | 'light_attack'
  | 'heavy_attack'
  | 'feint_attack'
  | 'guard_break'
  | 'chase'
  | 'retreat'
  | 'wait'
  | 'predict_dodge_left'
  | 'predict_dodge_right';
```

### Hyperparameters
```typescript
LEARNING_RATE = 0.001
GAMMA = 0.95          // 할인율
EPSILON_START = 0.5   // 초기 탐험율
EPSILON_MIN = 0.05    // 최소 탐험율
EPSILON_DECAY = 0.995 // 감쇠율
MEMORY_SIZE = 2000    // Experience Replay 버퍼
BATCH_SIZE = 32
TARGET_UPDATE = 100   // 타겟 네트워크 업데이트 주기
```

### Reward Signal
| 이벤트 | 보상 |
|--------|------|
| hitPlayer | +1.0 |
| gotHit | -0.8 |
| gotParried | -1.5 |
| successfulPredict | +2.0 |

## Statistical Learning - gameStore.ts

### Learning Data Structure
```typescript
interface AILearningData {
  attackPatterns: {
    light: number;   // 약공격 횟수
    heavy: number;   // 강공격 횟수
  };
  dodgeDirections: {
    forward: number;
    backward: number;
    left: number;
    right: number;
  };
  defensiveActions: {
    guard: number;   // 가드 횟수
    parry: number;   // 패리 횟수
  };
  attackTimings: number[];      // 공격 간 시간 간격
  recentActions: PlayerAction[]; // 최근 100개 액션
}
```

### Action Recording
```typescript
export function recordAction(action: PlayerAction) {
  playerActionHistory.update(history => {
    const updated = [...history, action];
    return updated.slice(-100);  // 최근 100개 유지
  });

  // 통계 업데이트
  aiLearningData.update(data => {
    if (action.type === 'light_attack') data.attackPatterns.light++;
    if (action.type === 'heavy_attack') data.attackPatterns.heavy++;
    if (action.type.startsWith('dodge_')) {
      const dir = action.type.replace('dodge_', '');
      data.dodgeDirections[dir]++;
    }
    // ...
    return { ...data };
  });
}
```

## EnemyAI Behavior (EnemyAI.svelte)

### Pattern Analysis
```typescript
function analyzeLearningData() {
  const data = get(aiLearningData);

  // 선호 회피 방향 예측
  const dodges = data.dodgeDirections;
  const maxDir = Object.entries(dodges)
    .sort((a, b) => b[1] - a[1])[0][0];
  predictedDodgeDirection = maxDir;

  // 방어 성향 분석
  const defenseRatio = data.defensiveActions.parry /
    (data.defensiveActions.guard + 1);
  isParryHeavy = defenseRatio > 0.5;
}
```

### Action Selection
```typescript
useTask((delta) => {
  if (state === 'idle' && distanceToPlayer < detectionRange) {
    state = 'chasing';
  }

  if (state === 'chasing' && distanceToPlayer < attackRange) {
    // DQN 또는 통계 기반 결정
    if (aiLearningEnabled && shouldUseDQN()) {
      const action = dqnAgent.selectAction(currentState);
      executeAction(action);
    } else {
      // 통계 기반 결정
      const strategy = chooseStrategy();
      executeAction(strategy);
    }
  }
});
```

### Boss Level Scaling
```typescript
const predictionAccuracy = Math.min(0.9, 0.3 + bossLevel * 0.15);

function shouldUsePrediction(): boolean {
  return Math.random() < predictionAccuracy;
}
```

## AI Stats Store

```typescript
export const aiStats = writable({
  totalEpisodes: 0,
  explorationRate: 0.5,
  memorySize: 0,
  avgReward: 0,
  winRate: 0
});
```

## Known Issues

### Critical
- DQN과 통계학습이 분리되어 있음 - 통합 필요
- 상태 벡터가 12차원으로 부족 (시간 정보, 시퀀스 없음)

### High Priority
- 학습 데이터 세션 간 미유지 (localStorage 저장 필요)
- `recordMovement()` 함수가 호출되지 않음

### Medium Priority
- 보상 신호 부족 (포지셔닝, 회피 성공 등)
- 예측 정확도 검증/피드백 루프 없음

## Extending the AI

### 새로운 패턴 추가
1. `PlayerAction` 타입에 새 액션 추가
2. `recordAction()` 호출 지점 추가 (PlayerCombat.svelte)
3. `AILearningData`에 분석 필드 추가
4. `EnemyAI.svelte`에서 활용 로직 작성

### 상태 벡터 확장 제안
```typescript
// 추가 권장 차원
- timeSinceLastPlayerAction  // 반응 시간
- playerFacingDirection      // 플레이어 방향
- enemyFacingDirection       // 적 방향
- recentActionSequence[3]    // 최근 3개 액션 시퀀스
- healthDelta                // 체력 변화량
- staminaDelta               // 스태미나 변화량
```
