-- Trigram index on item names (search) needs pg_trgm. Neon supports it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
