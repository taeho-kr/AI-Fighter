<script lang="ts">
	import { T, useTask } from '@threlte/core';
	import { RigidBody, Collider } from '@threlte/rapier';

	// 맵 설정
	const ARENA_RADIUS = 10; // 반경 10미터
	const WALL_SEGMENTS = 48; // 충돌체 개수
	const PILLAR_COUNT = 16; // 기둥 개수
	const ARCH_COUNT = 16; // 아치 개수
	const TIER_COUNT = 3; // 관중석 층수

	// 시간 (애니메이션용)
	let time = $state(0);

	useTask((delta) => {
		time += delta;
	});

	// 횃불 위치 계산
	const torchPositions = Array.from({ length: 8 }, (_, i) => {
		const angle = (i / 8) * Math.PI * 2;
		return {
			x: Math.cos(angle) * (ARENA_RADIUS + 1.5),
			z: Math.sin(angle) * (ARENA_RADIUS + 1.5),
			angle
		};
	});

	// 기둥 위치 계산
	const pillarPositions = Array.from({ length: PILLAR_COUNT }, (_, i) => {
		const angle = (i / PILLAR_COUNT) * Math.PI * 2;
		return {
			x: Math.cos(angle) * (ARENA_RADIUS + 2),
			z: Math.sin(angle) * (ARENA_RADIUS + 2),
			angle
		};
	});
</script>

<!-- ========== 바닥 ========== -->
<!-- 바닥 표면이 y=0에 오도록: 콜라이더 중심 y=-0.25, halfHeight=0.25 → 표면 y=0 -->
<RigidBody type="fixed" position={[0, -0.25, 0]}>
	<Collider shape="cylinder" args={[0.25, ARENA_RADIUS]} />

	<!-- 모래 바닥 (높이 0.5, 중심이 콜라이더와 일치) -->
	<T.Mesh receiveShadow>
		<T.CylinderGeometry args={[ARENA_RADIUS, ARENA_RADIUS, 0.5, 64]} />
		<T.MeshStandardMaterial
			color="#c4a574"
			metalness={0.0}
			roughness={0.95}
		/>
	</T.Mesh>
</RigidBody>

<!-- 바닥 디테일: 중앙 원형 마커 -->
<T.Mesh position={[0, 0.02, 0]} rotation.x={-Math.PI / 2}>
	<T.RingGeometry args={[2.5, 2.7, 64]} />
	<T.MeshStandardMaterial color="#8b7355" roughness={0.9} />
</T.Mesh>

<!-- 바닥 디테일: 내부 원 -->
<T.Mesh position={[0, 0.015, 0]} rotation.x={-Math.PI / 2}>
	<T.RingGeometry args={[1.2, 1.35, 64]} />
	<T.MeshStandardMaterial color="#8b7355" roughness={0.9} />
</T.Mesh>

