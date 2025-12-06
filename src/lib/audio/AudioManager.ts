// Audio Manager - 게임 오디오 시스템
import { writable, get } from 'svelte/store';

// 오디오 설정 스토어
export const audioSettings = writable({
	masterVolume: 0.7,
	bgmVolume: 0.5,
	sfxVolume: 0.8,
	muted: false
});

// 오디오 컨텍스트 및 노드
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let sfxGain: GainNode | null = null;

// 현재 재생 중인 BGM
let currentBGM: AudioBufferSourceNode | null = null;
let currentBGMBuffer: AudioBuffer | null = null;

// SFX 버퍼 캐시
const sfxBuffers: Map<string, AudioBuffer> = new Map();

// SFX 정의 (Web Audio API로 생성)
export type SFXType =
	| 'player_attack_light'
	| 'player_attack_heavy'
	| 'player_dodge'
	| 'player_guard'
	| 'player_parry'
	| 'player_hit'
	| 'player_death'
	| 'enemy_attack'
	| 'enemy_hit'
	| 'enemy_death'
	| 'enemy_stunned'
	| 'round_start'
	| 'victory'
	| 'defeat'
	| 'ui_hover'
	| 'ui_click'
	| 'stamina_low'
	| 'charge_start'
	| 'charge_ready';

// 오디오 컨텍스트 초기화
export async function initAudio(): Promise<void> {
	if (audioContext) return;

	try {
		audioContext = new AudioContext();

		// 마스터 게인 노드
		masterGain = audioContext.createGain();
		masterGain.connect(audioContext.destination);

		// BGM 게인 노드
		bgmGain = audioContext.createGain();
		bgmGain.connect(masterGain);

		// SFX 게인 노드
		sfxGain = audioContext.createGain();
		sfxGain.connect(masterGain);

		// 초기 볼륨 설정
		updateVolumes();

		// SFX 버퍼 사전 생성
		await generateAllSFX();

		console.log('Audio system initialized');
	} catch (error) {
		console.error('Failed to initialize audio:', error);
	}
}

// 볼륨 업데이트
function updateVolumes() {
	const settings = get(audioSettings);

	if (masterGain) {
		masterGain.gain.value = settings.muted ? 0 : settings.masterVolume;
	}
	if (bgmGain) {
		bgmGain.gain.value = settings.bgmVolume;
	}
	if (sfxGain) {
		sfxGain.gain.value = settings.sfxVolume;
	}
}

// 설정 변경 구독
audioSettings.subscribe(() => {
	updateVolumes();
});

// 프로시저럴 사운드 생성 함수들
function createOscillatorSound(
	frequency: number,
	duration: number,
	type: OscillatorType = 'sine',
	attack: number = 0.01,
	decay: number = 0.1,
	sustain: number = 0.3,
	release: number = 0.2
): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	const attackSamples = Math.floor(attack * sampleRate);
	const decaySamples = Math.floor(decay * sampleRate);
	const releaseSamples = Math.floor(release * sampleRate);
	const sustainSamples = length - attackSamples - decaySamples - releaseSamples;

	for (let i = 0; i < length; i++) {
		const t = i / sampleRate;
		let envelope = 0;

		if (i < attackSamples) {
			envelope = i / attackSamples;
		} else if (i < attackSamples + decaySamples) {
			const decayProgress = (i - attackSamples) / decaySamples;
			envelope = 1 - (1 - sustain) * decayProgress;
		} else if (i < attackSamples + decaySamples + sustainSamples) {
			envelope = sustain;
		} else {
			const releaseProgress = (i - attackSamples - decaySamples - sustainSamples) / releaseSamples;
			envelope = sustain * (1 - releaseProgress);
		}

		let wave = 0;
		switch (type) {
			case 'sine':
				wave = Math.sin(2 * Math.PI * frequency * t);
				break;
			case 'square':
				wave = Math.sign(Math.sin(2 * Math.PI * frequency * t));
				break;
			case 'sawtooth':
				wave = 2 * ((frequency * t) % 1) - 1;
				break;
			case 'triangle':
				wave = 4 * Math.abs(((frequency * t) % 1) - 0.5) - 1;
				break;
		}

		data[i] = wave * envelope * 0.5;
	}

	return buffer;
}

