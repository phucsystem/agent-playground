import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;

  const supabaseUser = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabaseUser.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = getSupabaseAdmin();

  const { data: caller } = await adminClient
    .from("users")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (!caller || caller.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { data: conversation } = await adminClient
    .from("conversations")
    .select("id, type")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: storagePaths } = await adminClient
    .from("attachments")
    .select("storage_path")
    .in(
      "message_id",
      await adminClient
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .then(({ data }) => (data ?? []).map((msg) => msg.id))
    );

  const { error: deleteError } = await adminClient
    .from("conversations")
    .delete()
    .eq("id", conversationId);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete conversation", details: deleteError.message },
      { status: 500 }
    );
  }

  if (storagePaths && storagePaths.length > 0) {
    const paths = storagePaths.map((attachment) => attachment.storage_path);
    await adminClient.storage.from("attachments").remove(paths);
  }

  return NextResponse.json({ success: true });
}
