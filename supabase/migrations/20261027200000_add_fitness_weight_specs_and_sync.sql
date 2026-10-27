-- LifeOS Fitness weight specifications + safe dated-workout sync
-- Additive and re-runnable. Existing numeric weight columns and workout rows remain.
-- Apply in Supabase SQL Editor for the LifeOS project before deploying these source files.

BEGIN;

ALTER TABLE public.workout_routine_exercises
  ADD COLUMN IF NOT EXISTS target_weight_spec text;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS weight_spec text;

-- Validate a single value (30), range (40-55), list (34,50), or mixed list
-- (30,40-55,50). UI and DB both limit values to 1..1000 kg and 6 decimals.
CREATE OR REPLACE FUNCTION public.is_valid_fitness_weight_spec(p_spec text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_compact text;
  v_segment text;
  v_parts text[];
  v_number_text text;
  v_number numeric;
BEGIN
  IF p_spec IS NULL THEN
    RETURN true;
  END IF;

  v_compact := regexp_replace(btrim(p_spec), '[[:space:]]', '', 'g');

  IF length(v_compact) < 1 OR length(v_compact) > 64
     OR v_compact !~ '^[0-9]+([.][0-9]{1,6})?(-[0-9]+([.][0-9]{1,6})?)?(,[0-9]+([.][0-9]{1,6})?(-[0-9]+([.][0-9]{1,6})?)?){0,9}$'
  THEN
    RETURN false;
  END IF;

  FOREACH v_segment IN ARRAY string_to_array(v_compact, ',')
  LOOP
    v_parts := string_to_array(v_segment, '-');

    IF array_length(v_parts, 1) = 2
       AND v_parts[1]::numeric > v_parts[2]::numeric
    THEN
      RETURN false;
    END IF;

    FOREACH v_number_text IN ARRAY v_parts
    LOOP
      v_number := v_number_text::numeric;
      IF v_number <= 0 OR v_number > 1000 THEN
        RETURN false;
      END IF;
    END LOOP;
  END LOOP;

  RETURN true;
EXCEPTION
  WHEN others THEN
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_fitness_weight_spec(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_valid_fitness_weight_spec(text)
  TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.workout_routine_exercises'::regclass
      AND conname = 'workout_routine_exercises_weight_spec_check'
  ) THEN
    ALTER TABLE public.workout_routine_exercises
      ADD CONSTRAINT workout_routine_exercises_weight_spec_check
      CHECK (public.is_valid_fitness_weight_spec(target_weight_spec));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.exercises'::regclass
      AND conname = 'exercises_weight_spec_check'
  ) THEN
    ALTER TABLE public.exercises
      ADD CONSTRAINT exercises_weight_spec_check
      CHECK (public.is_valid_fitness_weight_spec(weight_spec));
  END IF;
END;
$$;