// 노이즈 사운드 생성 (향후 확장용)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createNoiseSound(duration: number, decay: number = 0.5): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	for (let i = 0; i < length; i++) {
		const envelope = Math.pow(1 - i / length, decay);
		data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
	}

	return buffer;
}
void createNoiseSound; // 사용하지 않는 함수를 명시적으로 유지

function createImpactSound(frequency: number, duration: number): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	for (let i = 0; i < length; i++) {
		const t = i / sampleRate;
		const envelope = Math.exp(-t * 10);
		const freqDecay = frequency * Math.exp(-t * 5);
		const wave = Math.sin(2 * Math.PI * freqDecay * t);
		const noise = (Math.random() * 2 - 1) * 0.2;
		data[i] = (wave * 0.8 + noise) * envelope * 0.5;
	}

	return buffer;
}

function createSwooshSound(duration: number): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	for (let i = 0; i < length; i++) {
		const t = i / length;
		// 필터링된 노이즈로 스우시 효과
		const noise = Math.random() * 2 - 1;
		const envelope = Math.sin(Math.PI * t);
		const highPass = t < 0.3 ? t / 0.3 : 1;
		data[i] = noise * envelope * highPass * 0.3;
	}

	// 간단한 로우패스 필터 적용
	for (let i = 1; i < length - 1; i++) {
		data[i] = (data[i - 1] + data[i] + data[i + 1]) / 3;
	}

	return buffer;
}

function createMetallicSound(frequency: number, duration: number): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	const harmonics = [1, 2.4, 3.7, 5.1, 6.8];
	const amplitudes = [1, 0.5, 0.25, 0.125, 0.0625];

	for (let i = 0; i < length; i++) {
		const t = i / sampleRate;
		const envelope = Math.exp(-t * 8);

		let wave = 0;
		for (let h = 0; h < harmonics.length; h++) {
			wave += Math.sin(2 * Math.PI * frequency * harmonics[h] * t) * amplitudes[h];
		}

		data[i] = wave * envelope * 0.3;
	}

	return buffer;
}

function createChargingSound(duration: number): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	for (let i = 0; i < length; i++) {
		const t = i / length;
		const frequency = 200 + t * 400; // 주파수 상승
		const wave = Math.sin(2 * Math.PI * frequency * (i / sampleRate));
		const tremolo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 8 * t);
		data[i] = wave * t * tremolo * 0.4;
	}

	return buffer;
}

function createVictorySound(): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const duration = 1.5;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	// 승리 팡파레 (상승 아르페지오)
	const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
	const noteDuration = duration / notes.length;

	for (let n = 0; n < notes.length; n++) {
		const noteStart = Math.floor(n * noteDuration * sampleRate);
		const noteEnd = Math.floor((n + 1) * noteDuration * sampleRate);

		for (let i = noteStart; i < noteEnd && i < length; i++) {
			const t = (i - noteStart) / sampleRate;
			const localT = (i - noteStart) / (noteEnd - noteStart);
			const envelope = Math.sin(Math.PI * localT);
			const wave = Math.sin(2 * Math.PI * notes[n] * t);
			const harmonic = Math.sin(2 * Math.PI * notes[n] * 2 * t) * 0.3;
			data[i] = (wave + harmonic) * envelope * 0.4;
		}
	}

	return buffer;
}

