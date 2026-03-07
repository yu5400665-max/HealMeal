# V2 交接包（Handoff Summary）

更新时间：2026-02-24
项目：愈后食光 HealMeal（Next.js App Router + TypeScript + Tailwind，移动端H5）

---

## 1）当前已完成内容（按页面列出）

### onboarding（建档）
- 已改为**单页长表单**（取消 4 步流程）。
- 包含字段：
  - 角色：患者本人 / 家属陪护
  - 昵称
  - 性别：女 / 男（当前默认 `female`）
  - 年龄/身高/体重：滚轮选择器（WheelPicker）
  - 手术日期
- 手术信息模块：
  - 一级分类（骨科/耳鼻喉/甲乳外科/普外/消化道/泌尿/妇科/神外/心胸外/眼科/口腔颌面/其他）
  - 二级手术名称（按一级联动）
  - 自定义输入（带联想 datalist）
  - 最终展示字段：`surgeryDisplayName`
- 长期偏好：过敏原、长期忌口、家庭常备食材、是否开启家属联动。
- 保存到 `localStorage.profile`，并写入兼容字段（`surgeryFinal`、`avoidFoods`）。

### home（首页）
- 首页已按 V2 方向简化为：
  - 康复进度卡（Day）
  - 今日一句鼓励（随机且尽量不重复）
  - 今日状态摘要（餐单/打卡/心情）
  - AI 快捷提问条（+ / 语音 / 发送）
  - 快捷按钮：生成今日餐单 / 去打卡
- 已删除旧版四宫格大入口。

### meal-plan（餐单）
- 页面结构已具备 AI 核心链路：
  - 医嘱优先提示
  - AI 问答输入框（含占位 +/语音）
  - 当前上下文卡
  - 生成条件区
  - 生成/重生按钮
  - 餐单卡片（早餐/午餐/晚餐/加餐）
- 每道菜支持：
  - 查看详情
  - 换一道（当前为本地替换逻辑）
  - 采纳
  - 标记完成
- 采纳/完成状态已持久化（localStorage）。
- 已修复运行时崩溃：历史数据缺少 `nutrition` 时不再报错。

### checkin（打卡）
- 饮食完成度优先由餐单“已完成”状态自动计算（权重：早餐25/午餐30/晚餐30/加餐15）。
- 支持手动微调（兼容无餐单场景）。
- 运动模块：运动类型标签 + 时长滑块 + 距离 + 强度。
- 新增运动建议 AI Box（`/api/ask-ai`, `mode=exercise`）。
- 饮水量滑块：0-3000ml，步长10。
- 心情+感想：含语音按钮占位、隐私模式。
- AI 总结按钮（`mode=journal-summary`）。
- 公开隐私模式下可同步发布到生态流。

### ecosystem/logs（生态）
- 底部导航文案已改“生态”，路由当前为 `/logs`。
- 生态页为 Feed 流，不再是“我的日志 + 生态圈”双 tab。
- 支持：分类 Tab（全部/术后饮食/康复训练/情绪陪伴/家属经验）。
- 每条支持 UI 交互：点赞/收藏/评论/转发（本地状态）。
- 发布入口：`/logs/publish`，支持标题、正文、图片预览、分类、标签、隐私。

### family（家属）
- 升级为照护协作中心：
  - 今日状态摘要（压缩版）
  - 今日可协助事项（勾选）
  - 家属建议卡（规则生成）
  - 鼓励话术（风格选择、生成、一键复制）
  - 家属留言（输入 + AI 润色占位 + 保存）
  - 一键海报（canvas 生成 + 下载 + 文案复制）

---

## 2）已经修改过的文件清单（完整路径）

- `app/onboarding/page.tsx`
- `app/page.tsx`
- `app/meal-plan/page.tsx`
- `app/checkin/page.tsx`
- `app/logs/page.tsx`
- `app/logs/publish/page.tsx`
- `app/family/page.tsx`
- `app/chat/page.tsx`
- `app/settings/page.tsx`
- `app/api/ask-ai/route.ts`
- `app/api/generate-meal-plan/route.ts`
- `app/api/config-status/route.ts`
- `src/lib/storage.ts`
- `src/lib/types.ts`
- `src/lib/aiClient.ts`
- `src/lib/mockData.ts`
- `src/lib/recoveryRules.ts`
- `src/lib/constants.ts`
- `components/BottomNav.tsx`
- `components/WheelPicker.tsx`
- `components/SliderField.tsx`
- `components/AIQuickInputBar.tsx`
- `components/AppContainer.tsx`
- `app/globals.css`

