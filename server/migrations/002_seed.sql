-- Seed devices (if empty)
INSERT OR IGNORE INTO devices (id, name, platform, firmware, first_seen, last_seen, status, metadata)
VALUES 
  ('esp32-01', 'ESP32-01 (Living Room)', 'esp32', 'v5.0.0-beta1', strftime('%s','now')*1000 - 86400000, strftime('%s','now')*1000, 'online', '{"location":"living_room","battery":87,"rssi":-45}'),
  ('esp32-02', 'ESP32-02 (Kitchen)', 'esp32', 'v5.0.0-beta1', strftime('%s','now')*1000 - 172800000, strftime('%s','now')*1000 - 30000, 'degraded', '{"location":"kitchen","battery":62,"rssi":-68}'),
  ('esp32-03', 'ESP32-03 (Garage)', 'esp32', 'v5.0.0-beta1', strftime('%s','now')*1000 - 259200000, strftime('%s','now')*1000 - 120000, 'offline', '{"location":"garage","battery":41,"rssi":-82}');

-- Seed a sample command
INSERT OR IGNORE INTO commands (device_id, command, payload, sent_at, delivered_at, executed_at, confirmed_at, status)
VALUES (
  'esp32-01',
  'led',
  '{"state": true}',
  strftime('%s','now')*1000 - 60000,
  strftime('%s','now')*1000 - 59000,
  strftime('%s','now')*1000 - 58500,
  strftime('%s','now')*1000 - 58000,
  'confirmed'
);
