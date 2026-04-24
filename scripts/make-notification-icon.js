// notification-icon.png: 코너에서 flood fill로 검은 배경만 투명으로 변환
// 보라색 아이콘 영역은 그대로 유지
const sharp = require('sharp');
const path = require('path');

const FILE = path.join(__dirname, '../assets/notification-icon.png');

const BG_THRESHOLD = 40; // 밝기 이 이하는 배경(검은색)으로 판단

async function run() {
  const { data, info } = await sharp(FILE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const out = Buffer.from(data); // RGBA 복사

  const visited = new Uint8Array(width * height);

  function idx(x, y) { return (y * width + x) * 4; }
  function isBackground(x, y) {
    const i = idx(x, y);
    const r = data[i], g = data[i+1], b = data[i+2];
    return (r * 0.299 + g * 0.587 + b * 0.114) <= BG_THRESHOLD;
  }

  // BFS flood fill: 4개 코너에서 시작
  const queue = [[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
  queue.forEach(([x,y]) => visited[y*width+x] = 1);

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (!isBackground(x, y)) continue;

    // 투명으로 설정
    out[idx(x,y)+3] = 0;

    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x+dx, ny = y+dy;
      if (nx<0||nx>=width||ny<0||ny>=height) continue;
      if (visited[ny*width+nx]) continue;
      visited[ny*width+nx] = 1;
      queue.push([nx, ny]);
    }
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(FILE);

  console.log('완료:', FILE);
}

run().catch(console.error);
