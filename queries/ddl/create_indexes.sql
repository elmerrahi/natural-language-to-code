CREATE INDEX IF NOT EXISTS idx_connections_api_key
    ON connections(api_key_id);

CREATE INDEX IF NOT EXISTS idx_query_history_lookup
    ON query_history(api_key_id, connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_events_lookup
    ON usage_events(api_key_id, created_at);
