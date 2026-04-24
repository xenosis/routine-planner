// 알림 아이콘에서 흰색 실루엣만 추출 → 투명 배경 PNG 생성
// Android 알림 아이콘 요구사항: 투명 배경 + 흰색 실루엣
const sharp = require('sharp');
const path = require('path');

const INPUT  = path.join(__dirname, '../assets/notification-icon-from-git.png');
const OUTPUT = path.join(__dirname, '../assets/notification-icon.png');
const BACKUP = path.join(__dirname, '../assets/notification-icon-original.png');

async function run() {
  const { data, info } = await sharp(INPUT)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);

  const THRESHOLD_HIGH = 210; // 이 이상은 완전 불투명
  const THRESHOLD_LOW  = 160; // 이 미만은 완전 투명 (파란색/보라색 배경 제거)

  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];

    const luminance = r * 0.299 + g * 0.587 + b * 0.114;

    let alpha;
    if (luminance >= THRESHOLD_HIGH) {
      alpha = 255;
    } else if (luminance <= THRESHOLD_LOW) {
      alpha = 0;
    } else {
      // 경계 픽셀 부드럽게 처리 (안티앨리어싱)
      alpha = Math.round(((luminance - THRESHOLD_LOW) / (THRESHOLD_HIGH - THRESHOLD_LOW)) * 255);
    }

    out[i * 4]     = 255; // R
    out[i * 4 + 1] = 255; // G
    out[i * 4 + 2] = 255; // B
    out[i * 4 + 3] = alpha;
  }

  // 원본 백업 (git 복원본)
  await sharp(INPUT).toFile(BACKUP);
  console.log('원본 백업:', BACKUP);
  console.log(`처리 설정: 임계값 하한=${THRESHOLD_LOW}, 상한=${THRESHOLD_HIGH}`);

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(OUTPUT);

  console.log('완료:', OUTPUT);
  console.log(`크기: ${width}x${height}`);
}

run().catch(console.error);
