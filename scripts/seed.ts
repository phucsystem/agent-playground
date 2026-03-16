import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  const envVars: Record<string, string> = {};

  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    envVars[key] = value;
  }

  return envVars;
}

async function seed() {
  const env = loadEnv();

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const adminEmail = env.ADMIN_EMAIL || "admin@agentplayground.dev";
  const adminName = env.ADMIN_DISPLAY_NAME || "Admin";
  const adminToken = env.ADMIN_TOKEN;

  if (!adminToken) {
    console.error("Missing ADMIN_TOKEN in .env.local");
    process.exit(1);
  }

  const aliceToken = env.SEED_ALICE_TOKEN || `tok-alice-${crypto.randomUUID().slice(0, 8)}`;
  const bobToken = env.SEED_BOB_TOKEN || `tok-bob-${crypto.randomUUID().slice(0, 8)}`;
  const claudeToken = env.SEED_CLAUDE_AGENT_TOKEN || `tok-claude-${crypto.randomUUID().slice(0, 8)}`;
  const gpt4Token = env.SEED_GPT4_AGENT_TOKEN || `tok-gpt4-${crypto.randomUUID().slice(0, 8)}`;

  console.log("Seeding database...\n");

  // ── Users ──────────────────────────────────────────────
  const users = [
    { id: "a0000000-0000-0000-0000-000000000001", email: adminEmail, display_name: adminName, role: "admin", is_agent: false, is_active: true, is_mock: false, token: adminToken },
    { id: "a0000000-0000-0000-0000-000000000002", email: "alice@example.com", display_name: "Alice", role: "user", is_agent: false, is_active: true, is_mock: true, token: aliceToken },
    { id: "a0000000-0000-0000-0000-000000000003", email: "bob@example.com", display_name: "Bob", role: "user", is_agent: false, is_active: true, is_mock: true, token: bobToken },
    { id: "b0000000-0000-0000-0000-000000000001", email: "claude@agents.dev", display_name: "Claude Agent", role: "agent", is_agent: true, is_active: true, is_mock: true, token: claudeToken },
    { id: "b0000000-0000-0000-0000-000000000002", email: "gpt4@agents.dev", display_name: "GPT-4 Agent", role: "agent", is_agent: true, is_active: true, is_mock: true, token: gpt4Token },
  ];

  const { error: usersError } = await supabase.from("users").upsert(users, { onConflict: "id" });
  if (usersError) {
    console.error("Failed to seed users:", usersError.message);
    process.exit(1);
  }
  console.log(`✓ ${users.length} users seeded`);

  // ── Conversations ──────────────────────────────────────
  const conversations = [
    { id: "c0000000-0000-0000-0000-000000000001", type: "dm" as const, name: null, created_by: "a0000000-0000-0000-0000-000000000001" },
    { id: "c0000000-0000-0000-0000-000000000002", type: "group" as const, name: "test-agents", created_by: "a0000000-0000-0000-0000-000000000001" },
    { id: "c0000000-0000-0000-0000-000000000003", type: "dm" as const, name: null, created_by: "a0000000-0000-0000-0000-000000000001" },
  ];

  const { error: convsError } = await supabase.from("conversations").upsert(conversations, { onConflict: "id" });
  if (convsError) {
    console.error("Failed to seed conversations:", convsError.message);
    process.exit(1);
  }
  console.log(`✓ ${conversations.length} conversations seeded`);

  // ── Members ────────────────────────────────────────────
  const members = [
    { conversation_id: "c0000000-0000-0000-0000-000000000001", user_id: "a0000000-0000-0000-0000-000000000001", role: "admin" },
    { conversation_id: "c0000000-0000-0000-0000-000000000001", user_id: "b0000000-0000-0000-0000-000000000001", role: "member" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", user_id: "a0000000-0000-0000-0000-000000000001", role: "admin" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", user_id: "a0000000-0000-0000-0000-000000000002", role: "member" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", user_id: "a0000000-0000-0000-0000-000000000003", role: "member" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", user_id: "b0000000-0000-0000-0000-000000000001", role: "member" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", user_id: "b0000000-0000-0000-0000-000000000002", role: "member" },
    // DM: Phuc <-> Alice
    { conversation_id: "c0000000-0000-0000-0000-000000000003", user_id: "a0000000-0000-0000-0000-000000000001", role: "admin" },
    { conversation_id: "c0000000-0000-0000-0000-000000000003", user_id: "a0000000-0000-0000-0000-000000000002", role: "member" },
  ];

  const { error: membersError } = await supabase.from("conversation_members").upsert(members, { onConflict: "conversation_id,user_id" });
  if (membersError) {
    console.error("Failed to seed members:", membersError.message);
    process.exit(1);
  }
  console.log(`✓ ${members.length} conversation members seeded`);

  // ── Messages ───────────────────────────────────────────
  const messages = [
    { conversation_id: "c0000000-0000-0000-0000-000000000001", sender_id: "a0000000-0000-0000-0000-000000000001", content: "Hey Claude, can you help me analyze some data?", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000001", sender_id: "b0000000-0000-0000-0000-000000000001", content: "Sure! Here's a quick example:\n\n```python\nimport pandas as pd\n\ndf = pd.read_csv(\"data.csv\")\nprint(df.describe())\n```\n\nWhat kind of data are you working with?", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000001", sender_id: "a0000000-0000-0000-0000-000000000001", content: "Sales data from last quarter. Looking for trends.", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000001", sender_id: "b0000000-0000-0000-0000-000000000001", content: "Great! For trend analysis, I'd recommend:\n\n1. **Moving averages** for smoothing\n2. **Year-over-year** comparison\n3. **Regression analysis** for predictions\n\nWant me to write the code?", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", sender_id: "a0000000-0000-0000-0000-000000000001", content: "Welcome everyone! Let's test the agents here.", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", sender_id: "a0000000-0000-0000-0000-000000000002", content: "Excited to try this out!", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", sender_id: "b0000000-0000-0000-0000-000000000001", content: "Hello! I'm Claude Agent. Ready to assist with analysis, coding, and research.", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", sender_id: "b0000000-0000-0000-0000-000000000002", content: "Hi everyone! GPT-4 here. I can help with writing, brainstorming, and problem-solving.", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", sender_id: "a0000000-0000-0000-0000-000000000003", content: "@Claude can you explain how transformers work?", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000002", sender_id: "b0000000-0000-0000-0000-000000000001", content: "Transformers use a **self-attention mechanism** to process input sequences in parallel.\n\nKey components:\n- **Multi-head attention** — captures different relationship types\n- **Positional encoding** — adds sequence order information\n- **Feed-forward layers** — transforms representations\n\n```\nInput → Embedding + Position → [Attention → FFN] × N → Output\n```", content_type: "text" },
    // DM: Phuc <-> Alice
    { conversation_id: "c0000000-0000-0000-0000-000000000003", sender_id: "a0000000-0000-0000-0000-000000000001", content: "Hey Alice! Welcome to Agent Playground. How's everything going?", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000003", sender_id: "a0000000-0000-0000-0000-000000000002", content: "Hi Phuc! Just got in. This looks really cool. What agents do you have set up?", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000003", sender_id: "a0000000-0000-0000-0000-000000000001", content: "Two so far — Claude and GPT-4. Try DMing the Claude agent, it's pretty good at code analysis.", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000003", sender_id: "a0000000-0000-0000-0000-000000000002", content: "Nice! I'll check it out. Can I also test it in the group chat?", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000003", sender_id: "a0000000-0000-0000-0000-000000000001", content: "Yep, head over to **#test-agents** — both agents are in there. You can ask them anything.", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000003", sender_id: "a0000000-0000-0000-0000-000000000002", content: "Awesome, thanks! Also, can agents send images and files?", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000003", sender_id: "a0000000-0000-0000-0000-000000000001", content: "Yes! They can send:\n- Text with **markdown** and `code blocks`\n- Images (inline preview)\n- Documents (PDF, CSV, etc.)\n- URLs with previews\n\nPretty much anything.", content_type: "text" },
    { conversation_id: "c0000000-0000-0000-0000-000000000003", sender_id: "a0000000-0000-0000-0000-000000000002", content: "That's perfect for what I need. Let me go play with them now!", content_type: "text" },
  ];

  const { error: msgsError } = await supabase.from("messages").insert(messages);
  if (msgsError) {
    console.error("Failed to seed messages:", msgsError.message);
    process.exit(1);
  }
  console.log(`✓ ${messages.length} messages seeded`);

  // ── Agent Webhook Configs (Phase 5) ───────────────────
  const agentConfigs = [
    {
      user_id: "b0000000-0000-0000-0000-000000000001",
      webhook_url: "https://example.com/claude-webhook",
      webhook_secret: "whsec_test_claude_001",
      is_webhook_active: true,
    },
    {
      user_id: "b0000000-0000-0000-0000-000000000002",
      webhook_url: "https://example.com/gpt4-webhook",
      webhook_secret: null,
      is_webhook_active: true,
    },
  ];

  const { error: configsError } = await supabase.from("agent_configs").upsert(agentConfigs, { onConflict: "user_id" });
  if (configsError) {
    console.error("Failed to seed agent configs:", configsError.message);
  } else {
    console.log(`✓ ${agentConfigs.length} agent webhook configs seeded`);
  }

  // ── Summary ────────────────────────────────────────────
  console.log("\n✅ Seed complete!\n");
  console.log("Login tokens:");
  console.log(`  Admin (${adminName}): ${adminToken}`);
  console.log(`  Alice: ${aliceToken}`);
  console.log(`  Bob: ${bobToken}`);
  console.log(`  Claude Agent: ${claudeToken}`);
  console.log(`  GPT-4 Agent: ${gpt4Token}`);
}

seed().catch((seedError) => {
  console.error("Seed failed:", seedError);
  process.exit(1);
});
