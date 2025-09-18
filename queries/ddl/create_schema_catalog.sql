CREATE TABLE IF NOT EXISTS schema_catalog (
    connection_id UUID PRIMARY KEY REFERENCES connections(id) ON DELETE CASCADE,
    schema_xml TEXT NOT NULL,
    introspected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
