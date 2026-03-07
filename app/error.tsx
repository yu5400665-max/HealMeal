"use client";

import AppContainer from "@/components/AppContainer";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <AppContainer withNav={false}>
      <div className="mt-10 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-slate-800">页面出现异常</h2>
        <p className="mt-2 text-sm text-slate-600">请稍后重试，或返回首页继续使用。</p>
        <button
          onClick={() => reset()}
          className="mt-4 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white"
        >
          重新加载
        </button>
      </div>
    </AppContainer>
  );
}
