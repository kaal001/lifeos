-- LifeOS Fitness Routine Planner schema.
-- Existing workout_days and exercises tables are used as immutable dated snapshots.
-- This migration is re-runnable against the current manually-provisioned schema.

BEGIN;

CREATE TABLE IF NOT EXISTS public.workout_routines (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name varchar(70) NOT NULL CHECK (length(btrim(name)) > 0),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  UNIQUE (user_id, weekday, name)
);

CREATE TABLE IF NOT EXISTS public.workout_routine_exercises (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id text NOT NULL,
  name varchar(80) NOT NULL CHECK (length(btrim(name)) > 0),
  item_type text NOT NULL DEFAULT 'strength'
    CHECK (item_type IN ('strength', 'cardio')),
  target_sets integer,
  target_reps integer,
  target_weight_kg numeric,
  target_duration_minutes integer,
  target_distance_km numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, routine_id)
    REFERENCES public.workout_routines(user_id, id) ON DELETE CASCADE,
  CHECK (
    target_weight_kg IS NULL OR
    (target_weight_kg > 0 AND target_weight_kg <= 1000)
  ),
  CHECK (
    target_distance_km IS NULL OR
    (target_distance_km > 0 AND target_distance_km <= 1000)
  ),
  CHECK (
    (
      item_type = 'strength'
      AND target_sets IS NOT NULL AND target_sets BETWEEN 1 AND 30
      AND target_reps IS NOT NULL AND target_reps BETWEEN 1 AND 200
      AND target_duration_minutes IS NULL
      AND target_distance_km IS NULL
    ) OR (
      item_type = 'cardio'
      AND target_sets IS NULL
      AND target_reps IS NULL
      AND target_weight_kg IS NULL
      AND target_duration_minutes IS NOT NULL
      AND target_duration_minutes BETWEEN 1 AND 1440
    )
  )
);

CREATE TABLE IF NOT EXISTS public.workout_cardio_entries (
  id text NOT NULL DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_date date NOT NULL,
  name varchar(80) NOT NULL CHECK (length(btrim(name)) > 0),
  planned_duration_minutes integer CHECK (
    planned_duration_minutes IS NULL OR planned_duration_minutes BETWEEN 1 AND 1440
  ),
  actual_duration_minutes integer CHECK (
    actual_duration_minutes IS NULL OR actual_duration_minutes BETWEEN 1 AND 1440
  ),
  planned_distance_km numeric CHECK (
    planned_distance_km IS NULL OR
    (planned_distance_km > 0 AND planned_distance_km <= 1000)
  ),
  actual_distance_km numeric CHECK (
    actual_distance_km IS NULL OR
    (actual_distance_km > 0 AND actual_distance_km <= 1000)
  ),
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, workout_date)
    REFERENCES public.workout_days(user_id, workout_date) ON DELETE CASCADE,
  CHECK (planned_duration_minutes IS NOT NULL OR actual_duration_minutes IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.exercise_set_logs (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id text NOT NULL,
  set_number integer NOT NULL CHECK (set_number BETWEEN 1 AND 30),
  actual_reps integer CHECK (actual_reps IS NULL OR actual_reps BETWEEN 1 AND 200),
  actual_weight_kg numeric CHECK (
    actual_weight_kg IS NULL OR
    (actual_weight_kg > 0 AND actual_weight_kg <= 1000)
  ),
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id, set_number),
  FOREIGN KEY (user_id, exercise_id)
    REFERENCES public.exercises(user_id, id) ON DELETE CASCADE,
  CHECK (NOT completed OR actual_reps IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS workout_routines_user_weekday_idx
  ON public.workout_routines(user_id, weekday, sort_order);
CREATE INDEX IF NOT EXISTS workout_routine_exercises_order_idx
  ON public.workout_routine_exercises(user_id, routine_id, sort_order);
CREATE INDEX IF NOT EXISTS workout_cardio_entries_date_idx
  ON public.workout_cardio_entries(user_id, workout_date, sort_order);

DO $$
DECLARE
  v_table_name text;
  v_tables text[] := ARRAY[
    'workout_routines',
    'workout_routine_exercises',
    'workout_cardio_entries',
    'exercise_set_logs'
  ];
BEGIN
  FOREACH v_table_name IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_table_name);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = v_table_name
        AND p.policyname = 'owner_manage_' || v_table_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)',
        'owner_manage_' || v_table_name,
        v_table_name
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;
