/**
 * 결과 카드 배치와 폴짝 모션 (기획서 13-2, 13-4). DOM 없는 순수 계산이라 테스트할 수 있다.
 * 좌표는 카드 논리 좌표(360×360, y 아래로). PNG는 3배, GIF는 2배로 그린다.
 */

export const CARD = {
  size: 360,
  /** 위쪽 점수·지역 영역 */
  headerHeight: 64,
  /** GIF 한 바퀴 프레임 수와 프레임 길이. 모든 캐릭터 주기가 이 루프에 딱 맞는다 */
  loopFrames: 32,
  frameMs: 50,
  pngScale: 3,
  gifScale: 2,
} as const;

export type Slot = {
  /** 0 = 주인공, 1~5 = 합류한 동료 순서 */
  member: number;
  /** 가운데 x, 발판 윗면 y */
  cx: number;
  groundY: number;
  /** 캐릭터 표시 크기 (발판 폭 = width, 발판 높이 = width/4) */
  width: number;
  height: number;
  /** 0 = 앞줄, 1 = 뒷줄 (뒷줄을 먼저 그린다) */
  row: 0 | 1;
};

const FRONT_GROUND = 296;
const BACK_LIFT = 60;

/**
 * 인원별 배치 (기획서 13-2):
 * - 1~2명: 한 줄 가운데, 128×144
 * - 3명: 한 줄, 96×108
 * - 4~6명: 앞줄 3 + 뒷줄 1~3, 뒷줄은 약 60px 위에 반 칸 엇갈리게
 * 주인공은 앞줄 가운데(2명일 땐 왼쪽). 그리는 순서대로(뒷줄 → 앞줄) 돌려준다.
 */
export function cardSlots(count: number): Slot[] {
  const n = Math.max(1, Math.min(6, Math.floor(count)));
  if (n <= 2) {
    const big = { width: 128, height: 144 };
    const xs = n === 1 ? [180] : [104, 256];
    return xs.map((cx, i) => ({ member: i, cx, groundY: FRONT_GROUND, row: 0, ...big }));
  }
  const small = { width: 96, height: 108 };
  // 앞줄: 가운데 주인공, 왼쪽 동료1, 오른쪽 동료2
  const front: Slot[] = [
    { member: 1, cx: 64, groundY: FRONT_GROUND, row: 0, ...small },
    { member: 0, cx: 180, groundY: FRONT_GROUND, row: 0, ...small },
    { member: 2, cx: 296, groundY: FRONT_GROUND, row: 0, ...small },
  ];
  if (n === 3) return front;
  const backCount = n - 3;
  // 1~2명은 앞줄 사이사이(반 칸 엇갈림), 3명은 조금 좁혀서 셋 다 앞줄과 어긋나게
  const backXs = backCount === 1 ? [122] : backCount === 2 ? [122, 238] : [93, 180, 267];
  const back: Slot[] = backXs.map((cx, i) => ({ member: 3 + i, cx, groundY: FRONT_GROUND - BACK_LIFT, row: 1, ...small }));
  return [...back, ...front];
}

export type Pose = {
  /** 발이 발판에서 떠 있는 높이 */
  lift: number;
  /** 가로·세로 배율 (1 = 원래) */
  sx: number;
  sy: number;
  /** 착지 단계 (착지 프레임이 있으면 이때 쓴다) */
  landing: boolean;
  /** 착지 직후 먼지 진행도 0~1, 없으면 null */
  dust: number | null;
};

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (p: number, a: number, b: number) => Math.max(0, Math.min(1, (p - a) / (b - a)));

/**
 * squash & stretch 폴짝 (기획서 13-4). p = 한 주기 안의 위치 0~1.
 * 준비(눌림) → 도약(늘어남) → 상승(ease-out) → 정점(체공) → 하강(ease-in, 살짝 늘어남) → 착지(강하게 눌림) → 반동(overshoot)
 */
