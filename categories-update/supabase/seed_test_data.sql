-- TEST DATA ONLY. Fills an existing account with a sample child, closet, goals, shopping list and measurements,
-- so you can try every screen without typing data in by hand.
--
-- How to use:
--   1. Create the account first (sign up on the site, or Supabase > Authentication > Users > Add user).
--   2. Change the email on the line marked CHANGE ME to that account's email.
--   3. Paste the whole script into the Supabase SQL editor and run it.
-- Safe to run again: it replaces the sample child named "Demo Baby" and leaves your other children alone.
-- Brand names here are made up ("Sample ...") and the ratings and measurements are invented.

do $$
declare
  v_email text := 'test1@example.com';  -- CHANGE ME
  v_user uuid;
  v_child uuid;
  v_today date := current_date;
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'No account found for %. Create it first, then check the email on the CHANGE ME line.', v_email;
  end if;

  -- Start fresh for the sample child. Items, goals, shopping and measurements go with it.
  delete from public.children where owner_id = v_user and name = 'Demo Baby';

  -- Sample brands. The offsets are invented: positive runs large, negative runs small.
  insert into public.brands (name, owner_id, size_offset)
  select b.name, v_user, b.off
  from (values ('Sample True', 0::numeric), ('Sample Small', -0.5), ('Sample Big', 0.75)) as b(name, off)
  where not exists (select 1 from public.brands x where x.owner_id = v_user and lower(x.name) = lower(b.name));

  -- A 7-month-old girl in size 6-9M.
  insert into public.children (owner_id, name, birth_date, growth_reference, current_size_id)
  values (v_user, 'Demo Baby', (v_today - interval '7 months')::date, 'girls',
          (select id from public.sizes where label = '6-9M'))
  returning id into v_child;

  insert into public.measurements (child_id, measured_on, length_in) values
    (v_child, (v_today - interval '4 months')::date, 24.00),
    (v_child, (v_today - interval '2 months')::date, 25.50),
    (v_child, (v_today - interval '2 weeks')::date, 26.75);

  -- Closet: name, category, brand, tag label, fit from, fit to, quantity, condition, status, fit rating, season.
  -- A blank tag or fit range means "unknown", which does not count toward goals.
  insert into public.inventory_items
    (child_id, tracking_type, name, brand_id, category_id, label_id, fit_from_size_id, fit_to_size_id,
     quantity, condition, status, fit_feedback, season)
  select v_child, case when i.qty > 1 then 'grouped' else 'individual' end, i.name,
         (select id from public.brands b where b.owner_id = v_user and b.name = i.brand),
         (select id from public.categories c where c.owner_id is null and c.name = i.cat),
         (select l.id from public.size_labels l where l.label = i.tag limit 1),
         (select id from public.sizes where label = i.f_from),
         (select id from public.sizes where label = i.f_to),
         i.qty, i.cond, i.status, i.fb, i.season
  from (values
    ('White bodysuits, 3-pack',   'Short-sleeve bodysuit', 'Sample True',  '6-9M', '6-9M',  '6-9M',  3, 'good',     'active',   0,    'year_round'),
    ('Floral bodysuit',           'Short-sleeve bodysuit', 'Sample Small', '6M',   '3-6M',  '6-9M',  1, 'good',     'active',   -1,   'summer'),
    ('Long-sleeve bodysuit',     'Long-sleeve bodysuit',  'Sample True',  '9M',   '6-9M',  '6-9M',  2, 'new',      'active',   0,    'year_round'),
    ('Fleece pullover',           'Top',                   'Sample Big',   '12M',  '9-12M', '12-18M',1, 'new',      'active',   1,    'winter'),
    ('Leggings, 4-pack',          'Pants',                'Sample True',  '6-9M', '6-9M',  '6-9M',  4, 'good',     'active',   0,    'year_round'),
    ('Jeans',                     'Pants',                'Sample Big',   '12M',  '9-12M', '9-12M', 1, 'new',      'active',   1,    'year_round'),
    ('Cotton footie pajamas',     'Footy sleeper',         'Sample Small', '3-6M', '3-6M',  '3-6M',  2, 'worn',     'active',   -1,   'year_round'),
    ('Zip sleepers',              'Footy sleeper',         'Sample True',  '6-9M', '6-9M',  '6-9M',  2, 'good',     'active',   0,    'year_round'),
    ('Sleep sack',                'Sleep sack',            'Sample True',  '6-9M', '6-9M',  '6-9M',  1, 'like_new', 'active',   0,    'year_round'),
    ('Swaddle',                  'Swaddle',               'Sample True',  '0-3M', '0-3M',  '0-3M',  2, 'good',     'stored',   null, 'year_round'),
    ('Holiday dress',             'Dress',                  'Sample Big',   '12M',  '9-12M', '9-12M', 1, 'new',      'active',   null, 'winter'),
    ('Matching sets',             'Matching set',                'Sample True',  '6-9M', '6-9M',  '6-9M',  2, 'good',     'active',   0,    'year_round'),
    ('Stained romper',            'Romper',                'Sample Small', '6-9M', '6-9M',  '6-9M',  1, 'unusable', 'active',   null, 'year_round'),
    ('Sun hats',                  'Hat',            null,           null,   null,    null,    2, 'good',     'active',   null, 'summer'),
    ('Winter coat',               'Coat',              'Sample Big',   '12M',  '9-12M', '12-18M',1, 'like_new', 'active',   1,    'winter'),
    ('Swimsuit',                  'Swimsuit',               'Sample True',  '9M',   '6-9M',  '9-12M', 1, 'good',     'active',   0,    'summer'),
    ('Old onesies',               'Short-sleeve bodysuit', 'Sample True',  '6M',   '3-6M',  '3-6M',  3, 'worn',     'donated',  null, 'year_round')
  ) as i(name, cat, brand, tag, f_from, f_to, qty, cond, status, fb, season);

  -- Goals for the current and next two sizes.
  insert into public.wardrobe_goals (child_id, category_id, size_id, target_quantity)
  select v_child, (select id from public.categories c where c.owner_id is null and c.name = g.cat),
         (select id from public.sizes where label = g.sz), g.target
  from (values
    ('6-9M',  'Short-sleeve bodysuit', 8), ('6-9M', 'Long-sleeve bodysuit', 4), ('6-9M', 'Top', 4),
    ('6-9M',  'Pants', 8), ('6-9M', 'Footy sleeper', 6), ('6-9M', 'Sleep sack', 2), ('6-9M', 'Romper', 4),
    ('6-9M',  'Socks', 8),
    ('9-12M', 'Short-sleeve bodysuit', 8), ('9-12M', 'Pants', 6), ('9-12M', 'Footy sleeper', 6),
    ('12-18M','Short-sleeve bodysuit', 6), ('12-18M', 'Coat', 1)
  ) as g(sz, cat, target);

  -- Shopping: one still needed, two already ordered (use Receive on the Shopping page to try deliveries).
  insert into public.shopping_items
    (child_id, category_id, size_id, quantity_needed, quantity_ordered, status, priority, estimated_price, notes)
  select v_child, (select id from public.categories c where c.owner_id is null and c.name = s.cat),
         (select id from public.sizes where label = s.sz), s.needed, s.ordered, s.status, s.prio, s.price, s.note
  from (values
    ('Top',           '9-12M', 3, 0, 'needed',  'high',   12.50, 'Sample entry'),
    ('Footy sleeper', '9-12M', 4, 4, 'ordered', 'medium', 14.00, 'Sample entry'),
    ('Pants',        '9-12M', 4, 4, 'ordered', 'low',     9.00, 'Sample entry')
  ) as s(cat, sz, needed, ordered, status, prio, price, note);

  raise notice 'Added the sample child "Demo Baby" to %.', v_email;
end $$;
