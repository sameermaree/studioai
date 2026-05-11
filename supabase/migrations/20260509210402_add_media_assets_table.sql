/*
  # Add Media Assets Table

  1. New Tables
    - `media_assets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text) - filename or display name
      - `type` (text) - image, video, or audio
      - `url` (text) - storage URL
      - `thumbnail_url` (text, nullable) - preview thumbnail
      - `tags` (text[]) - searchable tags
      - `size_bytes` (bigint) - file size
      - `mime_type` (text) - MIME type
      - `metadata` (jsonb) - width, height, duration, etc.
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Users can only access their own media assets

  3. Indexes
    - user_id for ownership queries
    - type for filtering by media type
*/

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'image',
  url text NOT NULL,
  thumbnail_url text,
  tags text[] NOT NULL DEFAULT '{}',
  size_bytes bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own media assets"
  ON media_assets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own media assets"
  ON media_assets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own media assets"
  ON media_assets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own media assets"
  ON media_assets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(type);