export function jumpPose(p: number, height: number): Pose {
  const q = ((p % 1) + 1) % 1;
  if (q < 0.1) {
    const t = easeOut(seg(q, 0, 0.1));
    return { lift: 0, sx: lerp(1, 1.18, t), sy: lerp(1, 0.82, t), landing: false, dust: null };
  }
  if (q < 0.16) {
    const t = seg(q, 0.1, 0.16);
    return { lift: lerp(0, height * 0.25, t), sx: lerp(1.18, 0.84, t), sy: lerp(0.82, 1.22, t), landing: false, dust: null };
  }
  if (q < 0.4) {
    const t = easeOut(seg(q, 0.16, 0.4));
    return { lift: lerp(height * 0.25, height, t), sx: lerp(0.84, 1, t), sy: lerp(1.22, 1, t), landing: false, dust: null };
  }
  if (q < 0.5) return { lift: height, sx: 1, sy: 1, landing: false, dust: null };
  if (q < 0.7) {
    const t = easeIn(seg(q, 0.5, 0.7));
    return { lift: lerp(height, 0, t), sx: lerp(1, 0.93, t), sy: lerp(1, 1.08, t), landing: false, dust: null };
  }
  if (q < 0.82) {
    const t = seg(q, 0.7, 0.82);
    const k = t < 0.35 ? easeOut(t / 0.35) : 1 - easeIn((t - 0.35) / 0.65) * 0.5;
    return { lift: 0, sx: lerp(1, 1.26, k), sy: lerp(1, 0.76, k), landing: true, dust: t };
  }
  // 반동: 살짝 늘어났다가 원래대로
  const t = seg(q, 0.82, 1);
  const over = Math.sin(t * Math.PI) * 0.08;
  return { lift: 0, sx: lerp(1.13, 1, t) - over * 0.5, sy: lerp(0.88, 1, t) + over, landing: false, dust: t < 0.5 ? 1 : null };
}

/** 캐릭터마다 위상·높이를 다르게 (동시에 뛰지 않도록). 주기는 모두 한 루프 */
const PHASES = [0, 0.37, 0.71, 0.18, 0.55, 0.88];
const HEIGHTS = [44, 34, 40, 30, 38, 32];

export function memberPose(member: number, frame: number, scale = 1): Pose {
  const p = frame / CARD.loopFrames + PHASES[member % PHASES.length];
  return jumpPose(p, HEIGHTS[member % HEIGHTS.length] * scale);
}

/**
 * 도트가 뭉개지지 않게 표시 크기를 스냅한다 (기획서 13-4).
 * 도트 그림이면 한 칸이 정수 px가 되도록 그림 칸 수의 배수로, 이미지면 정수 px로.
 */
export function snapSize(base: number, scale: number, dots: number | null) {
  const v = base * scale;
  if (!dots) return Math.max(1, Math.round(v));
  return Math.max(dots, Math.round(v / dots) * dots);
}

/**
 * PNG에 쓸 대표 프레임: 여러 캐릭터가 서로 다른 높이로 떠 있는 프레임 (기획서 13-4).
 * 떠 있는 인원과 높이 차이가 클수록, 착지로 눌린 캐릭터가 적을수록 좋다.
 */
export function bestFrame(count: number): number {
  const slots = cardSlots(count);
  let best = 0;
  let bestScore = -Infinity;
  for (let f = 0; f < CARD.loopFrames; f++) {
    const lifts = slots.map((s) => memberPose(s.member, f).lift);
    const airborne = lifts.filter((l) => l > 6).length;
    const squashed = slots.filter((s) => memberPose(s.member, f).sx > 1.1).length;
    const mean = lifts.reduce((a, b) => a + b, 0) / lifts.length;
    const spread = Math.sqrt(lifts.reduce((a, l) => a + (l - mean) ** 2, 0) / lifts.length);
    const score = airborne * 10 + spread + mean * 0.3 - squashed * 6;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}
