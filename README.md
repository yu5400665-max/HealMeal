# 愈后食光 HealMeal

Next.js 14 + React 18 + TypeScript + Tailwind 的移动端优先康复陪伴网页版本。

## 本地启动

```bash
npm install
npm run dev
```

默认地址：`http://localhost:7860`

> Windows PowerShell 若提示 `npm.ps1` 权限限制，可改用：`cmd /c npm run dev`
> Windows 若频繁遇到 `EADDRINUSE: 7860` 或 `Cannot find module './xxx.js'`，可使用：`cmd /c npm run dev:win`（自动清端口+清理 `.next` 缓存再启动）

## 环境变量

复制 `.env.example` 为 `.env.local`，至少配置以下内容：

```env
AI_PROVIDER=modelscope
AI_BASE_URL=https://api-inference.modelscope.cn/v1
xxx_KEY=你的模型服务密钥
AI_MODEL_TEXT=Qwen/Qwen3-32B
AI_MODEL_VISION=Qwen/Qwen3-VL-8B-Instruct
AI_MODEL_FAST_TEXT=Qwen/Qwen3-8B
AI_MODEL_FAST_VISION=Qwen/Qwen3-VL-8B-Instruct
AI_MODEL_MEAL_TEXT=Qwen/Qwen3-8B
AI_TIMEOUT_FAST_MS=11000
AI_TIMEOUT_SLOW_MS=25000
MEAL_AI_TIMEOUT_MS=30000
MEAL_AI_MAX_ATTEMPTS=1

NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase anon key
```

## Supabase 初始化（社区必需）

按文档一步步配置：`docs/SUPABASE_SETUP.md`

## 主要能力

- 建档隐私：建档前说明 + 同意勾选 + 隐私说明页 + 设置页一键删除（本地+Supabase关联数据）。
- 首页陪伴：温和文案、今日小记录、今日一件小事。
- AI体验：流式输出、6小时缓存、图片压缩、友好错误与重试、快慢模型分级。
- 餐单：固定标签可选值、语音食材 chips、套餐模板、多菜位卡片。
- 打卡：饮食完成度按“标记完成”计算，运动/饮水目标与完成动作。
- 社区：Supabase 真实帖子/点赞/收藏/评论/分享，含“我的发帖/点赞/收藏”。
- 家属：便捷买菜置顶，阿里入口优先并支持实际跳转。

## 验收文档

- 复赛清单：`docs/RELEASE_CHECKLIST.md`
- 3分钟演示稿：`docs/DEMO_SCRIPT.md`
- Supabase配置指南：`docs/SUPABASE_SETUP.md`

## 部署建议（Vercel 优先）

1. 将仓库导入 Vercel。  
2. 在 Vercel 项目设置中填写与 `.env.local` 相同的环境变量。  
3. 生产环境建议保留 `AI_TIMEOUT_FAST_MS` 与 `AI_TIMEOUT_SLOW_MS`。  
4. 首次部署后访问 `/logs`，验证匿名登录与社区写入。  

## 运行验证

```bash
npm run build
npm run start
```
