-- ================================================================
-- Code4Ever — Supabase PostgreSQL Schema & Security Architecture
-- ================================================================
-- Run this whole script in the Supabase SQL editor. It is idempotent: you can run it as
-- many times as you like, on a fresh project or on an existing database.
--
-- WHAT CHANGED (security hardening)
-- --------------------------------
-- The previous version of this script granted ALL privileges to the `anon` role and created
-- `USING (true) WITH CHECK (true)` policies on every table. With the anon key that ships in
-- the browser bundle, ANY visitor could:
--   * rewrite or delete any other member's profile (including `is_admin`),
--   * edit or delete any post, job listing or community,
--   * read and delete every private message in the database.
--
-- The policies below restrict every table to its legitimate owner, while keeping the social
-- interactions the app needs (likes, reposts, bookmarks, comments, community joins and job
-- applications) working. Those "engagement" writes are allowed for everyone but constrained
-- to the engagement columns by BEFORE UPDATE triggers, so a like can never rewrite content.
-- ================================================================

-- ================================================================
-- 1. TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'Geliştirici',
  verified BOOLEAN DEFAULT false,
  email TEXT,
  website TEXT,
  theme_color TEXT DEFAULT '#09090b',
  accent_color TEXT DEFAULT '#3b82f6',
  joined_communities JSONB DEFAULT '[]'::jsonb,
  custom_fields JSONB DEFAULT '{"github": "github.com", "location": "Türkiye"}'::jsonb,
  pinned_repos JSONB DEFAULT '[]'::jsonb,
  badges JSONB DEFAULT '[]'::jsonb,
  integrations JSONB,
  is_admin BOOLEAN DEFAULT false,
  supporter_tier TEXT DEFAULT 'none',
  profile_theme JSONB,
  saved_post_ids JSONB DEFAULT '[]'::jsonb,
  allow_group_invites BOOLEAN DEFAULT true,
  show_liked_posts BOOLEAN DEFAULT true,
  is_online BOOLEAN DEFAULT false,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.posts (
  id TEXT PRIMARY KEY,
  author JSONB NOT NULL,
  author_id TEXT,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  category_name TEXT DEFAULT 'Genel & Sohbet',
  code_snippet TEXT,
  code_language TEXT,
  media_url TEXT,
  media_type TEXT,
  project_card JSONB,
  community_id TEXT,
  community_name TEXT,
  community_handle TEXT,
  likes_count INTEGER DEFAULT 0,
  liked_by JSONB DEFAULT '[]'::jsonb,
  comments_count INTEGER DEFAULT 0,
  comments JSONB DEFAULT '[]'::jsonb,
  reposts_count INTEGER DEFAULT 0,
  reposted_by JSONB DEFAULT '[]'::jsonb,
  bookmarked_by JSONB DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.communities (
  id TEXT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  handle VARCHAR(40) UNIQUE NOT NULL,
  avatar_url TEXT,
  banner_url TEXT,
  description VARCHAR(500),
  members_count INTEGER DEFAULT 0,
  is_private BOOLEAN DEFAULT false,
  created_by TEXT,
  creator_username TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_listings (
  id TEXT PRIMARY KEY,
  type VARCHAR(10) NOT NULL CHECK (type IN ('job', 'team')),
  title VARCHAR(120) NOT NULL,
  description VARCHAR(4000) NOT NULL,
  quota INTEGER NOT NULL DEFAULT 1 CHECK (quota >= 1 AND quota <= 500),
  author JSONB NOT NULL,
  author_id TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  applications JSONB DEFAULT '[]'::jsonb,
  applied_by JSONB DEFAULT '[]'::jsonb,
  applications_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  job_title TEXT,
  applicant_id TEXT,
  applicant_username TEXT NOT NULL,
  applicant_avatar TEXT,
  applicant_display_name TEXT,
  name VARCHAR(60) NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 13 AND age <= 100),
  experience VARCHAR(250) NOT NULL,
  languages VARCHAR(250) NOT NULL,
  description VARCHAR(3000) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  type VARCHAR(30) NOT NULL,
  actor JSONB NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  target_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.groups (
  id TEXT PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  avatar_url TEXT NOT NULL,
  description VARCHAR(500),
  creator_id TEXT NOT NULL,
  creator_username TEXT NOT NULL,
  admins JSONB DEFAULT '[]'::jsonb,
  members JSONB DEFAULT '[]'::jsonb,
  last_message JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  is_group BOOLEAN DEFAULT false,
  sender_id TEXT NOT NULL,
  sender_username TEXT NOT NULL,
  sender_display_name TEXT NOT NULL,
  sender_avatar TEXT,
  content TEXT NOT NULL, -- AES-GCM ciphertext produced in the browser
  media_url TEXT,
  media_type VARCHAR(20),
  media_name TEXT,
  status VARCHAR(20) DEFAULT 'delivered',
  is_edited BOOLEAN DEFAULT false,
  encryption_duration_ms NUMERIC DEFAULT 0,
  reply_to JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.group_invites (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  group_name VARCHAR(60) NOT NULL,
  group_avatar TEXT,
  group_description VARCHAR(500),
  invited_by_username TEXT NOT NULL,
  invited_by_name TEXT NOT NULL,
  invited_by_avatar TEXT,
  target_username TEXT NOT NULL,
  target_user_id TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_error_reports (
  id TEXT PRIMARY KEY,
  error_type TEXT NOT NULL DEFAULT 'general_issue',
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  logs TEXT,
  reporter_username TEXT NOT NULL,
  reporter_display_name TEXT,
  reporter_avatar TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.post_reports (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  post_author_username TEXT NOT NULL,
  post_content TEXT NOT NULL,
  reporter_username TEXT NOT NULL,
  reporter_display_name TEXT,
  reason TEXT NOT NULL DEFAULT 'other',
  reason_label TEXT DEFAULT 'İhlal / Şikayet',
  details TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 2. COLUMN MIGRATIONS (safe to re-run)
-- ================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pinned_repos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS integrations JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS supporter_tier TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_theme JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS saved_post_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS allow_group_invites BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_liked_posts BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS joined_communities JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS members_count INTEGER DEFAULT 0;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS liked_by JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS applications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS applied_by JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS members JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS admins JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS last_message JSONB;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS author_id TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS bookmarked_by JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reposted_by JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS reposts_count INTEGER DEFAULT 0;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS code_language TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category_name TEXT DEFAULT 'Genel & Sohbet';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS author_id TEXT;
ALTER TABLE public.job_listings ADD COLUMN IF NOT EXISTS applications_count INTEGER DEFAULT 0;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applicant_avatar TEXT;
ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS applicant_display_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Backfill the post author id from the JSON author blob where possible.
UPDATE public.posts p
SET author_id = pr.id::text
FROM public.profiles pr
WHERE p.author_id IS NULL
  AND lower(pr.username) = lower(p.author->>'username');

-- Backfill the protected supporter tier from the legacy (user editable) markers, so existing
-- Spark supporters keep their perks after the switch to the protected column.
UPDATE public.profiles
SET supporter_tier = 'spark'
WHERE coalesce(supporter_tier, 'none') <> 'spark'
  AND (
    lower(coalesce(role, '')) LIKE '%spark%'
    OR lower(coalesce(custom_fields->'subscription'->>'planId', '')) = 'spark'
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(coalesce(badges, custom_fields->'badges', '[]'::jsonb)) = 'array'
             THEN coalesce(badges, custom_fields->'badges', '[]'::jsonb)
             ELSE '[]'::jsonb END
      ) b
      WHERE lower(coalesce(b->>'id', '')) IN ('spark', 'c4e_spark')
    )
  );

-- ================================================================
-- 3. SECURITY HELPER FUNCTIONS
-- ================================================================
-- SECURITY DEFINER so they can read `profiles` without re-entering RLS (which would recurse
-- when the helper is used inside a policy on `profiles` itself).

CREATE OR REPLACE FUNCTION public.current_username()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(username) FROM public.profiles WHERE id::text = auth.uid()::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT is_admin FROM public.profiles WHERE id::text = auth.uid()::text LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_profile(profile_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL AND profile_id::text = auth.uid()::text;
$$;

-- Membership in a community is stored on the member's own profile
-- (profiles.joined_communities is a JSONB array of community ids).
CREATE OR REPLACE FUNCTION public.is_community_member(community_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (
      SELECT
        (CASE WHEN jsonb_typeof(p.joined_communities) = 'array' THEN p.joined_communities ELSE '[]'::jsonb END) ? community_id
        OR EXISTS (
          SELECT 1 FROM public.communities c
          WHERE c.id = community_id
            AND (c.created_by::text = p.id::text OR lower(coalesce(c.creator_username, '')) = lower(p.username))
        )
      FROM public.profiles p
      WHERE p.id::text = auth.uid()::text
      LIMIT 1
    ),
    false
  );
$$;

-- True when a post belongs to a private ("gizli") community the caller has not joined.
CREATE OR REPLACE FUNCTION public.is_hidden_community_post(community_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN community_id IS NULL THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.is_private = true
    ) THEN false
    ELSE NOT public.is_community_member(community_id)
  END;
$$;

-- Direct-message conversation ids are built as `dm_<userA>_<userB>` with both usernames
-- lowercased and sorted. A member is a participant when the id splits exactly into their own
-- username and another EXISTING username — a plain substring match would let "alice" read
-- "dm_alice_bob"-style ids belonging to someone whose name merely starts the same way.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conversation TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me TEXT := public.current_username();
  body TEXT;
  peer TEXT;
BEGIN
  IF me IS NULL OR conversation IS NULL THEN
    RETURN false;
  END IF;

  IF conversation LIKE 'dm\_%' THEN
    body := substring(conversation FROM 4);

    -- me is the first half
    IF body LIKE me || '\_%' THEN
      peer := substring(body FROM length(me) + 2);
      IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = peer) THEN
        RETURN true;
      END IF;
    END IF;

    -- me is the second half
    IF body LIKE '%\_' || me THEN
      peer := left(body, length(body) - length(me) - 1);
      IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = peer) THEN
        RETURN true;
      END IF;
    END IF;

    RETURN false;
  END IF;

  -- Otherwise the conversation id is a group id.
  RETURN EXISTS (
    SELECT 1
    FROM public.groups g
    WHERE g.id = conversation
      AND (
        lower(g.creator_username) = me
        OR g.admins ? me
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(g.members) = 'array' THEN g.members ELSE '[]'::jsonb END
          ) m
          WHERE lower(m->>'username') = me
        )
      )
  );
END;
$$;

-- ================================================================
-- 4. TRIGGERS THAT PROTECT PRIVILEGED COLUMNS
-- ================================================================

-- 4.1 Profiles: a member may edit their own profile, but never grant themselves
-- administrator rights, the verified tick, the paid supporter tier, a ban lift or beta
-- approval — and never claim a reserved system username.
CREATE OR REPLACE FUNCTION public.protect_profile_privileges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reserved TEXT[] := ARRAY[
    'admin', 'administrator', 'nylithra', 'c4e_admin', 'code4ever', 'system', 'root',
    'support', 'staff', 'moderator', 'security', 'official', 'api', 'bot'
  ];
  old_custom JSONB := coalesce(OLD.custom_fields, '{}'::jsonb);
  new_custom JSONB := coalesce(NEW.custom_fields, '{}'::jsonb);
  protected_key TEXT;
BEGIN
  -- The service role (backend with the service key) and administrators are unrestricted.
  IF auth.role() = 'service_role' OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.is_admin := OLD.is_admin;
  NEW.verified := OLD.verified;
  NEW.supporter_tier := OLD.supporter_tier;
  NEW.created_at := OLD.created_at;

  -- Reserved usernames may not be claimed by regular members.
  IF lower(coalesce(NEW.username, '')) <> lower(coalesce(OLD.username, ''))
     AND lower(NEW.username) = ANY (reserved) THEN
    RAISE EXCEPTION 'Bu kullanıcı adı sistem tarafından ayrılmıştır.';
  END IF;

  -- Moderation and entitlement state stored inside custom_fields is preserved as-is.
  FOREACH protected_key IN ARRAY ARRAY['isBanned', 'banReason', 'suspendedUntil', 'betaStatus', 'supporter_tier', 'subscription'] LOOP
    IF old_custom ? protected_key THEN
      new_custom := jsonb_set(new_custom, ARRAY[protected_key], old_custom -> protected_key, true);
    ELSE
      new_custom := new_custom - protected_key;
    END IF;
  END LOOP;

  NEW.custom_fields := new_custom;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileges ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileges();

-- New profiles must belong to the caller and start without privileges.
CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;
  NEW.is_admin := false;
  NEW.verified := false;
  NEW.supporter_tier := 'none';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_insert ON public.profiles;
CREATE TRIGGER trg_protect_profile_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_insert();

-- 4.2 Posts: everybody may like / repost / bookmark / comment, nobody but the author (or an
-- administrator) may change the content of a post.
CREATE OR REPLACE FUNCTION public.restrict_post_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me TEXT := public.current_username();
  merged public.posts;
BEGIN
  IF auth.role() = 'service_role' OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF (OLD.author_id IS NOT NULL AND OLD.author_id::text = auth.uid()::text)
     OR (me IS NOT NULL AND lower(OLD.author->>'username') = me) THEN
    NEW.author_id := OLD.author_id;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  -- Engagement-only update. Start from the stored row and copy ONLY the interaction
  -- columns across, so any column that is not explicitly listed here (today's content
  -- columns and any added later) simply cannot be changed by a non-author.
  merged := OLD;
  merged.likes_count := NEW.likes_count;
  merged.liked_by := NEW.liked_by;
  merged.comments := NEW.comments;
  merged.comments_count := NEW.comments_count;
  merged.reposts_count := NEW.reposts_count;
  merged.reposted_by := NEW.reposted_by;
  merged.bookmarked_by := NEW.bookmarked_by;
  RETURN merged;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_post_updates ON public.posts;
CREATE TRIGGER trg_restrict_post_updates
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.restrict_post_updates();

-- Stamp the author id on insert so ownership survives username changes.
CREATE OR REPLACE FUNCTION public.stamp_post_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.author_id := auth.uid()::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_post_author ON public.posts;
CREATE TRIGGER trg_stamp_post_author
BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.stamp_post_author();

-- 4.3 Communities: joining updates the member counter, everything else is owner-only.
CREATE OR REPLACE FUNCTION public.restrict_community_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me TEXT := public.current_username();
  merged public.communities;
BEGIN
  IF auth.role() = 'service_role' OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF (OLD.created_by IS NOT NULL AND OLD.created_by::text = auth.uid()::text)
     OR (me IS NOT NULL AND lower(coalesce(OLD.creator_username, '')) = me) THEN
    RETURN NEW;
  END IF;

  -- Non-owners may only move the member counter (join / leave).
  merged := OLD;
  merged.members_count := NEW.members_count;
  merged.updated_at := NOW();
  RETURN merged;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_community_updates ON public.communities;
CREATE TRIGGER trg_restrict_community_updates
BEFORE UPDATE ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.restrict_community_updates();

-- 4.4 Job listings: applicants may only append to the application arrays.
CREATE OR REPLACE FUNCTION public.restrict_job_listing_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me TEXT := public.current_username();
  merged public.job_listings;
BEGIN
  IF auth.role() = 'service_role' OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF (OLD.author_id IS NOT NULL AND OLD.author_id::text = auth.uid()::text)
     OR (me IS NOT NULL AND lower(OLD.author->>'username') = me) THEN
    RETURN NEW;
  END IF;

  -- Applicants may only append to the application arrays.
  merged := OLD;
  merged.applications := NEW.applications;
  merged.applied_by := NEW.applied_by;
  merged.applications_count := NEW.applications_count;
  RETURN merged;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_job_listing_updates ON public.job_listings;
CREATE TRIGGER trg_restrict_job_listing_updates
BEFORE UPDATE ON public.job_listings
FOR EACH ROW EXECUTE FUNCTION public.restrict_job_listing_updates();

CREATE OR REPLACE FUNCTION public.stamp_job_listing_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.author_id := auth.uid()::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_job_listing_author ON public.job_listings;
CREATE TRIGGER trg_stamp_job_listing_author
BEFORE INSERT ON public.job_listings
FOR EACH ROW EXECUTE FUNCTION public.stamp_job_listing_author();

-- 4.5 Groups: members may join/leave and post the "last message" preview; renaming,
-- re-avataring and changing the admin list stays with the group owner/admins.
CREATE OR REPLACE FUNCTION public.restrict_group_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me TEXT := public.current_username();
  merged public.groups;
BEGIN
  IF auth.role() = 'service_role' OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF me IS NOT NULL AND (lower(OLD.creator_username) = me OR OLD.admins ? me) THEN
    RETURN NEW;
  END IF;

  -- Members may join / leave and refresh the last-message preview; renaming, re-avataring
  -- and changing the admin list stays with the group owner and its admins.
  merged := OLD;
  merged.members := NEW.members;
  merged.last_message := NEW.last_message;
  merged.updated_at := NOW();
  RETURN merged;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_group_updates ON public.groups;
CREATE TRIGGER trg_restrict_group_updates
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.restrict_group_updates();

-- ================================================================
-- 5. ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

-- Remove every legacy "allow everything" policy.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles', 'posts', 'communities', 'job_listings', 'job_applications', 'notifications',
        'groups', 'messages', 'group_invites', 'system_error_reports', 'post_reports'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- 5.1 Profiles ---------------------------------------------------
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT WITH CHECK (public.owns_profile(id::text) OR public.is_platform_admin());
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (public.owns_profile(id::text) OR public.is_platform_admin())
  WITH CHECK (public.owns_profile(id::text) OR public.is_platform_admin());
CREATE POLICY "profiles_delete_self" ON public.profiles
  FOR DELETE USING (public.owns_profile(id::text) OR public.is_platform_admin());

-- 5.2 Posts ------------------------------------------------------
-- Private communities: their posts are only selectable by members (or administrators).
CREATE POLICY "posts_select_public" ON public.posts
  FOR SELECT USING (
    public.is_platform_admin()
    OR (
      coalesce(is_deleted, false) = false
      AND NOT public.is_hidden_community_post(community_id)
    )
  );
CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND lower(author->>'username') = public.current_username()
  );
