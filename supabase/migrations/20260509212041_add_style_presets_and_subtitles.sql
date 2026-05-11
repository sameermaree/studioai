/*
  # Add Style Presets and Subtitle Tracks

  1. New Tables
    - `style_presets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable - null for system presets)
      - `name` (text) - display name
      - `category` (text) - pixar, disney, anime, realistic, etc.
      - `description` (text)
      - `thumbnail_url` (text, nullable)
      - `lighting_rules` (text)
      - `camera_style` (text)
      - `rendering_style` (text)
      - `color_palette` (text[])
      - `character_guidance` (text)
      - `negative_prompts` (text)
      - `cinematic_mood` (text)
      - `sample_prompts` (text[])
      - `is_system` (boolean) - system presets vs user-created
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `subtitle_tracks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `scene_id` (uuid, nullable, references scenes)
      - `episode_id` (uuid, nullable, references episodes)
      - `language` (text) - en, ar, fr
      - `format` (text) - srt, vtt
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `subtitle_entries`
      - `id` (uuid, primary key)
      - `track_id` (uuid, references subtitle_tracks)
      - `index` (integer) - ordering
      - `start_time` (numeric) - seconds
      - `end_time` (numeric) - seconds
      - `text` (text) - subtitle text

  2. Modified Tables
    - `characters` - add columns: style_preset_id, consistency_settings, personality_notes, cinematic_notes
    - `scenes` - add columns: camera_angle, motion_instructions, sound_effects, narration, style_preset_id, image_references, video_references
    - `episodes` - add column: style_preset_id
    - `prompts` - add column: style_preset_id
    - `render_jobs` - add columns: burn_subtitles, subtitle_language

  3. Security
    - RLS on all new tables
    - System presets readable by all authenticated users
    - User presets restricted to owner
*/

-- Style Presets
CREATE TABLE IF NOT EXISTS style_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'custom',
  description text NOT NULL DEFAULT '',
  thumbnail_url text,
  lighting_rules text NOT NULL DEFAULT '',
  camera_style text NOT NULL DEFAULT '',
  rendering_style text NOT NULL DEFAULT '',
  color_palette text[] NOT NULL DEFAULT '{}',
  character_guidance text NOT NULL DEFAULT '',
  negative_prompts text NOT NULL DEFAULT '',
  cinematic_mood text NOT NULL DEFAULT '',
  sample_prompts text[] NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE style_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read system presets"
  ON style_presets FOR SELECT TO authenticated
  USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own presets"
  ON style_presets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own presets"
  ON style_presets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own presets"
  ON style_presets FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_system = false);

-- Subtitle Tracks
CREATE TABLE IF NOT EXISTS subtitle_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  scene_id uuid REFERENCES scenes(id) ON DELETE CASCADE,
  episode_id uuid REFERENCES episodes(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en',
  format text NOT NULL DEFAULT 'srt',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subtitle_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subtitle tracks"
  ON subtitle_tracks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subtitle tracks"
  ON subtitle_tracks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subtitle tracks"
  ON subtitle_tracks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subtitle tracks"
  ON subtitle_tracks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Subtitle Entries
CREATE TABLE IF NOT EXISTS subtitle_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES subtitle_tracks(id) ON DELETE CASCADE,
  "index" integer NOT NULL DEFAULT 0,
  start_time numeric NOT NULL DEFAULT 0,
  end_time numeric NOT NULL DEFAULT 0,
  text text NOT NULL DEFAULT ''
);

ALTER TABLE subtitle_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subtitle entries"
  ON subtitle_entries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subtitle_tracks WHERE subtitle_tracks.id = subtitle_entries.track_id AND subtitle_tracks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own subtitle entries"
  ON subtitle_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subtitle_tracks WHERE subtitle_tracks.id = subtitle_entries.track_id AND subtitle_tracks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own subtitle entries"
  ON subtitle_entries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subtitle_tracks WHERE subtitle_tracks.id = subtitle_entries.track_id AND subtitle_tracks.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subtitle_tracks WHERE subtitle_tracks.id = subtitle_entries.track_id AND subtitle_tracks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own subtitle entries"
  ON subtitle_entries FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subtitle_tracks WHERE subtitle_tracks.id = subtitle_entries.track_id AND subtitle_tracks.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_subtitle_entries_track_id ON subtitle_entries(track_id);

-- Add new columns to characters
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'style_preset_id') THEN
    ALTER TABLE characters ADD COLUMN style_preset_id uuid REFERENCES style_presets(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'consistency_settings') THEN
    ALTER TABLE characters ADD COLUMN consistency_settings jsonb NOT NULL DEFAULT '{"face":true,"hairstyle":true,"eye_color":true,"clothing":false,"body_proportions":true,"animation_style":false,"color_palette":false}'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'personality_notes') THEN
    ALTER TABLE characters ADD COLUMN personality_notes text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'cinematic_notes') THEN
    ALTER TABLE characters ADD COLUMN cinematic_notes text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add new columns to scenes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'camera_angle') THEN
    ALTER TABLE scenes ADD COLUMN camera_angle text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'motion_instructions') THEN
    ALTER TABLE scenes ADD COLUMN motion_instructions text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'sound_effects') THEN
    ALTER TABLE scenes ADD COLUMN sound_effects text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'narration') THEN
    ALTER TABLE scenes ADD COLUMN narration text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'style_preset_id') THEN
    ALTER TABLE scenes ADD COLUMN style_preset_id uuid REFERENCES style_presets(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'image_references') THEN
    ALTER TABLE scenes ADD COLUMN image_references text[] NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scenes' AND column_name = 'video_references') THEN
    ALTER TABLE scenes ADD COLUMN video_references text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Add style_preset_id to episodes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'episodes' AND column_name = 'style_preset_id') THEN
    ALTER TABLE episodes ADD COLUMN style_preset_id uuid REFERENCES style_presets(id);
  END IF;
END $$;

-- Add style_preset_id to prompts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'style_preset_id') THEN
    ALTER TABLE prompts ADD COLUMN style_preset_id uuid REFERENCES style_presets(id);
  END IF;
END $$;

-- Add subtitle rendering options to render_jobs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'render_jobs' AND column_name = 'burn_subtitles') THEN
    ALTER TABLE render_jobs ADD COLUMN burn_subtitles boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'render_jobs' AND column_name = 'subtitle_language') THEN
    ALTER TABLE render_jobs ADD COLUMN subtitle_language text;
  END IF;
END $$;
