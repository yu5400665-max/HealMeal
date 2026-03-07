"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppContainer from "@/components/AppContainer";
import Card from "@/components/Card";
import PageTitle from "@/components/PageTitle";
import WheelPicker from "@/components/WheelPicker";
import { ALLERGEN_TAGS, AVOID_TAGS, SURGERY_OPTIONS } from "@/src/lib/constants";
import { computePostOpDay } from "@/src/lib/date";
import { getProfile, setProfile } from "@/src/lib/storage";
import type { Gender, Profile, UserRole } from "@/src/lib/types";

const AGE_OPTIONS = Array.from({ length: 100 }, (_, i) => i + 1);
const HEIGHT_OPTIONS = Array.from({ length: 121 }, (_, i) => i + 100);
const WEIGHT_OPTIONS = Array.from({ length: 171 }, (_, i) => i + 30);

const CUSTOM_HINTS = [
  "甲状腺切除术后",
  "甲状腺结节术后",
  "甲状旁腺术后",
  "胃部手术术后",
  "肠道手术术后",
  "扁桃体术后",
  "关节置换术后",
  "疝修补术后"
];

const CHRONIC_DISEASE_GROUP_OPTIONS = ["无", "三高代谢", "心脑血管", "呼吸系统", "消化系统", "肾脏泌尿", "免疫风湿", "其他"];
const TRI_HIGH_OPTIONS = ["高血压", "高血脂", "高血糖"];