function createDefeatSound(): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const duration = 1.2;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	// 하강 음계
	for (let i = 0; i < length; i++) {
		const t = i / sampleRate;
		const progress = i / length;
		const frequency = 400 * Math.pow(0.5, progress * 2); // 주파수 하강
		const envelope = 1 - progress;
		const wave = Math.sin(2 * Math.PI * frequency * t);
		const distortion = Math.sin(2 * Math.PI * frequency * 0.5 * t) * 0.2;
		data[i] = (wave + distortion) * envelope * 0.4;
	}

	return buffer;
}

function createUIClickSound(): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const duration = 0.05;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	for (let i = 0; i < length; i++) {
		const t = i / sampleRate;
		const envelope = Math.exp(-t * 100);
		data[i] = Math.sin(2 * Math.PI * 800 * t) * envelope * 0.3;
	}

	return buffer;
}

function createUIHoverSound(): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const duration = 0.03;
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(1, length, sampleRate);
	const data = buffer.getChannelData(0);

	for (let i = 0; i < length; i++) {
		const t = i / sampleRate;
		const envelope = Math.exp(-t * 150);
		data[i] = Math.sin(2 * Math.PI * 600 * t) * envelope * 0.15;
	}

	return buffer;
}

// 모든 SFX 버퍼 생성
async function generateAllSFX(): Promise<void> {
	if (!audioContext) return;

	// 플레이어 사운드
	sfxBuffers.set('player_attack_light', createSwooshSound(0.15));
	sfxBuffers.set('player_attack_heavy', createSwooshSound(0.3));
	sfxBuffers.set('player_dodge', createSwooshSound(0.2));
	sfxBuffers.set('player_guard', createMetallicSound(300, 0.2));
	sfxBuffers.set('player_parry', createMetallicSound(500, 0.3));
	sfxBuffers.set('player_hit', createImpactSound(150, 0.3));
	sfxBuffers.set('player_death', createDefeatSound());

	// 적 사운드
	sfxBuffers.set('enemy_attack', createSwooshSound(0.25));
	sfxBuffers.set('enemy_hit', createImpactSound(200, 0.25));
	sfxBuffers.set('enemy_death', createImpactSound(100, 0.5));
	sfxBuffers.set('enemy_stunned', createOscillatorSound(300, 0.5, 'sine', 0.01, 0.1, 0.2, 0.3));

	// 게임 이벤트
	sfxBuffers.set('round_start', createOscillatorSound(440, 0.5, 'sine', 0.1, 0.1, 0.5, 0.2));
	sfxBuffers.set('victory', createVictorySound());
	sfxBuffers.set('defeat', createDefeatSound());

	// UI 사운드
	sfxBuffers.set('ui_click', createUIClickSound());
	sfxBuffers.set('ui_hover', createUIHoverSound());

	// 기타
	sfxBuffers.set('stamina_low', createOscillatorSound(200, 0.3, 'triangle', 0.01, 0.05, 0.3, 0.15));
	sfxBuffers.set('charge_start', createChargingSound(0.5));
	sfxBuffers.set('charge_ready', createOscillatorSound(600, 0.2, 'sine', 0.01, 0.05, 0.5, 0.1));
}

// SFX 재생
export function playSFX(type: SFXType, volume: number = 1): void {
	if (!audioContext || !sfxGain) return;

	const buffer = sfxBuffers.get(type);
	if (!buffer) {
		console.warn(`SFX not found: ${type}`);
		return;
	}

	// suspended 상태면 resume
	if (audioContext.state === 'suspended') {
		audioContext.resume();
	}

	const source = audioContext.createBufferSource();
	source.buffer = buffer;

	// 개별 볼륨 조절을 위한 게인 노드
	const gainNode = audioContext.createGain();
	gainNode.gain.value = volume;

	source.connect(gainNode);
	gainNode.connect(sfxGain);

	source.start();
}