-- Any signed-in member may update (likes/comments); the trigger above limits WHICH columns.
CREATE POLICY "posts_update_authenticated" ON public.posts
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "posts_delete_own" ON public.posts
  FOR DELETE USING (
    public.is_platform_admin()
    OR (author_id IS NOT NULL AND author_id::text = auth.uid()::text)
    OR lower(author->>'username') = public.current_username()
  );

-- 5.3 Communities ------------------------------------------------
CREATE POLICY "communities_select_public" ON public.communities
  FOR SELECT USING (true);
CREATE POLICY "communities_insert_own" ON public.communities
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by IS NULL OR created_by::text = auth.uid()::text)
  );
CREATE POLICY "communities_update_authenticated" ON public.communities
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "communities_delete_owner" ON public.communities
  FOR DELETE USING (
    public.is_platform_admin()
    OR created_by::text = auth.uid()::text
    OR lower(coalesce(creator_username, '')) = public.current_username()
  );

-- 5.4 Job listings -----------------------------------------------
CREATE POLICY "job_listings_select_public" ON public.job_listings
  FOR SELECT USING (true);
CREATE POLICY "job_listings_insert_own" ON public.job_listings
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND lower(author->>'username') = public.current_username()
  );
CREATE POLICY "job_listings_update_authenticated" ON public.job_listings
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "job_listings_delete_own" ON public.job_listings
  FOR DELETE USING (
    public.is_platform_admin()
    OR (author_id IS NOT NULL AND author_id::text = auth.uid()::text)
    OR lower(author->>'username') = public.current_username()
  );

