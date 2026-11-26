-- The goal survey remembers each child's answers, so retaking it opens pre-filled. The answers are kept as the same
-- query string the survey already reads, and are checked again by the app every time they are read (anything invalid is
-- dropped). Safe to run more than once.
alter table public.children add column if not exists survey_answers text;
alter table public.children drop constraint if exists children_survey_answers_length;
alter table public.children add constraint children_survey_answers_length check (survey_answers is null or length(survey_answers) <= 8000);
