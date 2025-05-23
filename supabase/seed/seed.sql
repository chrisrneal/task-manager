-- Sample data for the new workflow-related tables

-- Sample project states for a project (assuming project id exists)
INSERT INTO project_states (id, project_id, name, position)
VALUES
  ('11111111-1111-1111-1111-111111111111', (SELECT id FROM projects LIMIT 1), 'To Do', 1),
  ('22222222-2222-2222-2222-222222222222', (SELECT id FROM projects LIMIT 1), 'In Progress', 2),
  ('33333333-3333-3333-3333-333333333333', (SELECT id FROM projects LIMIT 1), 'In Review', 3),
  ('44444444-4444-4444-4444-444444444444', (SELECT id FROM projects LIMIT 1), 'Done', 4);

-- Sample workflows
INSERT INTO workflows (id, project_id, name)
VALUES
  ('55555555-5555-5555-5555-555555555555', (SELECT id FROM projects LIMIT 1), 'Standard Workflow'),
  ('66666666-6666-6666-6666-666666666666', (SELECT id FROM projects LIMIT 1), 'Expedited Workflow');

-- Sample workflow steps for the standard workflow
INSERT INTO workflow_steps (workflow_id, state_id, step_order)
VALUES
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 1),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', 2),
  ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 3),
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 4);

-- Sample workflow steps for the expedited workflow (skips review)
INSERT INTO workflow_steps (workflow_id, state_id, step_order)
VALUES
  ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 1),
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 2),
  ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 3);

-- Sample task types
INSERT INTO task_types (id, project_id, name, workflow_id)
VALUES
  ('77777777-7777-7777-7777-777777777777', (SELECT id FROM projects LIMIT 1), 'Bug', '55555555-5555-5555-5555-555555555555'),
  ('88888888-8888-8888-8888-888888888888', (SELECT id FROM projects LIMIT 1), 'Feature', '55555555-5555-5555-5555-555555555555'),
  ('99999999-9999-9999-9999-999999999999', (SELECT id FROM projects LIMIT 1), 'Hotfix', '66666666-6666-6666-6666-666666666666');

-- Update existing tasks to link to task types and states
UPDATE tasks
SET 
  task_type_id = '77777777-7777-7777-7777-777777777777',
  state_id = '11111111-1111-1111-1111-111111111111'
WHERE project_id = (SELECT id FROM projects LIMIT 1)
LIMIT 1;

UPDATE tasks
SET 
  task_type_id = '88888888-8888-8888-8888-888888888888',
  state_id = '22222222-2222-2222-2222-222222222222'
WHERE project_id = (SELECT id FROM projects LIMIT 1)
AND id NOT IN (SELECT id FROM tasks WHERE task_type_id IS NOT NULL)
LIMIT 1;