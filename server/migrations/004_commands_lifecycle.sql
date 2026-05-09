-- افزودن فیلدهای lifecycle کامل برای Command Center
ALTER TABLE commands ADD COLUMN delivered_transport TEXT;
ALTER TABLE commands ADD COLUMN executed_transport TEXT;
ALTER TABLE commands ADD COLUMN confirmed_transport TEXT;
ALTER TABLE commands ADD COLUMN delivered_msg_id TEXT;
ALTER TABLE commands ADD COLUMN executed_msg_id TEXT;
ALTER TABLE commands ADD COLUMN confirmed_msg_id TEXT;
ALTER TABLE commands ADD COLUMN delivery_rtt_ms INTEGER;
ALTER TABLE commands ADD COLUMN execution_rtt_ms INTEGER;
ALTER TABLE commands ADD COLUMN confirmation_rtt_ms INTEGER;
ALTER TABLE commands ADD COLUMN error_code TEXT;
ALTER TABLE commands ADD COLUMN error_message TEXT;

-- Indexes برای query سریع تاریخچه و فیلتر
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);
CREATE INDEX IF NOT EXISTS idx_commands_sent_at ON commands(sent_at DESC);
