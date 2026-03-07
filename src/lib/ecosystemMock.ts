export interface EcosystemPost {
  id: string;
  category: "术后饮食" | "康复训练" | "情绪陪伴" | "家属经验";
  user: string;
  roleHint: string;
  title: string;
  content: string;
  tags: string[];
  cover: string;
  likes: number;
  favorites: number;
  comments: number;
  shares: number;
  time: string;
}

export const ECOSYSTEM_POSTS: EcosystemPost[] = [
  {
    id: "p1",
    category: "术后饮食",
    user: "术后小雨",
    roleHint: "甲状腺术后 Day 21",
    title: "一周清淡餐单这样搭，胃舒服很多",
    content: "我把早餐改成南瓜粥+蒸蛋，午晚餐尽量蒸煮炖，三天后明显不胀了。",
    tags: ["清淡", "软食", "恢复期"],
    cover: "/meal-placeholder.svg",
    likes: 128,
    favorites: 57,
    comments: 19,
    shares: 12,
    time: "2小时前"
  },
  {
    id: "p2",
    category: "康复训练",
    user: "慢慢走",
    roleHint: "骨科术后 Day 36",
    title: "从每天10分钟拉伸开始，不焦虑",
    content: "把目标从1小时改成10分钟后更容易坚持，身体也没那么僵硬。",
    tags: ["拉伸", "循序渐进", "坚持"],
    cover: "/meal-placeholder.svg",
    likes: 96,
    favorites: 41,
    comments: 14,
    shares: 8,
    time: "5小时前"
  },
  {
    id: "p3",
    category: "情绪陪伴",
    user: "今天也要好好吃饭",
    roleHint: "术后家属",
    title: "情绪低落时，我会这样和自己说",
    content: "恢复慢一点没关系，今天能按时吃一餐、喝够水，就是很棒的进步。",
    tags: ["情绪", "鼓励", "陪伴"],
    cover: "/meal-placeholder.svg",
    likes: 143,
    favorites: 88,
    comments: 26,
    shares: 17,
    time: "昨天"
  },
  {
    id: "p4",
    category: "家属经验",
    user: "陪护阿姨",
    roleHint: "家属陪护",
    title: "给长辈做饭的三个小技巧",
    content: "提前备菜、一次少做、温热上桌，既减轻负担也能保证饮食节奏。",
    tags: ["家属", "备餐", "实操"],
    cover: "/meal-placeholder.svg",
    likes: 72,
    favorites: 32,
    comments: 11,
    shares: 9,
    time: "昨天"
  }
];
