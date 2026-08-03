-- 0102: Configurable onboarding — templates + per-employee instances
--
-- Replaces the single hardcoded 2-task onboarding automation
-- (runHireToOnboarding: "Complete your profile" + "Take your first
-- assessment") with a real, admin-configurable checklist, per the
-- 2026-08-03 strategic memo's "Onboarding Experience Review" item.
-- Deliberately simple rather than a full workflow engine (matches the
-- memo's own "simplicity over complexity" principle): three step types
-- (task, knowledge_hub, manager_approval), a flat ordered list, no
-- branching/conditionals.
--
-- Two-table pairs, same "template vs. snapshot instance" split already
-- used for performance review cycles elsewhere in this schema:
-- onboarding_templates/_steps are what an admin authors and can keep
-- editing; onboarding_instances/_instance_steps are what actually got
-- assigned to a real person at a point in time — instance_steps SNAPSHOTS
-- title/description/step_type/knowledge_hub_content_id rather than just
-- referencing the template step, so editing a template later never
-- silently changes what's already been assigned to someone mid-onboarding.

create table if not exists public.onboarding_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default 'Default onboarding',
  -- Exactly one default template per org is what auto-instantiation looks
  -- for; multiple non-default templates could exist for future use
  -- (e.g. per-department checklists) without a schema change later.
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_template_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates(id) on delete cascade,
  position integer not null default 0,
  step_type text not null check (step_type in ('task', 'knowledge_hub', 'manager_approval')),
  title text not null,
  description text,
  -- Only meaningful when step_type = 'knowledge_hub' — lets an onboarding
  -- step point at a real Knowledge Hub document/policy instead of
  -- building a second, parallel "required reading" system from scratch.
  knowledge_hub_content_id uuid references public.knowledge_hub_content(id) on delete set null,
  due_offset_days integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.onboarding_instances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.onboarding_templates(id) on delete set null,
  started_at timestamptz not null default now()
);

create table if not exists public.onboarding_instance_steps (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.onboarding_instances(id) on delete cascade,
  template_step_id uuid references public.onboarding_template_steps(id) on delete set null,
  position integer not null default 0,
  step_type text not null check (step_type in ('task', 'knowledge_hub', 'manager_approval')),
  title text not null,
  description text,
  knowledge_hub_content_id uuid references public.knowledge_hub_content(id) on delete set null,
  due_date date,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null
);

alter table public.onboarding_templates enable row level security;
alter table public.onboarding_template_steps enable row level security;
alter table public.onboarding_instances enable row level security;
alter table public.onboarding_instance_steps enable row level security;

-- Templates: admins fully manage; any org member can read (the new
-- employee's OWN session is what instantiates their onboarding at
-- signup time — this app has no service-role key, so that read has to
-- go through the acting employee's own RLS-permitted access, same
-- reasoning as workflow_automation_settings' member-readable policy).
drop policy if exists "Org admins can manage onboarding templates" on public.onboarding_templates;
create policy "Org admins can manage onboarding templates"
  on public.onboarding_templates for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "Org members can view onboarding templates" on public.onboarding_templates;
create policy "Org members can view onboarding templates"
  on public.onboarding_templates for select
  using (public.is_org_member(organization_id));

drop policy if exists "Org admins can manage onboarding template steps" on public.onboarding_template_steps;
create policy "Org admins can manage onboarding template steps"
  on public.onboarding_template_steps for all
  using (exists (select 1 from public.onboarding_templates t where t.id = onboarding_template_steps.template_id and public.is_org_admin(t.organization_id)))
  with check (exists (select 1 from public.onboarding_templates t where t.id = onboarding_template_steps.template_id and public.is_org_admin(t.organization_id)));

drop policy if exists "Org members can view onboarding template steps" on public.onboarding_template_steps;
create policy "Org members can view onboarding template steps"
  on public.onboarding_template_steps for select
  using (exists (
    select 1 from public.onboarding_templates t
    where t.id = onboarding_template_steps.template_id and public.is_org_member(t.organization_id)
  ));

-- Instances: the new employee creates their OWN instance (self-scoped,
-- fires from inside their own signup/invite-consumption request); org
-- admins can read every instance in their org for oversight.
drop policy if exists "Employees can create their own onboarding instance" on public.onboarding_instances;
create policy "Employees can create their own onboarding instance"
  on public.onboarding_instances for insert
  with check (employee_user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists "Employees can view their own onboarding instance" on public.onboarding_instances;
create policy "Employees can view their own onboarding instance"
  on public.onboarding_instances for select
  using (employee_user_id = auth.uid());

drop policy if exists "Org admins can view their org's onboarding instances" on public.onboarding_instances;
create policy "Org admins can view their org's onboarding instances"
  on public.onboarding_instances for select
  using (public.is_org_admin(organization_id));

-- Instance steps: the employee can create + view + complete their own
-- non-approval steps; a reporting-line manager can view + approve
-- 'manager_approval' steps for their own reports specifically (never
-- someone else's); org admins can view everything in their org.
drop policy if exists "Employees can create their own onboarding steps" on public.onboarding_instance_steps;
create policy "Employees can create their own onboarding steps"
  on public.onboarding_instance_steps for insert
  with check (exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and i.employee_user_id = auth.uid()));

drop policy if exists "Employees can view their own onboarding steps" on public.onboarding_instance_steps;
create policy "Employees can view their own onboarding steps"
  on public.onboarding_instance_steps for select
  using (exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and i.employee_user_id = auth.uid()));

drop policy if exists "Employees can complete their own non-approval steps" on public.onboarding_instance_steps;
create policy "Employees can complete their own non-approval steps"
  on public.onboarding_instance_steps for update
  using (
    step_type <> 'manager_approval'
    and exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and i.employee_user_id = auth.uid())
  )
  with check (
    step_type <> 'manager_approval'
    and exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and i.employee_user_id = auth.uid())
  );

drop policy if exists "Managers can view their reports' onboarding steps" on public.onboarding_instance_steps;
create policy "Managers can view their reports' onboarding steps"
  on public.onboarding_instance_steps for select
  using (exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and public.is_manager_of_user(i.employee_user_id)));

drop policy if exists "Managers can approve their reports' approval steps" on public.onboarding_instance_steps;
create policy "Managers can approve their reports' approval steps"
  on public.onboarding_instance_steps for update
  using (
    step_type = 'manager_approval'
    and exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and public.is_manager_of_user(i.employee_user_id))
  )
  with check (
    step_type = 'manager_approval'
    and exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and public.is_manager_of_user(i.employee_user_id))
  );

drop policy if exists "Org admins can view their org's onboarding steps" on public.onboarding_instance_steps;
create policy "Org admins can view their org's onboarding steps"
  on public.onboarding_instance_steps for select
  using (exists (select 1 from public.onboarding_instances i where i.id = onboarding_instance_steps.instance_id and public.is_org_admin(i.organization_id)));

create index if not exists onboarding_template_steps_template_idx on public.onboarding_template_steps (template_id, position);
create index if not exists onboarding_instances_employee_idx on public.onboarding_instances (employee_user_id);
create index if not exists onboarding_instance_steps_instance_idx on public.onboarding_instance_steps (instance_id, position);
