# 生态页排查指南（一直转圈 / 无法进入列表）

当生态页一直停留在“正在连接社区数据...”时，按下面顺序排查：

## 1. 先看页面开发态 debug

开发环境下（`npm run dev`）生态页会显示一行 debug：

- `configured=true/false`
- `status=idle/auth/loading/ready/error`
- `userId=...`
- `error=...`

若 `configured=false`，优先检查环境变量。

## 2. 检查环境变量名是否完全一致

`.env.local` 必须存在且键名完全一致：

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

改完后必须重启开发服务：

```bash
cmd /c npm run dev
```

## 3. 检查 Supabase Auth（匿名登录）

控制台路径：`Authentication -> Providers -> Anonymous`

- 必须开启 `Enable`。
- 若关闭，页面通常会报 setup 提示或 `anonymous` 相关错误。

## 4. 检查数据库与 RLS

在 Supabase SQL Editor 运行仓库文件：

- `supabase/schema.sql`

确认表存在：

- `profiles`
- `posts`
- `comments`
- `likes`
- `bookmarks`

并确认已启用 RLS 且策略允许 `authenticated`（匿名登录用户属于该角色）执行对应读写。

## 5. 检查浏览器控制台报错

打开 DevTools Console，重点看：

- `Invalid API key`
- `anonymous sign-in disabled`
- `JWT` / `RLS policy` / `permission denied`
- 网络超时（`fetch failed` / timeout）

## 6. 最小自测

1. 打开 `/logs`，应在几秒内进入帖子列表或“还没有帖子”空态。  
2. 点击 `+` 发一条帖子。  
3. 在另一设备/浏览器打开同一站点，刷新后应可看到帖子并可评论互动。  

