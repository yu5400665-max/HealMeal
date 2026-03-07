import AppContainer from "@/components/AppContainer";

export default function NotFound() {
  return (
    <AppContainer>
      <div className="mt-10 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold text-slate-800">页面不存在</h2>
        <p className="mt-2 text-sm text-slate-600">你访问的页面暂时不可用。</p>
      </div>
    </AppContainer>
  );
}