// BGM 생성 (프로시저럴)
function generateBGM(): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const duration = 16; // 16초 루프
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(2, length, sampleRate); // 스테레오
	const leftChannel = buffer.getChannelData(0);
	const rightChannel = buffer.getChannelData(1);

	// 베이스 라인 (저음)
	const bassNotes = [65.41, 73.42, 82.41, 87.31]; // C2, D2, E2, F2
	const bassPattern = [0, 0, 1, 1, 2, 2, 3, 2, 1, 0, 0, 1, 2, 3, 2, 1];
	const beatDuration = duration / bassPattern.length;

	for (let i = 0; i < length; i++) {
		const t = i / sampleRate;
		const beatIndex = Math.floor((t % duration) / beatDuration);
		const bassNote = bassNotes[bassPattern[beatIndex]];

		// 베이스 (양쪽 동일)
		const bass = Math.sin(2 * Math.PI * bassNote * t) * 0.15;

		// 패드 (스테레오 분리)
		const padFreq = bassNote * 2;
		const padL = Math.sin(2 * Math.PI * padFreq * t + 0.1) * 0.05;
		const padR = Math.sin(2 * Math.PI * padFreq * t - 0.1) * 0.05;

		// 아르페지오
		const arpTime = (t * 4) % 1;
		const arpNote = bassNote * (2 + Math.floor(arpTime * 4));
		const arpEnv = Math.exp(-arpTime * 5);
		const arp = Math.sin(2 * Math.PI * arpNote * t) * arpEnv * 0.08;

		// 드럼 비트 (킥)
		const kickTime = t % (beatDuration * 2);
		const kick = kickTime < 0.1 ? Math.sin(2 * Math.PI * 60 * kickTime) * Math.exp(-kickTime * 30) * 0.2 : 0;

		// 하이햇
		const hihatTime = (t + beatDuration / 2) % beatDuration;
		const hihat = hihatTime < 0.02 ? (Math.random() * 2 - 1) * Math.exp(-hihatTime * 100) * 0.1 : 0;

		leftChannel[i] = bass + padL + arp * 0.8 + kick + hihat;
		rightChannel[i] = bass + padR + arp * 1.2 + kick + hihat;
	}

	// 페이드 인/아웃 적용 (크로스페이드용)
	const fadeSamples = Math.floor(0.1 * sampleRate);
	for (let i = 0; i < fadeSamples; i++) {
		const fade = i / fadeSamples;
		leftChannel[i] *= fade;
		rightChannel[i] *= fade;
		leftChannel[length - 1 - i] *= fade;
		rightChannel[length - 1 - i] *= fade;
	}

	return buffer;
}

// 전투 BGM 생성 (더 긴박한 버전)
function generateBattleBGM(): AudioBuffer {
	if (!audioContext) throw new Error('Audio context not initialized');

	const sampleRate = audioContext.sampleRate;
	const duration = 8; // 8초 루프 (더 빠른 템포)
	const length = Math.ceil(duration * sampleRate);
	const buffer = audioContext.createBuffer(2, length, sampleRate);
	const leftChannel = buffer.getChannelData(0);
	const rightChannel = buffer.getChannelData(1);

	const bassNotes = [55, 61.74, 73.42, 65.41]; // A1, B1, D2, C2 - 더 어두운 느낌
	const bpm = 140;
	const beatDuration = 60 / bpm;

	for (let i = 0; i < length; i++) {
		const t = i / sampleRate;
		const beat = Math.floor(t / beatDuration) % 16;
		const bassIndex = Math.floor(beat / 4) % bassNotes.length;
		const bassNote = bassNotes[bassIndex];

		// 강렬한 베이스
		const bass = Math.sin(2 * Math.PI * bassNote * t) * 0.2;
		const bassSub = Math.sin(2 * Math.PI * bassNote * 0.5 * t) * 0.1;

		// 긴장감 있는 스트링 패드
		const pad1 = Math.sin(2 * Math.PI * bassNote * 3 * t) * 0.04;
		const pad2 = Math.sin(2 * Math.PI * bassNote * 4 * t) * 0.03;
		const tremolo = 0.7 + 0.3 * Math.sin(2 * Math.PI * 6 * t);

		// 강한 킥
		const kickTime = t % beatDuration;
		const kick = kickTime < 0.08 ? Math.sin(2 * Math.PI * 50 * kickTime) * Math.exp(-kickTime * 40) * 0.25 : 0;

		// 스네어 (2, 4박)
		const snareTime = (t + beatDuration * 2) % (beatDuration * 4);
		const snare = snareTime < 0.05 ? (Math.random() * 2 - 1) * Math.exp(-snareTime * 60) * 0.15 : 0;

		// 빠른 하이햇
		const hihatTime = t % (beatDuration / 2);
		const hihat = hihatTime < 0.01 ? (Math.random() * 2 - 1) * Math.exp(-hihatTime * 200) * 0.08 : 0;

		const total = bass + bassSub + (pad1 + pad2) * tremolo + kick + snare + hihat;
		leftChannel[i] = total * 0.9;
		rightChannel[i] = total * 1.1;
	}

	// 페이드
	const fadeSamples = Math.floor(0.05 * sampleRate);
	for (let i = 0; i < fadeSamples; i++) {
		const fade = i / fadeSamples;
		leftChannel[i] *= fade;
		rightChannel[i] *= fade;
		leftChannel[length - 1 - i] *= fade;
		rightChannel[length - 1 - i] *= fade;
	}

	return buffer;
}

