# FinDigest 抖音口播 · 更狠版 2.0

双引擎交付（grill-me 已对齐）：

| 项目 | 路径 | 用途 |
|---|---|---|
| Hyperframes（抖音主片） | `video-douyin-findigest/` | 竖屏 9:16 · HTML 构图 |
| Remotion（加分副本） | `video-douyin-findigest-remotion/` | 同口播 React 时间轴 |

## 预览

```bash
# Hyperframes
cd video-douyin-findigest
npm run dev

# Remotion
cd video-douyin-findigest-remotion
npm run dev
```

## 渲染（需你确认后再跑）

```bash
cd video-douyin-findigest
npx hyperframes render --quality high --output out.mp4

cd ../video-douyin-findigest-remotion
npx remotion render FinDigestDouyin out/findigest-douyin.mp4
```

## 文案

DeepSeek 更狠版 2.0 原文；旁白现为 Windows「慧慧」TTS 占位，可替换 `assets/audio/vo.wav` / `public/vo.wav`。

## 待补

- 你的出镜画面、真人声
- 实机录屏替换界面卡片（可选）
- Kokoro 中文 TTS（模型下载曾超时）
