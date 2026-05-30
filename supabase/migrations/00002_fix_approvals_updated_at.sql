-- Fix: approvals table was missing updated_at column required by its trigger
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
