import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/src/lib/supabase/server";

export async function POST() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      ok: true,
      message: "Supabase 未配置，仅清空本地数据。"
    });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      ok: true,
      message: "未检测到社区登录会话，仅清空本地数据。"
    });
  }

  await Promise.all([
    supabase.from("likes").delete().eq("user_id", user.id),
    supabase.from("bookmarks").delete().eq("user_id", user.id),
    supabase.from("comments").delete().eq("author_id", user.id),
    supabase.from("posts").delete().eq("author_id", user.id),
    supabase.from("profiles").delete().eq("id", user.id)
  ]);

  return NextResponse.json({
    ok: true,
    message: "已删除你的社区关联数据。"
  });
}
