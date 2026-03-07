import Link from "next/link";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";

export default function PrivacyPage() {
  return (
    <AppContainer withNav={false}>
      <PageTitle title="隐私说明" subtitle="简明版，便于快速阅读" showBack />

      <Card>
        <p className="text-[16px] font-semibold text-[#2C3E50]">我们收集什么</p>
        <p className="mt-2 text-[14px] leading-6 text-[#636E72]">
          昵称、年龄/身高/体重、手术信息、过敏与忌口、家属联动开关，用于生成更贴合你的饮食与康复陪伴建议。
        </p>
      </Card>

      <Card className="mt-3">
        <p className="text-[16px] font-semibold text-[#2C3E50]">我们如何使用</p>
        <ul className="mt-2 space-y-1 text-[14px] leading-6 text-[#636E72]">
          <li>仅用于个性化建议与页面展示。</li>
          <li>不会出售给第三方。</li>
          <li>不会用于商业广告投放。</li>
        </ul>
      </Card>

      <Card className="mt-3">
        <p className="text-[16px] font-semibold text-[#2C3E50]">你的控制权</p>
        <ul className="mt-2 space-y-1 text-[14px] leading-6 text-[#636E72]">
          <li>可随时修改建档信息。</li>
          <li>可在设置中一键清空数据。</li>
          <li>家属联动可随时关闭。</li>
        </ul>
      </Card>

      <div className="mt-3">
        <Link href="/onboarding" className="inline-block rounded-2xl bg-[#8AB4F8] px-5 py-2.5 text-[14px] text-white">
          返回建档
        </Link>
      </div>
    </AppContainer>
  );
}

