import Link from "next/link";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";

export default function SupabaseSetupPage() {
  return (
    <AppContainer withNav={false} showDisclaimer={false}>
      <PageTitle title="Supabase 配置步骤" subtitle="生态社区启用指引" showBack />

      <Card>
        <ol className="list-decimal space-y-2 pl-5 text-[14px] leading-6 text-[#636E72]">
          <li>在 Supabase 控制台创建项目并打开 API 页面。</li>
          <li>复制 Project URL 和 anon/publishable key。</li>
          <li>填写 `.env.local`：`NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。</li>
          <li>重启开发服务：`cmd /c npm run dev`。</li>
          <li>在 SQL Editor 运行仓库 `supabase/schema.sql` 全文。</li>
          <li>在 Authentication - Providers 启用 Anonymous sign-ins。</li>
          <li>创建 Storage bucket：`post-images`（公开读取）。</li>
        </ol>
      </Card>

      <Card className="mt-3">
        <p className="text-[14px] text-[#636E72]">详细图文文档：</p>
        <p className="mt-1 rounded-xl bg-[#F4F8FF] p-3 text-[13px] text-[#636E72]">项目根目录 `docs/SUPABASE_SETUP.md`</p>
        <Link href="/logs" className="mt-2 inline-block rounded-xl bg-[#8AB4F8] px-4 py-2 text-[13px] text-white">
          返回生态社区
        </Link>
      </Card>
    </AppContainer>
  );
}
