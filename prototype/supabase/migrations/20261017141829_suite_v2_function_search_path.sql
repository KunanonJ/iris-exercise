ALTER FUNCTION public.suite_v2_commit_tenant(
  text, text, text, integer, text, text, text, text, text, text, timestamptz
) SET search_path = public;

ALTER FUNCTION public.suite_v2_reserve_quota(
  text, text, integer, integer
) SET search_path = public;
