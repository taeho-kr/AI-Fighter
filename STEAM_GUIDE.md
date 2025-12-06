# Steam Upload Guide - AI Fighter

## 1. Steam 개발자 계정 설정

### Steamworks 계정 생성
1. https://partner.steamgames.com/ 접속
2. Steam 계정으로 로그인
3. 개발자 등록비 $100 USD 지불
4. 세금 정보 및 은행 정보 입력

### 앱 생성
1. Steamworks 대시보드에서 "App Admin" 메뉴 선택
2. "Create new app" 클릭
3. 앱 이름: "AI Fighter"
4. 앱 유형: "Game"
5. 생성된 App ID를 `steam_appid.txt`에 입력

## 2. 빌드 설정

### steamworks.js 설치 (선택사항)
```bash
npm install steamworks.js
```

### 빌드 생성
```bash
# Windows 빌드
npm run build:win

# macOS 빌드
npm run build:mac

# Linux 빌드
npm run build:linux
```

빌드 결과물은 `release/` 디렉토리에 생성됩니다.

## 3. Steamworks 콘솔 설정

### 기본 정보
- **앱 이름**: AI Fighter
- **개발사**: [Your Studio Name]
- **퍼블리셔**: [Your Publisher Name]
- **출시일**: [Release Date]

### 스토어 페이지 정보

#### 짧은 설명 (Short Description)
```
Fight against an AI that learns and adapts to your combat style. Every battle makes your opponent smarter. Can you stay unpredictable?
```

#### 상세 설명 (About This Game)
```
AI Fighter는 딥러닝 기반 적응형 전투 게임입니다.

🧠 학습하는 AI
- DQN(Deep Q-Network) 기반 인공지능
- 플레이어의 공격 패턴 실시간 분석
- 회피 방향, 방어 성향, 거리 선호도 학습
- 라운드마다 더 강해지고 똑똑해지는 보스

⚔️ 깊이 있는 전투 시스템
- 약공격 / 강공격 시스템
- 가드 및 패링 메카닉
- 무적 프레임이 있는 회피
- 스태미나 관리

🎮 특징
- 반복 플레이마다 다른 경험
- 프로시저럴 생성 음악 및 사운드
- 부드러운 3D 그래픽
- 간편한 조작법

당신의 전투 스타일을 분석하고 약점을 파고드는 AI를 상대로 살아남으세요!
```

#### 시스템 요구사항

**최소 사양:**
- OS: Windows 10 64-bit
- Processor: Intel Core i5-4460 / AMD Ryzen 3 1200
- Memory: 8 GB RAM
- Graphics: NVIDIA GTX 960 / AMD R9 280
- DirectX: Version 11
- Storage: 500 MB available space

**권장 사양:**
- OS: Windows 10/11 64-bit
- Processor: Intel Core i7-8700 / AMD Ryzen 5 3600
- Memory: 16 GB RAM
- Graphics: NVIDIA GTX 1660 / AMD RX 5600
- DirectX: Version 12
- Storage: 500 MB available space

### 태그 (Store Tags)
- Action
- Indie
- Fighting
- 3D
- Artificial Intelligence
- Machine Learning
- Souls-like
- Difficult
- Single Player

### 지원 언어
- English (interface, subtitles)
- Korean (interface, subtitles)

## 4. 빌드 업로드

### SteamPipe 설정

1. Steamworks SDK 다운로드
2. `ContentBuilder/` 폴더 사용

### app_build.vdf 파일 생성
```vdf
"appbuild"
{
	"appid" "[YOUR_APP_ID]"
	"desc" "AI Fighter Build"
	"buildoutput" "../output/"
	"contentroot" ""
	"setlive" ""
	"preview" "0"
	"local" ""

	"depots"
	{
		"[DEPOT_ID]" "depot_build.vdf"
	}
}
```

### depot_build.vdf 파일 생성
```vdf
"DepotBuildConfig"
{
	"DepotID" "[DEPOT_ID]"
	"contentroot" "[PATH_TO_RELEASE_FOLDER]"
	"FileMapping"
	{
		"LocalPath" "*"
		"DepotPath" "."
		"recursive" "1"
	}
	"FileExclusion" "*.pdb"
}
```

### 업로드 실행
```bash
./steamcmd.exe +login [USERNAME] +run_app_build [PATH_TO_app_build.vdf] +quit
```

## 5. 업적 설정

Steamworks 대시보드 > Stats & Achievements에서 다음 업적 추가:

| API Name | Display Name | Description |
|----------|--------------|-------------|
| ACH_FIRST_BLOOD | First Blood | Win your first round |
| ACH_VETERAN | Veteran | Win 10 rounds |
| ACH_CHAMPION | Champion | Win 50 rounds |
| ACH_LEGEND | Legend | Win 100 rounds |
| ACH_LEVEL_5 | Getting Serious | Reach Boss Level 5 |
| ACH_LEVEL_10 | AI Trainer | Reach Boss Level 10 |
| ACH_LEVEL_20 | Master Trainer | Reach Boss Level 20 |
| ACH_PARRY_MASTER | Parry Master | Successfully parry 50 attacks |
| ACH_DODGE_MASTER | Dodge Master | Dodge 100 attacks |
| ACH_PERFECT_ROUND | Perfect Round | Win a round without taking damage |
| ACH_FLAWLESS_STREAK | Flawless Streak | Win 5 rounds without dying |
| ACH_HARD_MODE | Hard Mode Victor | Clear a round on Hard difficulty |
| ACH_SPEED_DEMON | Speed Demon | Win a round in under 30 seconds |
| ACH_COMEBACK | Comeback King | Win with less than 10% HP |
| ACH_SURVIVOR | Survivor (Hidden) | Survive for 5 minutes in a single round |
| ACH_DEDICATED | Dedicated (Hidden) | Play for 1 hour total |
| ACH_MASOCHIST | Masochist (Hidden) | Die 100 times |

## 6. 가격 설정

권장 가격:
- USD: $9.99
- KRW: ₩10,500
- EUR: €8.99
- GBP: £7.99

## 7. 출시 전 체크리스트

- [ ] 스토어 페이지 그래픽 업로드 (헤더 이미지, 캡슐 이미지, 스크린샷)
- [ ] 트레일러 영상 업로드
- [ ] 업적 아이콘 업로드
- [ ] 모든 언어 현지화 완료
- [ ] 베타 테스트 진행
- [ ] 출시 할인율 설정 (선택)
- [ ] 출시일 설정

## 8. 출시 후

- 커뮤니티 허브 모니터링
- 버그 리포트 대응
- 업데이트 계획 공지
- 세일 참여 계획

## 유용한 링크

- Steamworks 문서: https://partner.steamgames.com/doc/home
- SteamPipe 가이드: https://partner.steamgames.com/doc/sdk/uploading
- 업적 가이드: https://partner.steamgames.com/doc/features/achievements
- 가격 정책: https://partner.steamgames.com/doc/store/pricing
