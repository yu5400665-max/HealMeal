"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import { clearAllAppData, getCheckinPreferences, getProfile, patchProfile, setCheckinPreferences } from "@/src/lib/storage";
import type { Profile } from "@/src/lib/types";

interface ConfigStatus {
  configured: boolean;
  provider: string;
  model: string;
  visionModel?: string;
  baseUrl?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [clearing, setClearing] = useState(false);
  const [exerciseGoalMinutes, setExerciseGoalMinutes] = useState(30);
  const [waterGoalMl, setWaterGoalMl] = useState(1500);

  useEffect(() => {
    setProfile(getProfile());
    const prefs = getCheckinPreferences();
    setExerciseGoalMinutes(prefs.exerciseGoalMinutes);
    setWaterGoalMl(prefs.waterGoalMl);
    fetch("/api/config-status")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch(() => setConfig(null));
  }, []);

  const profileRows = useMemo(() => {
    if (!profile) return [];
    return [
      { label: "昵称", value: profile.nickname || "-" },
      { label: "年龄", value: profile.age ? `${profile.age} 岁` : "-" },
      { label: "身高", value: profile.height ? `${profile.height} cm` : "-" },
      { label: "体重", value: profile.weight ? `${profile.weight} kg` : "-" },
      { label: "手术信息", value: profile.surgeryDisplayName || profile.surgeryFinal || "-" },
      { label: "过敏/忌口", value: [...(profile.allergens || []), ...(profile.longTermAvoidFoods || [])].join("、") || "-" }
    ];
  }, [profile]);

  const toggleFamilyLink = (enabled: boolean) => {
    const next = patchProfile({ familyLinkEnabled: enabled });
    if (next) {
      setProfile(next);
      setMessage(enabled ? "已开启家属联动" : "已关闭家属联动");
    }
  };

  const clearData = async () => {
    setClearing(true);
    setMessage("");
    try {
      await fetch("/api/privacy/delete-account", { method: "POST" });
    } catch {
      // ignore
    } finally {
      clearAllAppData();
      setProfile(null);
      setMessage("已清空你的数据，正在返回首页。");
      setTimeout(() => {
        router.replace("/");
      }, 500);
      setClearing(false);
    }
  };

  const saveCheckinGoals = () => {
    const next = setCheckinPreferences({
      exerciseGoalMinutes: Math.max(5, Number(exerciseGoalMinutes || 30)),
      waterGoalMl: Math.max(500, Number(waterGoalMl || 1500))
    });
    setExerciseGoalMinutes(next.exerciseGoalMinutes);
    setWaterGoalMl(next.waterGoalMl);
    setMessage("已保存打卡目标设置");
  };

  return (
    <AppContainer>
      <PageTitle title="隐私与数据" subtitle="你可以随时查看、修改和删除自己的信息" />

      <Card className="mt-3">
        <p className="text-sm font-semibold text-slate-700">建档信息（只读）</p>
        {profileRows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">当前没有建档信息。</p>
        ) : (
          <div className="mt-2 divide-y divide-[#EAF0F8]">
            {profileRows.map((item) => (
              <div key={item.label} className="flex items-start justify-between py-2 text-[13px]">
                <span className="text-[#636E72]">{item.label}</span>
                <span className="max-w-[65%] text-right text-[#2C3E50]">{item.value}</span>
              </div>
            ))}
          </div>
        )}
        <Link href="/onboarding" className="mt-3 inline-block rounded-xl bg-[#8AB4F8] px-4 py-2 text-sm text-white">
          修改建档信息
        </Link>
      </Card>

      <Card className="mt-3">
        <p className="text-sm font-semibold text-slate-700">隐私说明</p>
        <p className="mt-2 text-sm text-slate-600">你可以随时查看用途说明，并决定是否开启家属联动。</p>
        <Link href="/privacy" className="mt-2 inline-block text-sm text-[#8AB4F8]">
          查看《隐私说明》
        </Link>
        <label className="mt-3 flex items-center justify-between rounded-xl bg-[#F4F8FF] p-3 text-[13px] text-[#636E72]">
          家属联动
          <input
            type="checkbox"
            checked={Boolean(profile?.familyLinkEnabled)}
            onChange={(event) => toggleFamilyLink(event.target.checked)}
            className="h-4 w-4 accent-[#8AB4F8]"
          />
        </label>
      </Card>

      <Card className="mt-3">
        <p className="text-sm font-semibold text-slate-700">打卡目标设置</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[12px] text-[#636E72]">
            运动目标（分钟）
            <input
              type="number"
              min={5}
              step={5}
              value={exerciseGoalMinutes}
              onChange={(event) => setExerciseGoalMinutes(Math.max(5, Number(event.target.value || 5)))}
              className="mt-1 h-10 w-full rounded-xl bg-white px-3 text-[14px]"
            />
          </label>
          <label className="text-[12px] text-[#636E72]">
            饮水目标（ml）
            <input
              type="number"
              min={500}
              step={100}
              value={waterGoalMl}
              onChange={(event) => setWaterGoalMl(Math.max(500, Number(event.target.value || 500)))}
              className="mt-1 h-10 w-full rounded-xl bg-white px-3 text-[14px]"
            />
          </label>
        </div>
        <button type="button" onClick={saveCheckinGoals} className="mt-3 rounded-xl bg-[#8AB4F8] px-4 py-2 text-sm text-white">
          保存目标
        </button>
      </Card>

      <Card className="mt-3">
        <p className="text-sm font-semibold text-slate-700">API 配置状态</p>
        <p className="mt-2 text-sm text-slate-600">{config ? (config.configured ? "已配置" : "未配置") : "读取失败"}</p>
        <p className="text-xs text-slate-500">Provider: {config?.provider || "-"}</p>
        <p className="text-xs text-slate-500">Model: {config?.model || "-"}</p>
        <p className="text-xs text-slate-500">Vision: {config?.visionModel || "-"}</p>
        <p className="text-xs text-slate-500">Base URL: {config?.baseUrl || "-"}</p>
      </Card>

      <Card className="mt-3">
        <p className="text-sm font-semibold text-slate-700">一键清空</p>
        <p className="mt-2 text-[13px] text-slate-600">会清空本地记录，并尝试删除你在 Supabase 社区中的关联数据。</p>
        <button
          onClick={clearData}
          disabled={clearing}
          className="mt-2 rounded-xl bg-[#FDEEEE] px-4 py-2 text-sm text-[#B9736F] disabled:opacity-60"
        >
          {clearing ? "清空中..." : "清空我的数据"}
        </button>
        {message ? <p className="mt-2 text-xs text-[#7A8792]">{message}</p> : null}
      </Card>

      <Card className="mt-3 pb-6">
        <p className="text-sm font-semibold text-slate-700">关于产品</p>
        <p className="mt-2 text-sm text-slate-600">愈后食光 HealMeal - 复赛网页版。</p>
      </Card>
    </AppContainer>
  );
}
