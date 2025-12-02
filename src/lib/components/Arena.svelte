<script lang="ts">
	import { T } from '@threlte/core';
	import { RigidBody, Collider } from '@threlte/rapier';
</script>

<!-- 아레나 바닥 -->
<RigidBody type="fixed">
	<Collider shape="cuboid" args={[15, 0.5, 15]} />
	<T.Mesh position={[0, -0.5, 0]} receiveShadow>
		<T.BoxGeometry args={[30, 1, 30]} />
		<T.MeshStandardMaterial color="#1a1a2e" />
	</T.Mesh>
</RigidBody>

<!-- 아레나 테두리 (벽) -->
{#each [
	{ pos: [0, 2, -15], size: [30, 4, 1] },
	{ pos: [0, 2, 15], size: [30, 4, 1] },
	{ pos: [-15, 2, 0], size: [1, 4, 30] },
	{ pos: [15, 2, 0], size: [1, 4, 30] }
] as wall}
	<RigidBody type="fixed" position={wall.pos}>
		<Collider shape="cuboid" args={[wall.size[0]/2, wall.size[1]/2, wall.size[2]/2]} />
		<T.Mesh castShadow receiveShadow>
			<T.BoxGeometry args={wall.size} />
			<T.MeshStandardMaterial color="#16213e" transparent opacity={0.3} />
		</T.Mesh>
	</RigidBody>
{/each}

<!-- 아레나 바닥 장식 (원형 링) -->
<T.Mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
	<T.RingGeometry args={[8, 10, 64]} />
	<T.MeshStandardMaterial color="#e94560" emissive="#e94560" emissiveIntensity={0.3} />
</T.Mesh>

<T.Mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
	<T.RingGeometry args={[4, 5, 64]} />
	<T.MeshStandardMaterial color="#0f3460" emissive="#0f3460" emissiveIntensity={0.2} />
</T.Mesh>

<!-- 아레나 조명 기둥 -->
{#each [
	[-12, 0, -12],
	[12, 0, -12],
	[-12, 0, 12],
	[12, 0, 12]
] as pillarPos}
	<RigidBody type="fixed" position={pillarPos}>
		<Collider shape="cylinder" args={[3, 0.8]} />
		<T.Mesh castShadow>
			<T.CylinderGeometry args={[0.8, 1, 6, 8]} />
			<T.MeshStandardMaterial color="#0f3460" />
		</T.Mesh>
	</RigidBody>
	<T.PointLight position={[pillarPos[0], 4, pillarPos[2]]} intensity={20} color="#e94560" distance={15} />
{/each}
