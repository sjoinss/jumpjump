/**
 * 밸런스·화면 상수는 전부 여기에 모은다. "초기 제안" 값은 플레이 테스트 후 조정한다.
 * 단위: 길이는 논리 px, 시간은 초, 속도는 논리 px/초.
 */
export const CONFIG = {
  view: {
    /** 논리 해상도: 폭 고정, 높이 가변 */
    width: 360,
    minHeight: 640,
    maxHeight: 840,
    /** 이 폭(CSS px) 이하면 프레임 없이 전체 화면 */
    desktopBreakpoint: 480,
    /** PC 프레임 바깥 여백 */
    desktopGutter: 24,
    /** PC 프레임 좌우 정보 영역 폭. 양쪽에 이만큼 여유가 있을 때만 표시 */
    desktopSideWidth: 220,
    /** 시작 장면의 바닥 두께 (화면 아래에서부터, 논리 px) */
    groundHeight: 88,
  },

  home: {
    /** 시작 장면에서 캐릭터가 제자리에서 폴짝 뛰는 간격과 높이 */
    idleHopInterval: 1.8,
    idleHopDuration: 0.36,
    idleHopHeight: 14,
  },

  loop: {
    /** 고정 시간 스텝. 60Hz든 120Hz든 이 간격으로 물리를 돌린다 */
    fixedStep: 1 / 120,
    /** 탭 전환 등으로 한 프레임이 너무 길 때 한 번에 따라잡을 최대 시간 */
    maxFrameTime: 0.25,
  },

  input: {
    /** 키보드: 누르는 동안 가속, 떼면 감속 (초기 제안) */
    keyMaxSpeed: 420,
    keyAccel: 2400,
    keyDecel: 3200,
    /** 방향을 반대로 바꿀 때 추가 감속 배율 */
    keyTurnBoost: 2,
    /** 마우스: 목표 x를 따라가는 최대 속도와 추적 강도(클수록 빨리 붙음) */
    mouseMaxSpeed: 900,
    mouseFollow: 14,
    /** 터치 드래그 배율 (1 = 손가락이 움직인 만큼) */
    dragRatio: 1,
  },

  physics: {
    /** 초기 제안. 최대 점프 높이 = velocity² / (2 × gravity) ≈ 187px */
    gravity: 1800,
    jumpVelocity: 820,
  },

  /** 발판 생성·카메라 (기획서 3-3, 3-4. 초기 제안) */
  world: {
    /** 첫 발판 높이 (바닥 윗면 기준) */
    firstPlatformY: 80,
    /** 발판 사이 세로 간격: 처음 최소값 → 높이가 오를수록 최대 점프 높이 × maxGapRatio까지 */
    minGap: 62,
    maxGapRatio: 0.8,
    /** 이 높이(논리 px)에 도달하면 간격 증가가 최대가 된다 */
    gapGrowthHeight: 16000,
    /** 간격을 이만큼 무작위로 줄여 리듬을 흔든다 (0.15 = 최대 15% 짧게) */
    gapJitter: 0.18,
    /** 화면 위쪽으로 이만큼 미리 만들어 둔다 */
    spawnAhead: 240,
    /** 화면 아래로 이만큼 벗어난 발판은 지운다 */
    removeBelow: 60,
    /** 대열 맨 아래 줄을 화면 위에서부터 이 비율 위치에 둔다 */
    cameraRatio: 0.55,
    /**
     * 동료 0명(M=0) 사용자를 위한 발판 판정 폭 보정 (15단계 밸런스).
     * 동료1이 있으면 판정 폭이 64→128px이라 훨씬 쉬워서, 혼자 하는 사람도 비슷한 높이까지 가도록 양옆 12px씩 넓힌다.
     * 그림은 도트가 흐려지지 않게 128px 그대로 그리므로 보이지 않는 여유다.
     * 자동 플레이 시뮬레이션: 보정 0 → 중앙값 약 118m, 24 → 약 195m (동료 1명일 때 약 204m)
     */
    platformWidthBonusSolo: 24,
    /**
     * 동료 1명이 늘 때마다 발판을 이만큼 좁힌다 (동료가 있으면 착지 폭이 넓어져 너무 쉬워지는 것 보정).
     * 자동 플레이(동료가 실제처럼 하나씩 합류): 0px → 중앙값 약 201m(혼자와 비슷), 6px → 약 164m.
     * 좁아진 발판은 그림도 같은 비율로 작게 그려서 보이는 크기와 판정이 같다
     */
    platformWidthShrinkPerCompanion: 6,
  },

  /** 특수 발판 (기획서 3-4. 초기 제안) */
  special: {
    /** 고점프: 점프 속도 배율. 높이는 배율의 제곱 (1.35 → 약 1.8배) */
    highJumpVelocityMultiplier: 1.35,
    /** 일회용: 밟은 뒤 부서지며 사라지는 시간 */
    oneTimeBreakDuration: 0.3,
    /**
     * 일회용을 밟으면 그 아래 발판이 모두 무너진다: 밟은 곳에서 아래로 이 빠르기(px/초)로 차례차례 흔들리다 떨어진다.
     * 무너지기 시작한 발판은 바로 밟을 수 없어서, 놓치면 화면 아래로 떨어져 끝 (예전엔 화면 아래 끝을 확 끌어올렸는데 순간이동 같아서 바꿈)
     */
    collapseWaveSpeed: 900,
    /**
     * 높이(m)대별 등장 확률. 발판이 생기는 높이가 from(m) 이상인 마지막 줄이 적용된다. 나머지 확률은 기본 발판.
     * (예전 발판 수 기준 20·40·150번째 발판이 생기던 높이에 맞춘 값)
     */
    table: [
      { from: 0, highJump: 0, oneTime: 0, moving: 0 },
      { from: 15, highJump: 0.15, oneTime: 0, moving: 0 },
      { from: 35, highJump: 0.15, oneTime: 0.15, moving: 0 },
      // 움직이는 발판: 60m부터 조금씩, 높이 올라갈수록 늘어난다 (난이도)
      { from: 60, highJump: 0.15, oneTime: 0.15, moving: 0.12 },
      { from: 175, highJump: 0.16, oneTime: 0.2, moving: 0.2 },
      { from: 350, highJump: 0.16, oneTime: 0.22, moving: 0.28 },
    ],
    /** 움직이는 발판: 좌우 벽 사이를 오가는 빠르기(px/초, 발판마다 이 사이에서 무작위). 지역 속도 배율도 받는다 */
    moving: { speedMin: 45, speedMax: 85 },
  },

  /**
   * 점수 = 높이(m). 이번 판에서 대열 맨 아래 줄 발밑이 올라간 가장 높은 곳(바닥 윗면 기준)을 pxPerMeter로 나눠 내림.
   * 발판을 몇 개 밟았는지와는 무관하다 (기획서 3-2의 "발판마다 +1"을 사용자 결정으로 변경)
   */
  score: {
    /** 1m = 캐릭터 키(72px) */
    pxPerMeter: 72,
    /** 스크린리더에는 이 간격(m)마다만 알린다 */
    announceEvery: 10,
  },

  /** 지역 (기획서 3-5). startM(높이 m)에서 시작하고 경계 ±blend m 구간에서 섞인다 */
  regions: {
    list: [
      { id: "cave", name: "동굴", startM: 0 },
      { id: "ground", name: "지상", startM: 75 },
      { id: "sky", name: "하늘", startM: 260 },
      { id: "space", name: "우주", startM: 600 },
    ],
    blend: 25,
    /**
     * 지역별 게임 속도 배율 (동굴·지상·하늘·우주). 들어갈 때마다 살짝 빨라진다 — 너무 빠르지 않게 최대 +15%.
     * 시간을 빠르게 할 뿐이라 점프 높이·발판 간격은 그대로다
     */
    speedScale: [1, 1.05, 1.1, 1.15],
    /** 배경이 목표 지역 색으로 따라가는 속도 (지역 단위/초). 점수가 1m씩 오를 때 뚝뚝 끊기지 않게 */
    followSpeed: 0.8,
    /** 지역 이름 배너 표시 시간(초) */
    bannerSeconds: 2,
  },

  character: {
    /** 착지 순간 착지 프레임을 보여주는 시간 (0.15~0.25초 조절) */
    landingFrameDuration: 0.2,
    /**
     * 게임 중 통통 튀는 점프 (결과 이미지의 폴짝 모션과 같은 느낌).
     * squash: 착지 순간 눌리는 양, recover: 착지 시간 중 다시 펴지는 데 쓰는 비율, stretch: 튀어 오를 때 늘어나는 양, fall: 떨어질 때
     */
    squash: { squash: 0.24, recover: 0.6, stretch: 0.16, fall: 0.06 },
    /** 게임 내 표시 상자. 도트·이미지 캐릭터 모두 같은 크기 */
    width: 64,
    height: 72,
    /** 허용 도트 격자 (1 : 1.125) */
    gridSizes: [
      { width: 16, height: 18 },
      { width: 32, height: 36 },
    ],
  },

  platform: {
    width: 128,
    height: 32,
    grid: { width: 32, height: 8 },
  },

  companion: {
    maxCount: 5,
    defaultMax: 5,
    /** 후보가 나오는 높이(m) (기획서 7-2). 이 높이 이상에서 처음 생기는 발판 위에. 그 뒤에도 모자라면 repeatEvery(m) 간격으로 */
    candidateHeights: [25, 75, 175, 350, 650],
    repeatEvery: 300,
    /** 거절이 이만큼 쌓이면 동료 최대 인원을 그때 동료 수로 자동 설정 (기획서 7-6) */
    refusalLimit: 3,
    /** 후보 블록 크기(논리 px)와 발판 위 떠 있는 높이 */
    candidateSize: 56,
    candidateLift: 22,
    /** 조건이 사라진 후보가 조용히 사라지는 시간 */
    candidateFade: 0.45,
    /** 합류 연출(톡 튀어나오기) 시간 */
    joinPop: 0.45,
  },

  /** 대열 (기획서 3-3, 7-1): 2열 × 최대 3행 */
  formation: {
    columns: 2,
    /** 대열 줄 수(1~3)에 따라 맨 아래 줄을 화면 위에서부터 이 비율 위치에 둔다. 줄이 많을수록 아래로 내려 위쪽 시야 확보 */
    cameraRatioByRows: [0.55, 0.62, 0.7],
  },

  /** 연출 (기획서 12번. 초기 제안). 흔들림·파티클은 설정에서 각각 끌 수 있다 */
  effects: {
    /** 한 화면에 동시에 있을 수 있는 파티클 수 */
    maxParticles: 120,
    /** 파티클이 받는 중력 (세계 좌표, 위가 +) */
    gravity: 520,
    /** 착지 먼지 / 고점프 반짝이 / 일회용 조각 / 합류 별 */
    dust: { count: 5, speed: 70, life: 0.35 },
    sparkle: { count: 8, speed: 160, life: 0.5 },
    shard: { count: 7, speed: 140, life: 0.55 },
    star: { count: 10, speed: 120, life: 0.6 },
    /** 화면 흔들림: 약하게 (세기 px, 시간 s) */
    shake: {
      highJump: { magnitude: 2, duration: 0.14 },
      break: { magnitude: 3, duration: 0.18 },
      join: { magnitude: 2, duration: 0.2 },
    },
    /** 프레임이 이보다 오래 걸리는 게 이어지면 파티클을 줄인다 (기획서 18 성능 저하 대응) */
    slowFrameMs: 24,
    /** 느린 프레임 비율이 이 이상이면 파티클 절반 */
    slowFrameRatio: 0.3,
  },

  /** 효과음 (Web Audio로 만드는 8비트 소리, 기획서 12번) */
  sfx: {
    /** 전체 볼륨 (0~1). 작게 시작한다 */
    volume: 0.12,
  },

  /** 일시정지 메뉴에서 "계속하기"를 누른 뒤 다시 움직이기까지 세는 초 */
  resumeCountdown: 3,

  /**
   * 미니게임 (기획서 8번. 초기 제안 — 처음 해도 대부분 성공하는 게 목표).
   * 좌표는 미니게임 판(arena) 기준 논리 px, y는 아래로 갈수록 커진다. 화면에는 비율을 지켜 맞춰 넣는다.
   */
  minigame: {
    arena: { width: 360, height: 560 },
    /** 시작 전(그리고 일시정지 후 다시 시작할 때) 조작법을 보여주는 카운트다운 초 */
    countdown: 3,
    /** 판 위 캐릭터 크기 */
    actor: { width: 48, height: 54 },
    rope: {
      goal: 7,
      lives: 3,
      /** 줄넘기 판 높이: 다른 게임보다 낮게 (위쪽 빈 하늘이 길면 집중이 흩어진다) */
      arenaHeight: 320,
      /** 줄이 한 바퀴 도는 시간(초). 길수록 느리다. 한 번 넘을 때마다 periodStep씩 빨라진다(periodMin까지) */
      period: 1.5,
      periodStep: 0.05,
      periodMin: 1.2,
      /** 점프: 체공 시간 = 2v/g ≈ 0.69초 */
      jumpVelocity: 520,
      gravity: 1500,
      /** 줄이 발밑을 지날 때 발이 이만큼 떠 있으면 성공 */
      clearance: 10,
    },
    shooter: {
      lives: 3,
      /** 적 무리 (목표 = 모두 물리치기 = rows × cols) */
      rows: 3,
      cols: 6,
      enemySize: 30,
      /** 적 사이 가로·세로 틈 */
      enemyGapX: 14,
      enemyGapY: 12,
      /** 적 무리가 좌우로 흔들리는 폭(px)과 빠르기(초당 왕복 횟수) */
      swayAmplitude: 40,
      swaySpeed: 0.5,
      /** 자동 발사 간격과 탄속 */
      fireInterval: 0.28,
      bulletSpeed: 560,
      /** 적 탄환 */
      enemyFireInterval: 1.3,
      enemyBulletSpeed: 190,
      invincible: 1.2,
    },
    flappy: {
      goal: 6,
      lives: 3,
      /**
       * 반응이 0.24초 늦는 자동 플레이 기준 성공률 약 70% (2026-10-01: 느려서 재미없다는 의견으로 기둥을 1.6배 빠르게).
       * 15단계의 550/240/100은 약 95%, 900/320/100은 약 20%였다
       */
      gravity: 600,
      flapVelocity: 255,
      pipeSpeed: 160,
      pipeWidth: 56,
      /** 통로 높이 */
      pipeGap: 230,
      /** 기둥 사이 가로 간격 */
      pipeSpacing: 240,
      invincible: 1.2,
    },
    dodge: {
      seconds: 15,
      lives: 3,
      spawnInterval: 0.5,
      fallSpeedMin: 170,
      fallSpeedMax: 250,
      /** 낙하물 반지름 */
      radius: 14,
      invincible: 1.0,
    },
  },

  /** 결과 이미지 */
  card: {
    /** 맨 아래 글씨 기본값과 최대 글자 수 (사용자가 저장 전에 바꿀 수 있다) */
    defaultCaption: "점프점프",
    captionMax: 20,
  },

  /** 저장 데이터 상한. 불러온 데이터가 이를 넘으면 거부하거나 잘라낸다 */
  limits: {
    paletteMax: 24,
    companionNameMax: 12,
    /** 이미지 1장 상한 300KB의 base64 길이(4/3배) + 여유 */
    imageBase64MaxLength: 420_000,
    image: { width: 320, height: 360 },
  },

  /** 이미지 불러오기 (기획서 6번, 초기 제안) */
  imageImport: {
    maxFileBytes: 10 * 1024 * 1024,
    /** 디코딩한 이미지의 긴 변 / 전체 픽셀 상한 */
    maxSide: 8000,
    maxPixels: 40_000_000,
    /** 배경 제거·미리보기용 작업본의 긴 변. 최대 확대(3배)해도 저장 해상도보다 선명하도록 */
    workMaxSide: 1080,
    /** 저장 이미지 1장 상한. 넘으면 품질을 낮춰 다시 인코딩 */
    outputMaxBytes: 300 * 1024,
    zoomMin: 0.3,
    zoomMax: 3,
    /** 배경 제거 허용 오차 기본값 (0~100) */
    defaultTolerance: 30,
  },

  /** JSON 내보내기·불러오기 (기획서 14번) */
  dataFile: {
    /** 파일 안의 식별자. 예전에 내보낸 파일도 읽을 수 있게 바꾸지 않는다 */
    app: "dot-jump-climb",
    /** 내보내기 파일 이름 앞부분 */
    fileNamePrefix: "jumpjump",
    maxBytes: 10 * 1024 * 1024,
    /** 백업 안내: 그림을 바꾼 뒤 이 기간 동안 내보내기를 안 했으면 시작 화면에 안내 (초기 제안) */
    reminderIntervalDays: 14,
  },

  storage: {
    /** 바꾸면 이미 저장된 데이터를 못 읽으므로 앱 이름이 바뀌어도 그대로 둔다 */
    dbName: "dot-jump-climb",
    /** IndexedDB가 응답하지 않을 때(일부 사파리 비공개 모드) 포기하는 시간 */
    openTimeoutMs: 3000,
    /** 연속 수정(에디터 자동 저장 등)을 묶어서 쓰는 간격 */
    writeDebounceMs: 300,
  },
} as const;

export type Config = typeof CONFIG;
