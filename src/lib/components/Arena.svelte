<script lang="ts">
	import { T } from '@threlte/core';
	import { RigidBody, Collider } from '@threlte/rapier';
</script>

<!-- 바닥 평면 -->
<RigidBody type="fixed">
	<Collider shape="cuboid" args={[25, 0.5, 25]} />
	<T.Mesh position={[0, -0.5, 0]} receiveShadow>
		<T.CylinderGeometry args={[25, 25, 1, 64]} />
		<T.MeshStandardMaterial color="#1a1a2e" metalness={0.1} roughness={0.9} />
	</T.Mesh>
</RigidBody>

<!-- 콜로세움 벽 (물리 충돌용) -->
<RigidBody type="fixed">
	<!-- 원형 벽 충돌체 (여러 개의 박스로 근사) -->
	{#each Array(32) as _, i}
		{@const angle = (i / 32) * Math.PI * 2}
		{@const x = Math.cos(angle) * 24}
		{@const z = Math.sin(angle) * 24}
		<Collider
			shape="cuboid"
			args={[2.5, 5, 0.5]}
			position={[x, 5, z]}
			rotation={[0, -angle + Math.PI / 2, 0]}
		/>
	{/each}
</RigidBody>

<!-- 콜로세움 벽 (시각용) -->
<T.Mesh position={[0, 5, 0]}>
	<T.CylinderGeometry args={[24, 24, 10, 64, 1, true]} />
	<T.MeshStandardMaterial color="#2a2a3e" metalness={0.2} roughness={0.8} side={2} />
</T.Mesh>

<!-- 벽 상단 테두리 -->
<T.Mesh position={[0, 10, 0]}>
	<T.TorusGeometry args={[24.5, 0.5, 8, 64]} />
	<T.MeshStandardMaterial color="#3a3a4e" metalness={0.3} roughness={0.7} />
</T.Mesh>

<!-- 중앙 광원 -->
<T.PointLight
	position={[0, 8, 0]}
	intensity={50}
	color="#ffe4c4"
	distance={50}
	castShadow
/>

<!-- 바닥 중앙 표시 -->
<T.Mesh position={[0, 0.01, 0]} rotation.x={-Math.PI / 2}>
	<T.RingGeometry args={[4, 4.2, 64]} />
	<T.MeshBasicMaterial color="#3a3a5e" />
</T.Mesh>