// BGM 재생
export function playBGM(type: 'menu' | 'battle' = 'battle'): void {
	if (!audioContext || !bgmGain) return;

	// 기존 BGM 중지
	stopBGM();

	// suspended 상태면 resume
	if (audioContext.state === 'suspended') {
		audioContext.resume();
	}

	// BGM 버퍼 생성
	currentBGMBuffer = type === 'menu' ? generateBGM() : generateBattleBGM();

	// 소스 노드 생성 및 재생
	currentBGM = audioContext.createBufferSource();
	currentBGM.buffer = currentBGMBuffer;
	currentBGM.loop = true;
	currentBGM.connect(bgmGain);
	currentBGM.start();
}

// BGM 중지
export function stopBGM(): void {
	if (currentBGM) {
		try {
			currentBGM.stop();
		} catch (e) {
			// 이미 중지된 경우 무시
		}
		currentBGM = null;
	}
}

// BGM 페이드 아웃
export function fadeOutBGM(duration: number = 1): Promise<void> {
	return new Promise((resolve) => {
		if (!bgmGain || !currentBGM) {
			resolve();
			return;
		}

		const startVolume = bgmGain.gain.value;
		const startTime = Date.now();

		function fade() {
			const elapsed = (Date.now() - startTime) / 1000;
			const progress = Math.min(elapsed / duration, 1);

			if (bgmGain) {
				bgmGain.gain.value = startVolume * (1 - progress);
			}

			if (progress < 1) {
				requestAnimationFrame(fade);
			} else {
				stopBGM();
				if (bgmGain) {
					bgmGain.gain.value = startVolume;
				}
				resolve();
			}
		}

		fade();
	});
}

// 볼륨 설정 함수들
export function setMasterVolume(volume: number): void {
	audioSettings.update(s => ({ ...s, masterVolume: Math.max(0, Math.min(1, volume)) }));
}

export function setBGMVolume(volume: number): void {
	audioSettings.update(s => ({ ...s, bgmVolume: Math.max(0, Math.min(1, volume)) }));
}

export function setSFXVolume(volume: number): void {
	audioSettings.update(s => ({ ...s, sfxVolume: Math.max(0, Math.min(1, volume)) }));
}

export function toggleMute(): void {
	audioSettings.update(s => ({ ...s, muted: !s.muted }));
}

// 오디오 컨텍스트 resume (사용자 상호작용 후 호출 필요)
export function resumeAudioContext(): void {
	if (audioContext && audioContext.state === 'suspended') {
		audioContext.resume();
	}
}
