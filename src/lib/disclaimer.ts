export const SINGLE_MEDICAL_NOTICE =
  "仅供参考，不替代医生建议。";

const DISCLAIMER_PATTERNS = [
  /仅供参考[，,、。；; ]*不替代医生建议[。!！]*/g,
  /不替代医生建议[。!！]*/g
];

export function stripMedicalDisclaimer(text: string) {
  if (!text) return "";
  let result = text;
  DISCLAIMER_PATTERNS.forEach((pattern) => {
    result = result.replace(pattern, "");
  });
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

