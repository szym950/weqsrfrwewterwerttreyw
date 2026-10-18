CREATE TABLE public.dish_counts (dish_name text PRIMARY KEY, count bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.dish_counts TO anon, authenticated;
GRANT ALL ON public.dish_counts TO service_role;
ALTER TABLE public.dish_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dish counts" ON public.dish_counts FOR SELECT TO anon, authenticated USING (true);
CREATE OR REPLACE FUNCTION public.increment_dish_count(_dish text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.dish_counts (dish_name, count) VALUES (left(_dish, 100), 1)
  ON CONFLICT (dish_name) DO UPDATE SET count = dish_counts.count + 1, updated_at = now();
$$;
REVOKE ALL ON FUNCTION public.increment_dish_count(text) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_dish_count(text) TO anon, authenticated;