function TagSelector({
  label,
  options,
  value,
  onToggle
}: {
  label: string;
  options: string[];
  value: string[];
  onToggle: (item: string) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[14px] text-[#636E72]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className={`rounded-full px-3 py-1 text-[13px] ${
              value.includes(item) ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();

  const [role, setRole] = useState<UserRole>("patient");
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<Gender>("female");
  const [age, setAge] = useState("30");
  const [height, setHeight] = useState("165");
  const [weight, setWeight] = useState("55");
  const [surgeryDate, setSurgeryDate] = useState("");

  const [surgeryCategory, setSurgeryCategory] = useState(Object.keys(SURGERY_OPTIONS)[0]);
  const [surgeryName, setSurgeryName] = useState(SURGERY_OPTIONS[Object.keys(SURGERY_OPTIONS)[0]][0] || "");
  const [surgeryCustomName, setSurgeryCustomName] = useState("");
  const [chronicDiseaseGroup, setChronicDiseaseGroup] = useState("无");
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);

  const [allergens, setAllergens] = useState<string[]>([]);
  const [longTermAvoidFoods, setLongTermAvoidFoods] = useState<string[]>([]);
  const [pantryFoodsText, setPantryFoodsText] = useState("");
  const [region, setRegion] = useState("");
  const [familyLinkEnabled, setFamilyLinkEnabled] = useState(true);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const profile = getProfile();
    if (!profile) return;

    const category =
      profile.surgeryCategory && SURGERY_OPTIONS[profile.surgeryCategory]
        ? profile.surgeryCategory
        : Object.keys(SURGERY_OPTIONS)[0];

    setRole(profile.role || "patient");
    setNickname(profile.nickname || "");
    setGender(profile.gender === "male" ? "male" : "female");
    setAge(String(profile.age || 30));
    setHeight(String(profile.height || 165));
    setWeight(String(profile.weight || 55));
    setSurgeryDate(profile.surgeryDate || "");
    setSurgeryCategory(category);
    setSurgeryName(profile.surgeryName || (SURGERY_OPTIONS[category] || [""])[0] || "");
    setSurgeryCustomName(profile.surgeryCustomName || "");
    setChronicDiseaseGroup(profile.chronicDiseaseGroup || "无");
    setChronicConditions(profile.chronicConditions || []);
    setAllergens(profile.allergens || []);
    setLongTermAvoidFoods(profile.longTermAvoidFoods || profile.avoidFoods || []);
    setPantryFoodsText((profile.pantryFoods || []).join("，"));
    setRegion(profile.region || "");
    setFamilyLinkEnabled(Boolean(profile.familyLinkEnabled));
    setPrivacyAccepted(profile.privacyConsentAccepted ?? true);
  }, []);

  const surgeryNameOptions = useMemo(() => {
    const list = SURGERY_OPTIONS[surgeryCategory] || [];
    return list.length > 0 ? list : ["未匹配，建议自定义输入"];
  }, [surgeryCategory]);

  const customSuggestions = useMemo(() => {
    const all = Array.from(new Set([...CUSTOM_HINTS, ...Object.values(SURGERY_OPTIONS).flat()]));
    const keyword = surgeryCustomName.trim();
    if (!keyword) return all.slice(0, 8);
    return all
      .filter((item) => item.includes(keyword))
      .sort((a, b) => {
        const scoreA = a.startsWith(keyword) ? 2 : a.includes(keyword) ? 1 : 0;
        const scoreB = b.startsWith(keyword) ? 2 : b.includes(keyword) ? 1 : 0;
        if (keyword.startsWith("甲")) {
          const mA = a.startsWith("甲") ? 1 : 0;
          const mB = b.startsWith("甲") ? 1 : 0;
          return mB - mA || scoreB - scoreA;
        }
        return scoreB - scoreA;
      })
      .slice(0, 8);
  }, [surgeryCustomName]);

  const surgeryDisplayName = useMemo(() => {
    const custom = surgeryCustomName.trim();
    if (custom) return custom;
    return surgeryName;
  }, [surgeryName, surgeryCustomName]);

  const toggleArray = (list: string[], setter: (next: string[]) => void, value: string) => {
    if (list.includes(value)) {
      setter(list.filter((item) => item !== value));
    } else {
      setter([...list, value]);
    }
  };

  const handleSave = () => {
    setError("");
    if (!nickname.trim()) {
      setError("请填写昵称");
      return;
    }

    if (!surgeryDisplayName) {
      setError("请至少选择或填写一个手术名称");
      return;
    }

    if (!privacyAccepted) {
      setError("请先阅读并同意《隐私说明》");
      return;
    }

    const now = new Date().toISOString();
    const profile: Profile = {
      role,
      nickname: nickname.trim(),
      gender,
      age: Number(age),
      height: Number(height),
      weight: Number(weight),
      surgeryDate: surgeryDate || undefined,
      postOpDay: computePostOpDay(surgeryDate),
      surgeryCategory,
      surgeryName,
      surgeryCustomName: surgeryCustomName.trim() || undefined,
      surgeryDisplayName,
      chronicDiseaseGroup,
      chronicConditions,
      allergens,
      longTermAvoidFoods,
      pantryFoods: pantryFoodsText
        .split(/[，,]/)
        .map((item) => item.trim())
        .filter(Boolean),
      region: region.trim() || undefined,
      familyLinkEnabled,
      privacyConsentAccepted: true,
      privacyConsentAt: now,
      // compatibility
      surgeryFinal: surgeryDisplayName,
      avoidFoods: longTermAvoidFoods,
      createdAt: now,
      updatedAt: now
    };

    setProfile(profile);
    router.push("/");
  };

  return (
    <AppContainer withNav={false}>
      <PageTitle title="建档" subtitle="单页建档，保存长期稳定信息" />

      <Card className="mb-3 bg-[#F4F8FF]">
        <p className="text-[17px] font-semibold text-[#2C3E50]">Hi ！请放心，我们只做陪伴，不会打扰</p>
        <p className="mt-2 text-[14px] leading-6 text-[#636E72]">
          我们会记录昵称、身体指标、手术信息、过敏与忌口，用来生成更贴合你的饮食和恢复建议。你可以随时修改，也可以在设置里一键删除。
        </p>
        <Link href="/privacy" className="mt-2 inline-block text-[13px] font-medium text-[#8AB4F8]">
          查看《隐私说明》
        </Link>
      </Card>

      <Card>
        <p className="text-[18px] font-semibold text-[#2C3E50]">基本信息</p>

        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-2 text-[14px] text-[#636E72]">角色</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("patient")}
                className={`rounded-xl py-2 text-[14px] ${
                  role === "patient" ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"
                }`}
              >
                患者本人
              </button>
              <button
                type="button"
                onClick={() => setRole("family")}
                className={`rounded-xl py-2 text-[14px] ${
                  role === "family" ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"
                }`}
              >
                家属陪护
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[14px] text-[#636E72]">昵称</label>
            <input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              className="w-full rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[15px]"
              placeholder="请输入昵称（可用代号）"
            />
          </div>

          <div>
            <p className="mb-2 text-[14px] text-[#636E72]">性别</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`rounded-xl py-2 text-[14px] ${
                  gender === "female" ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"
                }`}
              >
                女
              </button>
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`rounded-xl py-2 text-[14px] ${
                  gender === "male" ? "bg-[#8AB4F8] text-white" : "bg-[#EEF4FF] text-[#636E72]"
                }`}
              >
                男
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <WheelPicker label="年龄" options={AGE_OPTIONS} value={age} onChange={setAge} />
            <WheelPicker label="身高(cm)" options={HEIGHT_OPTIONS} value={height} onChange={setHeight} />
            <WheelPicker label="体重(kg)" options={WEIGHT_OPTIONS} value={weight} onChange={setWeight} />
          </div>

          <div>
            <label className="mb-1 block text-[14px] text-[#636E72]">地区（可选，用于天气）</label>
            <input
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              className="w-full rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[15px]"
              placeholder="例如：深圳"
            />
          </div>
        </div>
      </Card>

      <Card className="mt-3">
        <p className="text-[18px] font-semibold text-[#2C3E50]">手术信息</p>
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-[14px] text-[#636E72]">手术日期</label>
            <input
              type="date"
              value={surgeryDate}
              onChange={(event) => setSurgeryDate(event.target.value)}
              className="w-full rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[15px]"
            />
          </div>

          <WheelPicker
            label="一级分类"
            options={Object.keys(SURGERY_OPTIONS)}
            value={surgeryCategory}
            onChange={(value) => {
              setSurgeryCategory(value);
              setSurgeryName((SURGERY_OPTIONS[value] || [""])[0] || "");
            }}
          />

          <WheelPicker label="二级手术名称" options={surgeryNameOptions} value={surgeryName} onChange={setSurgeryName} />

          <div>
            <label className="mb-1 block text-[14px] text-[#636E72]">自定义手术名（联想）</label>
            <input
              list="surgery-custom-list"
              value={surgeryCustomName}
              onChange={(event) => setSurgeryCustomName(event.target.value)}
              className="w-full rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[15px]"
              placeholder="例如：甲状腺切除术后"
            />
            <datalist id="surgery-custom-list">
              {customSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <p className="rounded-xl bg-[#EEF4FF] p-2 text-[13px] text-[#636E72]">展示名称：{surgeryDisplayName || "未设置"}</p>
        </div>
      </Card>

      <Card className="mt-3">
        <p className="text-[18px] font-semibold text-[#2C3E50]">慢性病信息</p>
        <div className="mt-3 space-y-3">
          <WheelPicker
            label="慢性病分类"
            options={CHRONIC_DISEASE_GROUP_OPTIONS}
            value={chronicDiseaseGroup}
            onChange={setChronicDiseaseGroup}
          />

          <div>
            <p className="mb-2 text-[14px] text-[#636E72]">三高情况（可多选）</p>
            <div className="grid grid-cols-3 gap-2">
              {TRI_HIGH_OPTIONS.map((item) => (
                <label
                  key={item}
                  className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[13px] ${
                    chronicConditions.includes(item) ? "bg-[#EAF2FF] text-[#47698B]" : "bg-[#EEF4FF] text-[#636E72]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={chronicConditions.includes(item)}
                    onChange={() => toggleArray(chronicConditions, setChronicConditions, item)}
                    className="h-3.5 w-3.5 accent-[#8AB4F8]"
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-3">
        <p className="text-[18px] font-semibold text-[#2C3E50]">长期偏好</p>
        <div className="mt-3 space-y-3">
          <TagSelector
            label="过敏原"
            options={ALLERGEN_TAGS}
            value={allergens}
            onToggle={(value) => toggleArray(allergens, setAllergens, value)}
          />

          <TagSelector
            label="长期忌口"
            options={AVOID_TAGS}
            value={longTermAvoidFoods}
            onToggle={(value) => toggleArray(longTermAvoidFoods, setLongTermAvoidFoods, value)}
          />

          <div>
            <label className="mb-1 block text-[14px] text-[#636E72]">家庭常备食材（可选）</label>
            <input
              value={pantryFoodsText}
              onChange={(event) => setPantryFoodsText(event.target.value)}
              className="w-full rounded-xl border border-[#DDE6F3] bg-white px-3 py-2 text-[15px]"
              placeholder="鸡蛋，豆腐，南瓜"
            />
          </div>

          <label className="flex items-center justify-between rounded-xl bg-[#EEF4FF] p-3 text-[14px] text-[#636E72]">
            是否开启家属联动
            <input
              type="checkbox"
              checked={familyLinkEnabled}
              onChange={(event) => setFamilyLinkEnabled(event.target.checked)}
              className="h-4 w-4 accent-[#8AB4F8]"
            />
          </label>
        </div>
      </Card>

      <Card className="mt-3 bg-[#F4F8FF]">
        <p className="text-[16px] font-semibold text-[#2C3E50]">这些字段会怎么用</p>
        <ul className="mt-2 space-y-1 text-[13px] leading-6 text-[#636E72]">
          <li>昵称：仅用于称呼，可使用代号。</li>
          <li>年龄/身高/体重：用于估算份量与营养范围。</li>
          <li>手术信息：用于匹配术后阶段建议。</li>
          <li>慢性病信息：用于规避不适合的食材与烹饪方式。</li>
          <li>过敏/忌口：用于自动避雷。</li>
        </ul>
        <p className="mt-2 text-[12px] text-[#636E72]">信息仅用于生成建议，不会给第三方；支持设置里一键删除。</p>
      </Card>

      <label className="mt-3 flex items-start gap-2 rounded-2xl bg-[#ffffff] p-3 text-[13px] text-[#636E72]">
        <input
          type="checkbox"
          checked={privacyAccepted}
          onChange={(event) => setPrivacyAccepted(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#8AB4F8]"
        />
        <span>
          我已阅读并同意
          <Link href="/privacy" className="mx-1 text-[#8AB4F8]">
            《隐私说明》
          </Link>
          ，理解可以随时修改或删除数据。
        </span>
      </label>

      {error ? <p className="mt-3 text-[13px] text-[#C27774]">{error}</p> : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={!privacyAccepted}
        className="mt-4 mb-8 w-full rounded-2xl bg-[#8AB4F8] py-3 text-[16px] font-semibold text-white disabled:opacity-50"
      >
        保存并进入首页
      </button>
    </AppContainer>
  );
}
