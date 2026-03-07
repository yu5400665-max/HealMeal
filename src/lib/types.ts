export type UserRole = "patient" | "family";
export type Gender = "female" | "male";
export type MealTemplateMode = "省心版" | "均衡版" | "家常版" | "自定义";
export type MealStylePreference = "中式" | "西式" | "家常" | "清淡" | "轻食";
export type MealSimplifyGoal = "easy" | "balanced" | "gentle";

export interface MealCountConfig {
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
}

export type DietStage = "流食" | "软食" | "清淡" | "少油" | "少盐" | "温热" | "高蛋白";
export type SymptomType = "无" | "恶心" | "吞咽不适" | "胀气" | "便秘" | "食欲差" | "咽痛";
export type NauseaLevel = "无" | "轻" | "中" | "重";

export interface Profile {
  role: UserRole;
  nickname: string;
  age: number;
  gender: Gender;
  height?: number;
  weight?: number;
  surgeryDate?: string;
  postOpDay?: number;

  surgeryCategory?: string;
  surgeryName?: string;
  surgeryCustomName?: string;
  surgeryDisplayName?: string;
  chronicDiseaseGroup?: string;
  chronicConditions?: string[];

  allergens?: string[];
  longTermAvoidFoods?: string[];
  pantryFoods?: string[];
  region?: string;
  familyLinkEnabled?: boolean;
  privacyConsentAccepted?: boolean;
  privacyConsentAt?: string;
  supabaseUserId?: string;

  // backward compatibility
  surgeryCustom?: string;
  surgeryFinal?: string;
  dietPreferences?: string[];
  avoidFoods?: string[];
  cookingPrefs?: string[];

  createdAt: string;
  updatedAt: string;
}

export interface MealSettingsDynamic {
  date: string;
  dietStage: DietStage;
  symptom: SymptomType;
  appetite: "差" | "一般" | "好";
  mealTemplate?: MealTemplateMode;
  customMealCounts?: MealCountConfig;
  stylePreference?: MealStylePreference;
  simplifyGoal?: MealSimplifyGoal;
  nauseaLevel: NauseaLevel;
  dietModes: string[];
  avoidFoods: string[];
  customAvoidFoods?: string[];
  availableIngredients: string;
  cookingTimeMinutes: number;
  strategyHint: string;
  updatedAt: string;
}

export interface TodayState {
  appetite?: "好" | "一般" | "差";
  mealTemplate?: MealTemplateMode;
  customMealCounts?: MealCountConfig;
  stylePreference?: MealStylePreference;
  simplifyGoal?: MealSimplifyGoal;
  throatDiscomfort?: "是" | "否";
  fatigue?: "轻" | "中" | "重";
  nauseaOrSwallowIssue?: string;
  nauseaLevel?: NauseaLevel;
  dietMode?: string[];
  avoidFoods?: string[];
  customAvoidFoods?: string[];
  dietStage?: DietStage;
  symptom?: SymptomType;
  availableIngredients?: string[];
  cookingTimeMinutes?: number;
}

export interface NutritionInfo {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealDish {
  id: string;
  mealType: "早餐" | "午餐" | "晚餐" | "加餐";
  slotLabel?: string;
  dishName: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  estimatedMinutes?: number;
  safetyLabel: string;
  cautionNote: string;
  alternatives: string[];
  whyThisMeal: string;
  nutrition: NutritionInfo;
  imageUrl?: string;
  adopted?: boolean;
  completed?: boolean;
}

export interface MealPlan {
  date: string;
  disclaimer: string;
  basisSummary: string;
  contextSummary?: string;
  meals: MealDish[];
}

export interface DailyCheckin {
  date: string;
  mealCompletion: number;
  mealCompletionAuto: number;
  mealDoneMeals?: Array<"早餐" | "午餐" | "晚餐" | "加餐">;
  mealCompletionManualAdjust?: number;
  exerciseType?: string;
  exerciseMinutes: number;
  exerciseGoalMinutes?: number;
  exerciseCompleted?: boolean;
  distanceMeters?: number;
  intensity?: "低" | "中" | "高";
  waterMl: number;
  waterGoalMl?: number;
  waterCompleted?: boolean;
  lastCompletedMealKey?: string;
  mood: string;
  notes: string;
  noteSummary?: string;
  notePrivacy?: "public" | "private" | "family";
  aiSummary?: string;
  familyShareDraft?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckinPreferences {
  exerciseGoalMinutes: number;
  waterGoalMl: number;
}

export interface PublishDraft {
  title: string;
  content: string;
  tags: string[];
  source?: "checkin";
  createdAt: string;
}

export interface EcoPost {
  id: string;
  user: string;
  surgeryTag: string;
  postOpDay: number;
  category: "术后饮食" | "康复训练" | "情绪陪伴" | "家属经验";
  title: string;
  content: string;
  imageUrl?: string;
  imageUrls?: string[];
  tags: string[];
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  privacy: "public" | "private";
  createdAt: string;
  updatedAt: string;
}

export interface AiChatRecord {
  id: string;
  mode:
    | "meal-qa"
    | "home"
    | "meal"
    | "exercise"
    | "emotion"
    | "family"
    | "journal-summary"
    | "emotion-summary"
    | "checkin-summary"
    | "family-encourage"
    | "general";
  question: string;
  answer: string;
  date: string;
  createdAt: string;
}

export interface FamilyMessage {
  id: string;
  content: string;
  createdAt: string;
}

export interface FamilyTask {
  id: string;
  date: string;
  title: string;
  time?: string;
  note?: string;
  assignee?: string;
  remind?: boolean;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface AppSettings {
  hasSeenDisclaimer: boolean;
}
