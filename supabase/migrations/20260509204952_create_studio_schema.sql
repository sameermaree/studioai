/*
  # Create AI Content Studio Schema

  1. New Tables
    - `characters`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `description` (text)
      - `image_url` (text, nullable)
      - `reference_images` (jsonb, array of URLs)
      - `tags` (text[])
      - `emotions` (text[])
      - `outfits` (jsonb)
      - `voice_id` (uuid, nullable)
      - `consistency_lock` (boolean)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `episodes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `description` (text)
      - `status` (text)
      - `thumbnail_url` (text, nullable)
      - `duration_estimate` (integer, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `scenes`
      - `id` (uuid, primary key)
      - `episode_id` (uuid, references episodes)
      - `order` (integer)
      - `title` (text)
      - `prompt_id` (uuid, nullable)
      - `prompt_text` (text)
      - `negative_prompt` (text)
      - `characters` (uuid[])
      - `voice_id` (uuid, nullable)
      - `music_url` (text, nullable)
      - `subtitle_text` (text)
      - `duration` (integer)
      - `seed` (integer, nullable)
      - `render_status` (text)
      - `render_url` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `prompts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `category` (text)
      - `template` (text)
      - `negative_prompt` (text)
      - `language` (text)
      - `tags` (text[])
      - `is_preset` (boolean)
      - `seed` (integer, nullable)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `voices`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `language` (text)
      - `provider` (text)
      - `voice_key` (text)
      - `is_cloned` (boolean)
      - `sample_url` (text, nullable)
      - `character_id` (uuid, nullable)
      - `created_at` (timestamptz)

    - `render_jobs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `episode_id` (uuid, nullable)
      - `scene_id` (uuid, nullable)
      - `type` (text)
      - `status` (text)
      - `progress` (integer)
      - `output_url` (text, nullable)
      - `settings` (jsonb)
      - `error_message` (text, nullable)
      - `started_at` (timestamptz, nullable)
      - `completed_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

    - `publish_targets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `platform` (text)
      - `episode_id` (uuid)
      - `status` (text)
      - `title` (text)
      - `description` (text)
      - `hashtags` (text[])
      - `language` (text)
      - `scheduled_at` (timestamptz, nullable)
      - `published_at` (timestamptz, nullable)
      - `external_url` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies restrict access to authenticated users who own the data
    - Users can only CRUD their own records

  3. Indexes
    - episodes.user_id, episodes.status
    - scenes.episode_id
    - prompts.user_id, prompts.category
    - render_jobs.user_id, render_jobs.status
    - publish_targets.user_id, publish_targets.platform
*/

-- Characters
CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  reference_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  emotions text[] NOT NULL DEFAULT '{}',
  outfits jsonb NOT NULL DEFAULT '[]'::jsonb,
  voice_id uuid,
  consistency_lock boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own characters"
  ON characters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own characters"
  ON characters FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own characters"
  ON characters FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own characters"
  ON characters FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Episodes
CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  thumbnail_url text,
  duration_estimate integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own episodes"
  ON episodes FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own episodes"
  ON episodes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own episodes"
  ON episodes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own episodes"
  ON episodes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_episodes_user_id ON episodes(user_id);
CREATE INDEX IF NOT EXISTS idx_episodes_status ON episodes(status);

-- Scenes
CREATE TABLE IF NOT EXISTS scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  "order" integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  prompt_id uuid,
  prompt_text text NOT NULL DEFAULT '',
  negative_prompt text NOT NULL DEFAULT '',
  characters uuid[] NOT NULL DEFAULT '{}',
  voice_id uuid,
  music_url text,
  subtitle_text text NOT NULL DEFAULT '',
  duration integer NOT NULL DEFAULT 5,
  seed integer,
  render_status text NOT NULL DEFAULT 'pending',
  render_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read scenes of own episodes"
  ON scenes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM episodes WHERE episodes.id = scenes.episode_id AND episodes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert scenes to own episodes"
  ON scenes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes WHERE episodes.id = scenes.episode_id AND episodes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update scenes of own episodes"
  ON scenes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM episodes WHERE episodes.id = scenes.episode_id AND episodes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM episodes WHERE episodes.id = scenes.episode_id AND episodes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete scenes of own episodes"
  ON scenes FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM episodes WHERE episodes.id = scenes.episode_id AND episodes.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_scenes_episode_id ON scenes(episode_id);

-- Prompts
CREATE TABLE IF NOT EXISTS prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  template text NOT NULL,
  negative_prompt text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'en',
  tags text[] NOT NULL DEFAULT '{}',
  is_preset boolean NOT NULL DEFAULT false,
  seed integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prompts"
  ON prompts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prompts"
  ON prompts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompts"
  ON prompts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompts"
  ON prompts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);

-- Voices
CREATE TABLE IF NOT EXISTS voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  provider text NOT NULL DEFAULT 'elevenlabs',
  voice_key text NOT NULL,
  is_cloned boolean NOT NULL DEFAULT false,
  sample_url text,
  character_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own voices"
  ON voices FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voices"
  ON voices FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voices"
  ON voices FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own voices"
  ON voices FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Render Jobs
CREATE TABLE IF NOT EXISTS render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  episode_id uuid REFERENCES episodes(id),
  scene_id uuid REFERENCES scenes(id),
  type text NOT NULL DEFAULT 'scene',
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  output_url text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own render jobs"
  ON render_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own render jobs"
  ON render_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own render jobs"
  ON render_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own render jobs"
  ON render_jobs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_render_jobs_user_id ON render_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_render_jobs_status ON render_jobs(status);

-- Publish Targets
CREATE TABLE IF NOT EXISTS publish_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  platform text NOT NULL,
  episode_id uuid NOT NULL REFERENCES episodes(id),
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  hashtags text[] NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'en',
  scheduled_at timestamptz,
  published_at timestamptz,
  external_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE publish_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own publish targets"
  ON publish_targets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own publish targets"
  ON publish_targets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own publish targets"
  ON publish_targets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own publish targets"
  ON publish_targets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_publish_targets_user_id ON publish_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_publish_targets_platform ON publish_targets(platform);
