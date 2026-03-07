export function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function computePostOpDay(surgeryDate?: string) {
  if (!surgeryDate) return undefined;
  const target = new Date(surgeryDate + "T00:00:00");
  if (Number.isNaN(target.getTime())) return undefined;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const base = target.getTime();
  const diff = Math.floor((today - base) / (24 * 60 * 60 * 1000)) + 1;
  return diff > 0 ? diff : 1;
}

export function getPartOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "上午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}