-- Replaces the prior routine-to-workout function. SECURITY INVOKER keeps RLS
-- and table privileges in force. The function call is transactional: failures
-- roll back title/exercise edits together, so the workout is never half-saved.
CREATE OR REPLACE FUNCTION public.sync_fitness_workout_from_routine(
  p_routine_id text,
  p_workout_date date,
  p_title text,
  p_exercises jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_routine public.workout_routines%ROWTYPE;
  v_item jsonb;
  v_name text;
  v_sets integer;
  v_reps integer;
  v_weight numeric;
  v_weight_spec text;
  v_segment text;
  v_parts text[];
  v_number_text text;
  v_number numeric;
  v_existing_id text;
  v_saved_id text;
  v_retained_ids text[] := ARRAY[]::text[];
  v_sort_order integer := 0;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Your session expired. Please sign in again.';
  END IF;

  IF p_workout_date IS NULL THEN
    RAISE EXCEPTION 'Choose a workout date first.';
  END IF;

  IF p_title IS NULL OR length(btrim(p_title)) < 1 OR length(btrim(p_title)) > 70 THEN
    RAISE EXCEPTION 'Workout title must contain 1–70 characters.';
  END IF;

  IF p_exercises IS NULL OR jsonb_typeof(p_exercises) <> 'array' THEN
    RAISE EXCEPTION 'Workout exercises must be supplied as a list.';
  END IF;

  IF jsonb_array_length(p_exercises) < 1 OR jsonb_array_length(p_exercises) > 30 THEN
    RAISE EXCEPTION 'A workout must contain 1–30 strength exercises.';
  END IF;

  SELECT * INTO v_routine
  FROM public.workout_routines
  WHERE user_id = v_user_id
    AND id = p_routine_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This routine is no longer active or could not be found. Refresh the planner and try again.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workout_routine_exercises re
    WHERE re.user_id = v_user_id
      AND re.routine_id = p_routine_id
      AND re.item_type = 'cardio'
  ) THEN
    RAISE EXCEPTION 'This routine contains cardio items. Cardio snapshot support is not available in this workflow yet.';
  END IF;

  -- Validate every exercise before changing any dated workout rows.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_exercises) AS items(value)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Each workout exercise must be an object.';
    END IF;

    v_name := btrim(coalesce(v_item ->> 'name', ''));
    IF length(v_name) < 1 OR length(v_name) > 80 THEN
      RAISE EXCEPTION 'Exercise names must contain 1–80 characters.';
    END IF;

    IF coalesce(v_item ->> 'sets', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Exercise sets must be a whole number from 1 to 30.';
    END IF;
    v_sets := (v_item ->> 'sets')::integer;
    IF v_sets < 1 OR v_sets > 30 THEN
      RAISE EXCEPTION 'Exercise sets must be a whole number from 1 to 30.';
    END IF;

    IF coalesce(v_item ->> 'reps', '') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Exercise reps must be a whole number from 1 to 200.';
    END IF;
    v_reps := (v_item ->> 'reps')::integer;
    IF v_reps < 1 OR v_reps > 200 THEN
      RAISE EXCEPTION 'Exercise reps must be a whole number from 1 to 200.';
    END IF;

    v_weight_spec := nullif(
      regexp_replace(
        btrim(coalesce(v_item ->> 'weight_spec', v_item ->> 'weight_kg', '')),
        '[[:space:]]', '', 'g'
      ),
      ''
    );

    IF v_weight_spec IS NOT NULL THEN
      IF NOT public.is_valid_fitness_weight_spec(v_weight_spec) THEN
        RAISE EXCEPTION 'Weight must be a value (30), range (40-55), or list (34,50), with up to six decimal places.';
      END IF;

      FOREACH v_segment IN ARRAY string_to_array(v_weight_spec, ',')
      LOOP
        v_parts := string_to_array(v_segment, '-');
        IF array_length(v_parts, 1) = 2
           AND v_parts[1]::numeric > v_parts[2]::numeric
        THEN
          RAISE EXCEPTION 'Weight ranges must start with the smaller value.';
        END IF;
        FOREACH v_number_text IN ARRAY v_parts
        LOOP
          v_number := v_number_text::numeric;
          IF v_number <= 0 OR v_number > 1000 THEN
            RAISE EXCEPTION 'Each weight must be greater than 0 and at most 1000 kg.';
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;

  -- Update the existing date row in place; never delete/recreate the workout day.
  INSERT INTO public.workout_days (user_id, workout_date, title)
  VALUES (v_user_id, p_workout_date, btrim(p_title))
  ON CONFLICT (user_id, workout_date)
  DO UPDATE SET title = EXCLUDED.title;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_exercises) AS items(value)
  LOOP
    v_name := btrim(v_item ->> 'name');
    v_sets := (v_item ->> 'sets')::integer;
    v_reps := (v_item ->> 'reps')::integer;
    v_weight_spec := nullif(
      regexp_replace(
        btrim(coalesce(v_item ->> 'weight_spec', v_item ->> 'weight_kg', '')),
        '[[:space:]]', '', 'g'
      ),
      ''
    );

    -- Keep legacy numeric weight for one scalar value so older screens/analytics
    -- remain compatible. Ranges and lists live in weight_spec and keep weight_kg NULL.
    v_weight := NULL;
    IF v_weight_spec IS NOT NULL AND v_weight_spec !~ '[-,]' THEN
      v_weight := v_weight_spec::numeric;
    END IF;

    v_existing_id := nullif(v_item ->> 'existing_id', '');
    v_saved_id := NULL;

    IF v_existing_id IS NOT NULL AND v_existing_id = ANY(v_retained_ids) THEN
      RAISE EXCEPTION 'An existing exercise was submitted more than once.';
    END IF;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.exercises
      SET name = v_name,
          sets = v_sets,
          reps = v_reps,
          weight_kg = v_weight,
          weight_spec = v_weight_spec,
          sort_order = v_sort_order
      WHERE user_id = v_user_id
        AND workout_date = p_workout_date
        AND id = v_existing_id
      RETURNING id INTO v_saved_id;
    END IF;

    IF v_saved_id IS NULL THEN
      v_saved_id := gen_random_uuid()::text;
      INSERT INTO public.exercises (
        id, user_id, workout_date, name, sets, reps,
        weight_kg, weight_spec, completed, sort_order
      )
      VALUES (
        v_saved_id, v_user_id, p_workout_date, v_name, v_sets, v_reps,
        v_weight, v_weight_spec, false, v_sort_order
      );
    END IF;

    v_retained_ids := array_append(v_retained_ids, v_saved_id);

    -- If per-set logs already exist, discard only logs beyond the new set count.
    IF to_regclass('public.exercise_set_logs') IS NOT NULL THEN
      EXECUTE 'DELETE FROM public.exercise_set_logs WHERE user_id = $1 AND exercise_id = $2 AND set_number > $3'
        USING v_user_id, v_saved_id, v_sets;
    END IF;

    v_sort_order := v_sort_order + 1;
  END LOOP;

  -- Synchronize the selected date exactly to the submitted template/custom list.
  -- Deleting an exercise uses the existing FK cascades for its set logs.
  DELETE FROM public.exercises
  WHERE user_id = v_user_id
    AND workout_date = p_workout_date
    AND NOT (id = ANY(v_retained_ids));

  SELECT jsonb_build_object(
    'date', d.workout_date,
    'title', d.title,
    'exercises', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'sets', e.sets,
          'reps', e.reps,
          'weight', e.weight_kg,
          'weightSpec', e.weight_spec,
          'completed', e.completed
        )
        ORDER BY e.sort_order, e.created_at, e.id
      )
      FROM public.exercises e
      WHERE e.user_id = v_user_id
        AND e.workout_date = p_workout_date
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.workout_days d
  WHERE d.user_id = v_user_id
    AND d.workout_date = p_workout_date;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_fitness_workout_from_routine(text, date, text, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_fitness_workout_from_routine(text, date, text, jsonb)
  TO authenticated;

COMMIT;
