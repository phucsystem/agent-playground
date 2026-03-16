-- Enable realtime on conversations table for DELETE events (sidebar refresh)
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