-- 5.5 Job applications -------------------------------------------
-- Applications carry personal data (name, age, experience): only the applicant, the listing
-- owner and administrators can read them.
CREATE POLICY "job_applications_select_involved" ON public.job_applications
  FOR SELECT USING (
    public.is_platform_admin()
    OR lower(applicant_username) = public.current_username()
    OR EXISTS (
      SELECT 1 FROM public.job_listings j
      WHERE j.id = job_id
        AND (j.author_id::text = auth.uid()::text OR lower(j.author->>'username') = public.current_username())
    )
  );
CREATE POLICY "job_applications_insert_own" ON public.job_applications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND lower(applicant_username) = public.current_username()
  );
CREATE POLICY "job_applications_update_involved" ON public.job_applications
  FOR UPDATE USING (
    public.is_platform_admin()
    OR lower(applicant_username) = public.current_username()
    OR EXISTS (
      SELECT 1 FROM public.job_listings j
      WHERE j.id = job_id
        AND (j.author_id::text = auth.uid()::text OR lower(j.author->>'username') = public.current_username())
    )
  );
CREATE POLICY "job_applications_delete_involved" ON public.job_applications
  FOR DELETE USING (
    public.is_platform_admin()
    OR lower(applicant_username) = public.current_username()
    OR EXISTS (
      SELECT 1 FROM public.job_listings j
      WHERE j.id = job_id
        AND (j.author_id::text = auth.uid()::text OR lower(j.author->>'username') = public.current_username())
    )
  );

