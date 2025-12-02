<script lang="ts">
	import { T } from '@threlte/core';
	import { RigidBody, Collider } from '@threlte/rapier';
</script>

<!-- 바닥 평면 -->
<RigidBody type="fixed">
	<Collider shape="cuboid" args={[50, 0.5, 50]} />
	<T.Mesh position={[0, -0.5, 0]} receiveShadow>
		<T.BoxGeometry args={[100, 1, 100]} />
		<T.MeshStandardMaterial color="#1a1a2e" />
	</T.Mesh>
</RigidBody>

<!-- 그리드 라인 (시각적 참조용) -->
<T.GridHelper args={[100, 50, '#333', '#222']} position={[0, 0.01, 0]} />