<!-- 바닥 디테일: 방사형 라인 -->
{#each Array(8) as _, i}
	{@const angle = (i / 8) * Math.PI * 2}
	<T.Mesh position={[0, 0.018, 0]} rotation.x={-Math.PI / 2} rotation.z={angle}>
		<T.PlaneGeometry args={[0.15, ARENA_RADIUS * 1.8]} />
		<T.MeshStandardMaterial color="#8b7355" roughness={0.9} />
	</T.Mesh>
{/each}

<!-- 외곽 경계선 (위험 구역) -->
<T.Mesh position={[0, 0.02, 0]} rotation.x={-Math.PI / 2}>
	<T.RingGeometry args={[ARENA_RADIUS - 0.5, ARENA_RADIUS, 64]} />
	<T.MeshStandardMaterial color="#8b4444" opacity={0.6} transparent roughness={0.8} />
</T.Mesh>

<!-- ========== 돌 테두리 ========== -->
<T.Mesh position={[0, 0.25, 0]}>
	<T.TorusGeometry args={[ARENA_RADIUS + 0.3, 0.4, 8, 64]} />
	<T.MeshStandardMaterial color="#7a7a7a" metalness={0.1} roughness={0.7} />
</T.Mesh>

<!-- 내부 장식 테두리 -->
<T.Mesh position={[0, 0.15, 0]}>
	<T.TorusGeometry args={[ARENA_RADIUS + 0.1, 0.15, 6, 64]} />
	<T.MeshStandardMaterial color="#5a5a5a" metalness={0.2} roughness={0.6} />
</T.Mesh>

<!-- ========== 관중석 (3층) ========== -->
{#each Array(TIER_COUNT) as _, tier}
	{@const innerRadius = ARENA_RADIUS + 1 + tier * 3}
	{@const outerRadius = innerRadius + 3}
	{@const tierHeight = 0.5 + tier * 1.5}

	<!-- 층 바닥 (링 형태 - RingGeometry 사용) -->
	<T.Mesh position={[0, tierHeight, 0]} rotation.x={-Math.PI / 2}>
		<T.RingGeometry args={[innerRadius, outerRadius, 64]} />
		<T.MeshStandardMaterial
			color={tier === 0 ? "#6a6a6a" : tier === 1 ? "#5a5a5a" : "#4a4a4a"}
			metalness={0.1}
			roughness={0.8}
			side={2}
		/>
	</T.Mesh>

	<!-- 층 앞면 (수직 벽) -->
	<T.Mesh position={[0, tierHeight + 0.4, 0]}>
		<T.CylinderGeometry args={[innerRadius, innerRadius, 0.8, 64, 1, true]} />
		<T.MeshStandardMaterial
			color="#5a5a5a"
			metalness={0.1}
			roughness={0.7}
		/>
	</T.Mesh>
{/each}

<!-- ========== 기둥 (Pillars) - 낮은 난간 스타일 ========== -->
{#each pillarPositions as pos, i}
	<T.Group position={[pos.x, 0, pos.z]} rotation.y={-pos.angle}>
		<!-- 기둥 베이스 -->
		<T.Mesh position={[0, 0.1, 0]} castShadow>
			<T.BoxGeometry args={[0.5, 0.2, 0.5]} />
			<T.MeshStandardMaterial color="#8a8a8a" roughness={0.6} />
		</T.Mesh>

		<!-- 기둥 몸체 (높이 1.2m - 허리 높이) -->
		<T.Mesh position={[0, 0.8, 0]} castShadow>
			<T.CylinderGeometry args={[0.15, 0.2, 1.2, 8]} />
			<T.MeshStandardMaterial color="#9a9a9a" roughness={0.5} />
		</T.Mesh>

		<!-- 기둥 상단 -->
		<T.Mesh position={[0, 1.5, 0]} castShadow>
			<T.BoxGeometry args={[0.4, 0.2, 0.4]} />
			<T.MeshStandardMaterial color="#a0a0a0" roughness={0.5} />
		</T.Mesh>
	</T.Group>
{/each}

<!-- ========== 난간 연결대 ========== -->
{#each Array(ARCH_COUNT / 2) as _, i}
	{@const angle1 = (i * 2 / ARCH_COUNT) * Math.PI * 2}
	{@const angle2 = ((i * 2 + 1) / ARCH_COUNT) * Math.PI * 2}
	{@const midAngle = (angle1 + angle2) / 2}
	{@const archRadius = ARENA_RADIUS + 2}
	{@const x = Math.cos(midAngle) * archRadius}
	{@const z = Math.sin(midAngle) * archRadius}

	<!-- 기둥 사이 연결대 (난간) -->
	<T.Mesh position={[x, 1.5, z]} rotation.y={-midAngle + Math.PI / 2}>
		<T.BoxGeometry args={[2, 0.15, 0.3]} />
		<T.MeshStandardMaterial color="#7a7a7a" roughness={0.6} />
	</T.Mesh>
{/each}

<!-- ========== 횃불 ========== -->
{#each torchPositions as torch, i}
	<T.Group position={[torch.x, 0, torch.z]}>
		<!-- 횃불대 -->
		<T.Mesh position={[0, 1.5, 0]} castShadow>
			<T.CylinderGeometry args={[0.08, 0.12, 3, 8]} />
			<T.MeshStandardMaterial color="#4a3020" roughness={0.8} />
		</T.Mesh>

		<!-- 횃불 받침 -->
		<T.Mesh position={[0, 3, 0]} castShadow>
			<T.CylinderGeometry args={[0.2, 0.15, 0.4, 8]} />
			<T.MeshStandardMaterial color="#3a2515" roughness={0.7} />
		</T.Mesh>

		<!-- 불꽃 코어 -->
		{@const flicker = Math.sin(time * 8 + i * 1.5) * 0.1 + Math.cos(time * 12 + i) * 0.05}
		<T.Mesh position={[0, 3.4 + flicker, 0]}>
			<T.SphereGeometry args={[0.2 + flicker * 0.3, 8, 8]} />
			<T.MeshBasicMaterial color="#ff6600" />
		</T.Mesh>

		<!-- 불꽃 외부 -->
		<T.Mesh position={[0, 3.5 + flicker, 0]}>
			<T.SphereGeometry args={[0.35 + flicker * 0.2, 8, 8]} />
			<T.MeshBasicMaterial color="#ff4400" transparent opacity={0.6} />
		</T.Mesh>

		<!-- 불꽃 상단 -->
		<T.Mesh position={[0, 3.7 + flicker * 1.5, 0]}>
			<T.ConeGeometry args={[0.15, 0.4 + flicker * 0.3, 6]} />
			<T.MeshBasicMaterial color="#ffaa00" transparent opacity={0.7} />
		</T.Mesh>

		<!-- 횃불 조명 -->
		<T.PointLight
			position={[0, 3.5, 0]}
			intensity={15 + Math.sin(time * 10 + i * 2) * 3}
			color="#ff6633"
			distance={12}
			castShadow
		/>
	</T.Group>
{/each}

<!-- ========== 깃발 (관중석 뒤쪽) ========== -->
{#each [0, Math.PI / 2, Math.PI, Math.PI * 1.5] as angle, i}
	{@const bannerX = Math.cos(angle) * (ARENA_RADIUS + 8)}
	{@const bannerZ = Math.sin(angle) * (ARENA_RADIUS + 8)}
	{@const waveOffset = Math.sin(time * 2 + i) * 0.08}

	<T.Group position={[bannerX, 5, bannerZ]} rotation.y={-angle}>
		<!-- 깃대 -->
		<T.Mesh position={[0, 0, 0]}>
			<T.CylinderGeometry args={[0.05, 0.05, 4, 6]} />
			<T.MeshStandardMaterial color="#4a3020" roughness={0.8} />
		</T.Mesh>
		<!-- 깃발 천 -->
		<T.Mesh position={[0.4, 1.5 + waveOffset, 0]} rotation.z={waveOffset * 0.2}>
			<T.PlaneGeometry args={[0.8, 1.2]} />
			<T.MeshStandardMaterial
				color={i % 2 === 0 ? "#8b0000" : "#000080"}
				roughness={0.8}
				side={2}
			/>
		</T.Mesh>
	</T.Group>
{/each}

<!-- ========== 보이지 않는 벽 충돌체 ========== -->
<RigidBody type="fixed">
	{#each Array(WALL_SEGMENTS) as _, i}
		{@const angle = (i / WALL_SEGMENTS) * Math.PI * 2}
		{@const wallRadius = ARENA_RADIUS + 0.3}
		{@const x = Math.cos(angle) * wallRadius}
		{@const z = Math.sin(angle) * wallRadius}
		<Collider
			shape="cuboid"
			args={[1.5, 3, 0.3]}
			position={[x, 3, z]}
			rotation={[0, -angle + Math.PI / 2, 0]}
		/>
	{/each}
</RigidBody>

<!-- ========== 환경 조명 보조 ========== -->
<!-- 중앙 상단 조명 (태양광 시뮬레이션) -->
<T.PointLight
	position={[0, 15, 0]}
	intensity={20}
	color="#fff5e6"
	distance={40}
/>

<!-- 아레나 테두리 반사광 -->
{#each [0, Math.PI / 2, Math.PI, Math.PI * 1.5] as angle}
	{@const lx = Math.cos(angle) * 8}
	{@const lz = Math.sin(angle) * 8}
	<T.PointLight
		position={[lx, 0.5, lz]}
		intensity={2}
		color="#c4a574"
		distance={6}
	/>
{/each}

<!-- ========== 바닥 장식: 흩어진 모래/자갈 ========== -->
{#each Array(30) as _, i}
	{@const randAngle = (i / 30) * Math.PI * 2 + Math.sin(i * 7) * 0.5}
	{@const randDist = 2 + (i % 7) * 1.1 + Math.cos(i * 3) * 0.5}
	{@const px = Math.cos(randAngle) * randDist}
	{@const pz = Math.sin(randAngle) * randDist}
	{@const pScale = 0.05 + (i % 3) * 0.03}

	<T.Mesh position={[px, 0.02, pz]}>
		<T.SphereGeometry args={[pScale, 4, 4]} />
		<T.MeshStandardMaterial color="#9a8a6a" roughness={1} />
	</T.Mesh>
{/each}
