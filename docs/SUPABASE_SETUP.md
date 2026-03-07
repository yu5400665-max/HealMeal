# Supabase 配置指南（生态社区）

这份文档只影响「生态社区」模块。  
即使暂时不配置 Supabase，首页 / 餐单 / 打卡 / 家属也能正常使用。

## 1) 注册并进入 Supabase 项目

1. 打开 https://supabase.com/ 并登录。
2. 创建一个新项目（New project）。
3. 等待项目初始化完成（通常 1-3 分钟）。

## 2) 获取项目 URL 和 Publishable Key

1. 在项目左侧点 `Project Settings`。
2. 进入 `API` 页面。
3. 找到以下两项并复制：
   - `Project URL`
   - `Project API keys` 里的 `anon` / `publishable` key

## 3) 填写本地环境变量

打开项目根目录 `.env.local`，填入：

```env
NEXT_PUBLIC_SUPABASE_URL=你的ProjectURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Publishable(anon)Key
```

保存后，重启开发服务：

```bash
cmd /c npm run dev
```

## 4) 初始化数据库表和 RLS

1. 回到 Supabase 控制台左侧 `SQL Editor`。
2. 新建一个 SQL 查询窗口。
3. 打开本仓库文件：`supabase/schema.sql`
4. 复制全部内容粘贴到 SQL Editor。
5. 点击 `Run` 执行。

执行成功后会创建：
- `profiles`
- `posts`
- `comments`
- `likes`
- `bookmarks`

并自动启用 RLS 和对应策略。

## 5) 开启匿名登录（Anonymous sign-ins）

1. 左侧进入 `Authentication` -> `Providers`。
2. 找到 `Anonymous`。
3. 打开 `Enable` 开关并保存。

说明：生态模块默认匿名登录，适合比赛演示体验。清理浏览器后匿名账号会丢失，属于预期行为。

## 6) 创建帖子图片存储桶

1. 左侧进入 `Storage`。
2. 新建 bucket，名称填：`post-images`
3. 设置为公开读取（Public）。

如果你已经运行了 `supabase/schema.sql`，其中也包含了 `post-images` 的策略。

## 7) 验证是否配置成功

1. 打开 `http://localhost:7860/logs`
2. 看到帖子列表后，点右上角 `+` 发布一条帖子。
3. 点赞 / 收藏 / 评论任意帖子。
4. 刷新页面，确认数据仍在（不是演示假数据）。

## 常见问题

### Q1: 我没配 Supabase，会影响主流程吗？

不会。只会影响生态社区功能，其他页面照常可用。

### Q2: 页面提示“请先配置 Supabase 环境变量”

通常是以下原因：
- `.env.local` 变量名写错
- 改完环境变量后没重启 `npm run dev`
- URL 或 key 复制时多了空格

### Q3: SQL 运行报错怎么办？

先确认你粘贴的是最新的 `supabase/schema.sql` 全文，再重新执行。  
大多数语句都用了 `if not exists`，可重复运行。

### Q4: 发帖/评论提示 RLS 或 permission denied 怎么办？

如果错误包含以下关键词：

- `row-level security`
- `permission denied`
- `401/403`

请在 Supabase `SQL Editor` 运行仓库文件：

- `supabase/policies_fix.sql`

这是安全修复版，不会删除表，只会重新写 RLS policies。
