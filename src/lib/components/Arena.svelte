<script lang="ts">
	import { T } from '@threlte/core';
	import { RigidBody, Collider } from '@threlte/rapier';

	const ARENA_RADIUS = 10;
</script>

<!-- 바닥 -->
<RigidBody type="fixed" position={[0, -0.25, 0]}>
	<Collider shape="cylinder" args={[0.25, ARENA_RADIUS]} />
	<T.Mesh receiveShadow>
		<T.CylinderGeometry args={[ARENA_RADIUS, ARENA_RADIUS, 0.5, 32]} />
		<T.MeshStandardMaterial color="#c4a574" roughness={0.9} />
	</T.Mesh>
</RigidBody>

<!-- 중앙 마커 -->
<T.Mesh position={[0, 0.01, 0]} rotation.x={-Math.PI / 2}>
	<T.RingGeometry args={[2.5, 2.7, 32]} />
	<T.MeshStandardMaterial color="#8b7355" roughness={0.9} />
</T.Mesh>

<!-- 외곽 경계선 -->
<T.Mesh position={[0, 0.01, 0]} rotation.x={-Math.PI / 2}>
	<T.RingGeometry args={[ARENA_RADIUS - 0.3, ARENA_RADIUS, 32]} />
	<T.MeshStandardMaterial color="#8b4444" roughness={0.8} />
</T.Mesh>

<!-- 보이지 않는 벽 (원형) -->
<RigidBody type="fixed">
	<Collider
		shape="cylinder"
		args={[5, ARENA_RADIUS + 0.5]}
		position={[0, 5, 0]}
		sensor={false}
	/>
</RigidBody>

<!-- 실제 벽 충돌 (내부에서 밖으로 못 나가게) -->
{#each Array(8) as _, i}
	{@const angle = (i / 8) * Math.PI * 2}
	{@const x = Math.cos(angle) * (ARENA_RADIUS + 0.3)}
	{@const z = Math.sin(angle) * (ARENA_RADIUS + 0.3)}
	<RigidBody type="fixed" position={[x, 2, z]} rotation={[0, -angle, 0]}>
		<Collider shape="cuboid" args={[4, 2, 0.3]} />
	</RigidBody>
{/each}
