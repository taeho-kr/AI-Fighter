import * as THREE from 'three';

// 텍스처 캐시 (싱글톤)
const textureCache = new Map<string, THREE.CanvasTexture>();

// 단색 텍스처 생성 (심플)
function createSimpleTexture(baseColor: string): THREE.CanvasTexture {
	const cacheKey = `simple_${baseColor}`;
	if (textureCache.has(cacheKey)) {
		return textureCache.get(cacheKey)!;
	}

	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 64;
	const ctx = canvas.getContext('2d')!;

	ctx.fillStyle = baseColor;
	ctx.fillRect(0, 0, 64, 64);

	// 미세한 노이즈만
	for (let i = 0; i < 30; i++) {
		const x = Math.random() * 64;
		const y = Math.random() * 64;
		const alpha = Math.random() * 0.05;
		ctx.fillStyle = `rgba(255,255,255,${alpha})`;
		ctx.fillRect(x, y, 2, 2);
	}

	const texture = new THREE.CanvasTexture(canvas);
	textureCache.set(cacheKey, texture);
	return texture;
}

// 심플 노말맵
function createSimpleNormalMap(): THREE.CanvasTexture {
	const cacheKey = 'simpleNormal';
	if (textureCache.has(cacheKey)) {
		return textureCache.get(cacheKey)!;
	}

	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 64;
	const ctx = canvas.getContext('2d')!;

	// 기본 노말 (파란색)
	ctx.fillStyle = '#8080ff';
	ctx.fillRect(0, 0, 64, 64);

	const texture = new THREE.CanvasTexture(canvas);
	textureCache.set(cacheKey, texture);
	return texture;
}

// 심플 러프니스맵
function createSimpleRoughnessMap(): THREE.CanvasTexture {
	const cacheKey = 'simpleRoughness';
	if (textureCache.has(cacheKey)) {
		return textureCache.get(cacheKey)!;
	}

	const canvas = document.createElement('canvas');
	canvas.width = 64;
	canvas.height = 64;
	const ctx = canvas.getContext('2d')!;

	ctx.fillStyle = '#888888';
	ctx.fillRect(0, 0, 64, 64);

	const texture = new THREE.CanvasTexture(canvas);
	textureCache.set(cacheKey, texture);
	return texture;
}

// 검 블레이드 텍스처
function createBladeTexture(): THREE.CanvasTexture {
	const cacheKey = 'blade';
	if (textureCache.has(cacheKey)) {
		return textureCache.get(cacheKey)!;
	}

	const canvas = document.createElement('canvas');
	canvas.width = 32;
	canvas.height = 64;
	const ctx = canvas.getContext('2d')!;

	const gradient = ctx.createLinearGradient(0, 0, 32, 0);
	gradient.addColorStop(0, '#aaaaaa');
	gradient.addColorStop(0.5, '#ffffff');
	gradient.addColorStop(1, '#aaaaaa');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 32, 64);

	const texture = new THREE.CanvasTexture(canvas);
	textureCache.set(cacheKey, texture);
	return texture;
}

export function getSharedTextures(color: string, accentColor: string) {
	return {
		bodyTexture: createSimpleTexture(color),
		accentTexture: createSimpleTexture(accentColor),
		armorNormalMap: createSimpleNormalMap(),
		metalRoughnessMap: createSimpleRoughnessMap(),
		bladeTexture: createBladeTexture()
	};
}