-- 5.6 Notifications ----------------------------------------------
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (
    public.is_platform_admin()
    OR lower(recipient_id) = public.current_username()
    OR recipient_id::text = auth.uid()::text
  );
CREATE POLICY "notifications_insert_as_self" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      lower(coalesce(actor->>'username', '')) = public.current_username()
      OR lower(coalesce(actor->>'username', '')) IN ('code4ever', 'system')
    )
  );
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (
    public.is_platform_admin()
    OR lower(recipient_id) = public.current_username()
    OR recipient_id::text = auth.uid()::text
  );
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (
    public.is_platform_admin()
    OR lower(recipient_id) = public.current_username()
    OR recipient_id::text = auth.uid()::text
  );

-- 5.7 Groups -----------------------------------------------------
CREATE POLICY "groups_select_members" ON public.groups
  FOR SELECT USING (
    public.is_platform_admin()
    OR public.is_conversation_participant(id)
    OR EXISTS (
      SELECT 1 FROM public.group_invites gi
      WHERE gi.group_id = groups.id AND lower(gi.target_username) = public.current_username()
    )
  );
CREATE POLICY "groups_insert_own" ON public.groups
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND lower(creator_username) = public.current_username()
  );
CREATE POLICY "groups_update_members" ON public.groups
  FOR UPDATE USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "groups_delete_owner" ON public.groups
  FOR DELETE USING (
    public.is_platform_admin() OR lower(creator_username) = public.current_username()
  );

