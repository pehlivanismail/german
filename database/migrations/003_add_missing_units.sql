-- Utility migration to ensure all units referenced by questions exist
with required_units as (
  select distinct unit_id as id
  from questions
  where unit_id is not null
)
insert into units (id, category_id, title, order_index)
select
  ru.id,
  'vocabulary',
  ru.id,
  0
from required_units ru
left join units u on u.id = ru.id
where u.id is null;