---

## 3）当前数据结构（最终版）

### storage 核心 key
- `profile`
- `mealSettingsDynamic`
- `dailyMealPlan`
- `dailyCheckin`
- `ecoPosts`
- `familyMessages`
- `aiChats`
- `chatSessions`
- `appSettings`
- `homeMotivationHistory`

### 兼容旧 key
- `todayMealPlan`
- `checkins`

### profile 示例
```json
{
  "role": "patient",
  "nickname": "yu",
  "age": 24,
  "gender": "female",
  "height": 165,
  "weight": 52,
  "surgeryDate": "2026-01-20",
  "postOpDay": 35,
  "surgeryCategory": "甲乳外科",
  "surgeryName": "甲状腺切除术后",
  "surgeryCustomName": "甲状腺癌术后",
  "surgeryDisplayName": "甲状腺癌术后",
  "allergens": ["海鲜"],
  "longTermAvoidFoods": ["不吃辛辣"],
  "pantryFoods": ["鸡蛋", "南瓜", "豆腐"],
  "familyLinkEnabled": true,
  "surgeryFinal": "甲状腺癌术后",
  "avoidFoods": ["不吃辛辣"],
  "createdAt": "2026-02-24T12:00:00.000Z",
  "updatedAt": "2026-02-24T12:00:00.000Z"
}
```

### dailyMealPlan 示例
```json
{
  "2026-02-24": {
    "date": "2026-02-24",
    "disclaimer": "本产品仅提供术后饮食与康复陪伴建议，不构成诊断或治疗方案，请始终以医生医嘱为准。",
    "basisSummary": "基于术后阶段生成",
    "contextSummary": "仅供参考",
    "meals": [
      {
        "id": "早餐-1",
        "mealType": "早餐",
        "dishName": "南瓜小米粥",
        "ingredients": ["小米 40g"],
        "steps": ["煮至软烂"],
        "tags": ["易消化"],
        "safetyLabel": "术后友好",
        "cautionNote": "不适及时停",
        "alternatives": ["山药粥"],
        "whyThisMeal": "温和易消化",
        "nutrition": {
          "caloriesKcal": 285,
          "proteinG": 14,
          "carbsG": 38,
          "fatG": 7
        },
        "imageUrl": "/meal-placeholder.svg",
        "adopted": true,
        "completed": false
      }
    ]
  }
}
```

### dailyCheckin 示例
```json
{
  "2026-02-24": {
    "date": "2026-02-24",
    "mealCompletion": 55,
    "mealCompletionAuto": 45,
    "mealCompletionManualAdjust": 10,
    "exerciseType": "散步",
    "exerciseMinutes": 20,
    "distanceMeters": 1200,
    "intensity": "低",
    "waterMl": 800,
    "mood": "🙂",
    "notes": "今天状态还可以",
    "notePrivacy": "public",
    "aiSummary": "今日状态稳定...",
    "createdAt": "2026-02-24T12:10:00.000Z",
    "updatedAt": "2026-02-24T12:10:00.000Z"
  }
}
```

### family messages / encouragement（实际存储）
```json
{
  "familyMessages": [
    {
      "id": "1700000000000",
      "content": "今天做得很好，继续保持。",
      "createdAt": "2026-02-24T12:20:00.000Z"
    }
  ],
  "aiChats": [
    {
      "id": "1700000001111",
      "mode": "family-encourage",
      "question": "鼓励风格:温柔",
      "answer": "你已经很棒了...",
      "date": "2026-02-24",
      "createdAt": "2026-02-24T12:21:00.000Z"
    }
  ]
}
```

### ecosystem posts 示例
```json
{
  "ecoPosts": [
    {
      "id": "eco-1",
      "user": "术后小雨",
      "surgeryTag": "甲状腺术后",
      "postOpDay": 12,
      "category": "术后饮食",
      "title": "今天清淡饮食很舒服",
      "content": "少量多餐有效",
      "imageUrl": "/meal-placeholder.svg",
      "tags": ["清淡", "易消化"],
      "likes": 128,
      "favorites": 58,
      "comments": 26,
      "shares": 12,
      "privacy": "public",
      "createdAt": "2026-02-24T12:00:00.000Z",
      "updatedAt": "2026-02-24T12:00:00.000Z"
    }
  ]
}
```