-- 5.8 Messages ---------------------------------------------------
-- The heart of the privacy model: only conversation participants may read a message.
CREATE POLICY "messages_select_participants" ON public.messages
  FOR SELECT USING (
    public.is_platform_admin()
    OR lower(sender_username) = public.current_username()
    OR public.is_conversation_participant(conversation_id)
  );
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND lower(sender_username) = public.current_username()
    AND public.is_conversation_participant(conversation_id)
  );
CREATE POLICY "messages_update_sender" ON public.messages
  FOR UPDATE USING (
    public.is_platform_admin()
    OR lower(sender_username) = public.current_username()
    OR public.is_conversation_participant(conversation_id)
  );
CREATE POLICY "messages_delete_sender" ON public.messages
  FOR DELETE USING (
    public.is_platform_admin() OR lower(sender_username) = public.current_username()
  );

-- 5.9 Group invites ----------------------------------------------
CREATE POLICY "group_invites_select_involved" ON public.group_invites
  FOR SELECT USING (
    public.is_platform_admin()
    OR lower(target_username) = public.current_username()
    OR lower(invited_by_username) = public.current_username()
  );
CREATE POLICY "group_invites_insert_own" ON public.group_invites
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND lower(invited_by_username) = public.current_username()
  );
CREATE POLICY "group_invites_update_involved" ON public.group_invites
  FOR UPDATE USING (
    public.is_platform_admin()
    OR lower(target_username) = public.current_username()
    OR lower(invited_by_username) = public.current_username()
  );
