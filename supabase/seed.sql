-- ============================================================
-- Seed Data: Agent Playground
-- ============================================================

-- Human users
INSERT INTO users (id, email, display_name, is_agent, is_active, token) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'admin@agentplayground.dev', 'Phuc', false, true, 'tok-admin-001'),
  ('a0000000-0000-0000-0000-000000000002', 'alice@example.com', 'Alice', false, true, 'tok-alice-002'),
  ('a0000000-0000-0000-0000-000000000003', 'bob@example.com', 'Bob', false, true, 'tok-bob-003');

-- Agent users
INSERT INTO users (id, email, display_name, is_agent, is_active, token) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'claude@agents.dev', 'Claude Agent', true, true, 'tok-claude-agent-001'),
  ('b0000000-0000-0000-0000-000000000002', 'gpt4@agents.dev', 'GPT-4 Agent', true, true, 'tok-gpt4-agent-002');

-- DM conversation: Phuc <-> Claude Agent
INSERT INTO conversations (id, type, name, created_by) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'dm', NULL, 'a0000000-0000-0000-0000-000000000001');

INSERT INTO conversation_members (conversation_id, user_id, role) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'member');

-- Group conversation: test-agents
INSERT INTO conversations (id, type, name, created_by) VALUES
  ('c0000000-0000-0000-0000-000000000002', 'group', 'test-agents', 'a0000000-0000-0000-0000-000000000001');

INSERT INTO conversation_members (conversation_id, user_id, role) VALUES
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'admin'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'member'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'member'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'member'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'member');

-- Sample messages in DM
INSERT INTO messages (conversation_id, sender_id, content, content_type) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Hey Claude, can you help me analyze some data?', 'text'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', E'Sure! Here''s a quick example:\n\n```python\nimport pandas as pd\n\ndf = pd.read_csv("data.csv")\nprint(df.describe())\n```\n\nWhat kind of data are you working with?', 'text'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Sales data from last quarter. Looking for trends.', 'text'),
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', E'Great! For trend analysis, I''d recommend:\n\n1. **Moving averages** for smoothing\n2. **Year-over-year** comparison\n3. **Regression analysis** for predictions\n\nWant me to write the code?', 'text');

-- Sample messages in group
INSERT INTO messages (conversation_id, sender_id, content, content_type) VALUES
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Welcome everyone! Let''s test the agents here.', 'text'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Excited to try this out!', 'text'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Hello! I''m Claude Agent. Ready to assist with analysis, coding, and research.', 'text'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Hi everyone! GPT-4 here. I can help with writing, brainstorming, and problem-solving.', 'text'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', '@Claude can you explain how transformers work?', 'text'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', E'Transformers use a **self-attention mechanism** to process input sequences in parallel.\n\nKey components:\n- **Multi-head attention** — captures different relationship types\n- **Positional encoding** — adds sequence order information\n- **Feed-forward layers** — transforms representations\n\n```\nInput → Embedding + Position → [Attention → FFN] × N → Output\n```', 'text');