---

## 4）已做的数据兼容迁移逻辑

- `todayMealPlan -> dailyMealPlan`：
  - 新 key 为空时自动读取旧 key，迁移后写入新 key。
- `checkins -> dailyCheckin`：
  - 新 key 为空时自动读取旧 key，迁移后写入新 key。
- `profile` 兼容字段：
  - `surgeryDisplayName` 自动回退：`surgeryFinal/surgeryName/surgeryCustomName/surgeryCustom`。
  - `longTermAvoidFoods` 自动回退旧 `avoidFoods`。
- `dailyMealPlan` 菜品标准化：
  - 补齐 `id/adopted/completed`。
  - 缺失 `nutrition`、`ingredients`、`steps`、`tags`、`alternatives` 自动兜底。
  - 解决历史数据导致的 `dish.nutrition.caloriesKcal` 崩溃问题。
- 所有 localStorage 读写都有 `try/catch`，并做了 SSR 安全判断（`typeof window`）。

---

## 5）当前页面功能与交互逻辑（简述）

### 餐单页面（重点）
- 已有：生成条件、AI问答、换一道、采纳、完成。
- `生成今日餐单`：请求 `/api/generate-meal-plan`。
- `重新生成`：强制重新请求。
- `换一道`：当前是前端本地替换（取 `alternatives[0]`），暂未走 `replace-meal` API。
- `采纳/已完成`：更新并持久化到 `dailyMealPlan`。

### 打卡页面“饮食完成度”逻辑
- 自动计算来源：`dailyMealPlan.meals[].completed`。
- 权重模型：早餐25% / 午餐30% / 晚餐30% / 加餐15%。
- 支持手动微调（`mealCompletionManualAdjust`）以兼容无餐单场景。

### AI快捷提问框现状
- 首页/餐单/打卡都已接入后端路由 `/api/ask-ai`。
- `+` 和语音按钮当前为 UI 占位。
- 未配置 API Key 时后端返回 mock，不会白屏。

---

## 6）未完成但计划中的内容（按优先级）

### P0（优先）
- 接入国内 Qwen API（OpenAI Compatible），并保留 mock 回退。
- `aiClient` 完善 provider 分流（`AI_PROVIDER` 真正生效）。
- 增加 `/api/replace-meal`，把“换一道”改为后端规则+AI生成。

### P1
- 打卡页语音输入接 Web Speech API。
- 家属页“AI润色”改真实接口。
- 生态评论详情与本地评论列表。

### P2
- 菜品图片能力增强（图库或AI出图）。
- 海报模板多样化。
- 账号体系与云端同步（替代纯 localStorage）。

---

## 7）接入 API 前需要准备的内容

请在项目根目录创建 `.env.local`，至少包含：

```env
AI_PROVIDER=qwen
OPENAI_API_KEY=你的密钥
OPENAI_BASE_URL=你的Qwen兼容BaseURL
OPENAI_MODEL=你的模型名
```

需要你确认给开发的信息：
- Qwen 的 OpenAI-compatible `base_url`
- 模型名（如 `qwen-...`）
- 是否需要保留现有 OpenAI 默认值作为备用

---

## 8）建议的新会话第一条指令（可直接复制）

```text
请只做 Qwen API 接入，不重构 UI，不改页面视觉。基于当前项目把 src/lib/aiClient.ts 改为支持 AI_PROVIDER=qwen，并通过 OPENAI_BASE_URL/OPENAI_API_KEY/OPENAI_MODEL 调用；保留现有 /api/ask-ai 与 /api/generate-meal-plan 的 mock fallback。完成后请给出修改文件清单、.env.local 示例、以及本地验证步骤。
```

---

## 最小接入清单（MVP API）

### 新增哪些文件
- MVP 可先不新增文件（0新增）。

### 修改哪些文件
- `src/lib/aiClient.ts`
- `app/api/ask-ai/route.ts`
- `app/api/generate-meal-plan/route.ts`
- （可选）`app/api/config-status/route.ts`

### 先打通哪一个按钮
1. 餐单页 AI 问答发送按钮（最快验证）
2. 餐单页“生成今日餐单”按钮
3. 打卡页“AI总结/运动建议”按钮

---

## 补充说明：git commit 是什么

- `git commit` 是把当前代码做一次**本地快照**。
- 只有执行 `git push`，这些提交才会上传到 GitHub。
- 所以 commit 不等于上网，不等于公开代码。