CREATE POLICY "group_invites_delete_involved" ON public.group_invites
  FOR DELETE USING (
    public.is_platform_admin()
    OR lower(target_username) = public.current_username()
    OR lower(invited_by_username) = public.current_username()
  );

-- 5.10 Reports ---------------------------------------------------
CREATE POLICY "system_error_reports_select_own" ON public.system_error_reports
  FOR SELECT USING (
    public.is_platform_admin() OR lower(reporter_username) = public.current_username()
  );
CREATE POLICY "system_error_reports_insert_own" ON public.system_error_reports
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND lower(reporter_username) = public.current_username()
  );
CREATE POLICY "system_error_reports_update_admin" ON public.system_error_reports
  FOR UPDATE USING (public.is_platform_admin());
CREATE POLICY "system_error_reports_delete_admin" ON public.system_error_reports
  FOR DELETE USING (public.is_platform_admin());

CREATE POLICY "post_reports_select_own" ON public.post_reports
  FOR SELECT USING (
    public.is_platform_admin() OR lower(reporter_username) = public.current_username()
  );
CREATE POLICY "post_reports_insert_own" ON public.post_reports
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND lower(reporter_username) = public.current_username()
  );
CREATE POLICY "post_reports_update_admin" ON public.post_reports
  FOR UPDATE USING (public.is_platform_admin());
