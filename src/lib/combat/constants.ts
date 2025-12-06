// Combat Constants - 캐릭터 비례 기반 전투 상수
// 모든 수치는 캐릭터 높이(CHARACTER_HEIGHT)를 기준으로 계산됨

// === 캐릭터 기본 치수 ===
export const CHARACTER_HEIGHT = 1.8;        // 캐릭터 키 (미터)
export const CHARACTER_RADIUS = 0.4;        // 캐릭터 몸통 반경
export const CAPSULE_HALF_HEIGHT = 0.5;     // 캡슐 콜라이더 반높이

// === 무기 치수 (캐릭터 키 비례) ===
export const ARM_LENGTH = CHARACTER_HEIGHT * 0.38;      // 팔 길이 (약 68cm)
export const SWORD_LENGTH = CHARACTER_HEIGHT * 0.56;    // 검 길이 (약 100cm, 롱소드)
export const SWORD_REACH = ARM_LENGTH + SWORD_LENGTH;   // 무기 도달 거리 (약 168cm)

// === 공격 사거리 ===
// 두 캐릭터가 서로 공격할 때:
// 내 반경(0.4) + 무기 도달(1.68) + 약간의 여유(0.3) + 적 반경(0.4) = 약 2.78
// 게임플레이를 위해 더 넉넉하게 설정

// 기본 공격 사거리 (두 캐릭터 중심 간 거리)
export const MELEE_ATTACK_RANGE = CHARACTER_HEIGHT * 1.8;  // 약 3.24m (넉넉한 근접 공격)
export const LIGHT_ATTACK_RANGE = MELEE_ATTACK_RANGE;      // 약공격 사거리
export const HEAVY_ATTACK_RANGE = MELEE_ATTACK_RANGE * 1.1; // 강공격은 약간 더 김 (약 3.56m)

// 추격 시작 거리 (이 거리 이상이면 추격)
export const CHASE_START_DISTANCE = MELEE_ATTACK_RANGE * 1.2;  // 약 3.89m

// 후퇴 거리 (안전 거리)
export const RETREAT_DISTANCE = MELEE_ATTACK_RANGE * 1.5;      // 약 4.86m

// === AI 인식 거리 ===
export const AI_DETECTION_RANGE = CHARACTER_HEIGHT * 6;    // 감지 거리 (약 10.8m)
export const AI_CLOSE_RANGE = CHARACTER_HEIGHT * 1.7;      // 근접 거리 (약 3m)
export const AI_MID_RANGE = CHARACTER_HEIGHT * 3.3;        // 중거리 (약 6m)

// === 이동 속도 (캐릭터 키 비례) ===
export const PLAYER_WALK_SPEED = CHARACTER_HEIGHT * 3.3;    // 걷기 (약 6m/s)
export const PLAYER_DODGE_SPEED = CHARACTER_HEIGHT * 8.3;   // 회피 (약 15m/s)
export const ENEMY_BASE_SPEED = CHARACTER_HEIGHT * 1.67;    // 적 기본 속도 (약 3m/s)

// === 데미지 ===
export const LIGHT_ATTACK_DAMAGE = 10;
export const HEAVY_ATTACK_DAMAGE = 25;

// === 스태미나 ===
export const MAX_STAMINA = 100;
export const STAMINA_REGEN_RATE = 2;  // 100ms당
export const STAMINA_COST = {
	lightAttack: 10,
	heavyAttack: 25,
	dodge: 20,
	guard: 5,  // per second
	parry: 15
};

// === 쿨다운 (밀리초) ===
export const COOLDOWN = {
	lightAttack: 500,
	heavyAttack: 1000,
	dodge: 600,
	guard: 300,
	parry: 300  // 패링 윈도우
};

// === 아레나 ===
export const ARENA_RADIUS = 9.5;

// === 유틸리티 함수 ===

/**
 * 두 위치 간 거리가 공격 범위 내인지 확인
 */
export function isInAttackRange(
	distance: number,
	attackType: 'light' | 'heavy' = 'light'
): boolean {
	const range = attackType === 'heavy' ? HEAVY_ATTACK_RANGE : LIGHT_ATTACK_RANGE;
	return distance <= range;
}

/**
 * 두 위치 간 거리가 근접 범위인지 확인
 */
export function isInMeleeRange(distance: number): boolean {
	return distance <= MELEE_ATTACK_RANGE;
}

/**
 * 거리 카테고리 반환
 */
export function getDistanceCategory(distance: number): 'close' | 'mid' | 'far' {
	if (distance <= AI_CLOSE_RANGE) return 'close';
	if (distance <= AI_MID_RANGE) return 'mid';
	return 'far';
}

// 디버그용 출력
if (typeof window !== 'undefined') {
	console.log('[Combat Constants]');
	console.log(`  Character Height: ${CHARACTER_HEIGHT}m`);
	console.log(`  Arm Length: ${ARM_LENGTH.toFixed(2)}m`);
	console.log(`  Sword Length: ${SWORD_LENGTH.toFixed(2)}m`);
	console.log(`  Total Reach: ${SWORD_REACH.toFixed(2)}m`);
	console.log(`  Attack Range: ${MELEE_ATTACK_RANGE.toFixed(2)}m`);
	console.log(`  Heavy Attack Range: ${HEAVY_ATTACK_RANGE.toFixed(2)}m`);
}