CREATE POLICY "post_reports_delete_admin" ON public.post_reports
  FOR DELETE USING (public.is_platform_admin());

-- ================================================================
-- 6. GRANTS
-- ================================================================
-- Anonymous visitors get read-only access to the public tables (feed, profiles,
-- communities, job listings). Everything else requires a signed-in session, and RLS decides
-- the rest. The previous `GRANT ALL ... TO anon` made the anon key a master key.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.profiles, public.posts, public.communities, public.job_listings TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.profiles, public.posts, public.communities, public.job_listings,
  public.job_applications, public.notifications, public.groups, public.messages,
  public.group_invites, public.system_error_reports, public.post_reports
TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT EXECUTE ON FUNCTION public.current_username() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owns_profile(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_community_member(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_hidden_community_post(TEXT) TO anon, authenticated;

-- ================================================================
-- 7. REALTIME
-- ================================================================

ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.job_listings REPLICA IDENTITY FULL;
ALTER TABLE public.communities REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.system_error_reports REPLICA IDENTITY FULL;
ALTER TABLE public.post_reports REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE
      public.posts, public.messages, public.job_listings, public.communities,
      public.notifications, public.profiles, public.system_error_reports, public.post_reports;
  EXCEPTION WHEN OTHERS THEN
    -- Already published (or the publication does not exist): safe to ignore.
    NULL;
  END;
END $$;

-- ================================================================
-- 8. INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_is_deleted ON public.posts(is_deleted);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON public.posts(community_id);
CREATE INDEX IF NOT EXISTS idx_communities_private ON public.communities(is_private);
CREATE INDEX IF NOT EXISTS idx_job_listings_created_at ON public.job_listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(lower(username));
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_invites_target ON public.group_invites(target_username, status);
CREATE INDEX IF NOT EXISTS idx_system_error_reports_created_at ON public.system_error_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_reports_created_at ON public.post_reports(created_at DESC);

-- ================================================================
-- 9. BOOTSTRAP THE PLATFORM ADMINISTRATOR
-- ================================================================
-- Grant the founder account the administrator flag (idempotent).
UPDATE public.profiles SET is_admin = true WHERE lower(username) = 'nylithra';
