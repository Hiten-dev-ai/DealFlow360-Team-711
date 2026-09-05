BEGIN;

UPDATE workspace_memberships SET role = CASE role WHEN 'owner' THEN 'admin' WHEN 'operator' THEN 'sales_rep' ELSE role END;
UPDATE sessions SET active_role = CASE active_role WHEN 'owner' THEN 'admin' WHEN 'operator' THEN 'sales_rep' ELSE active_role END;

ALTER TABLE workspace_memberships DROP CONSTRAINT IF EXISTS workspace_memberships_role_check;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_active_role_check;
ALTER TABLE workspace_memberships ADD CONSTRAINT workspace_memberships_role_check CHECK (role IN ('admin', 'sales_rep', 'sales_manager', 'finance_ops'));
ALTER TABLE sessions ADD CONSTRAINT sessions_active_role_check CHECK (active_role IN ('admin', 'sales_rep', 'sales_manager', 'finance_ops'));
CREATE UNIQUE INDEX IF NOT EXISTS workspace_memberships_one_role_idx ON workspace_memberships(user_id, workspace_id);

CREATE TABLE IF NOT EXISTS sales_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  manager_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

ALTER TABLE workspace_memberships ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES sales_teams(id) ON DELETE SET NULL;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS desktop_alerts boolean NOT NULL DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS sound_alerts boolean NOT NULL DEFAULT true;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS priority_only boolean NOT NULL DEFAULT false;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS dnd boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'sales_rep', 'sales_manager', 'finance_ops')),
  team_id uuid REFERENCES sales_teams(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  overdue_risk integer NOT NULL DEFAULT 0 CHECK (overdue_risk BETWEEN 0 AND 100),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES customer_tiers(id),
  name text NOT NULL,
  email text NOT NULL,
  company text NOT NULL,
  overdue_minor bigint NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product_categories(id),
  sku text NOT NULL,
  name text NOT NULL,
  billing_type text NOT NULL CHECK (billing_type IN ('one_time', 'recurring')),
  cadence text CHECK (cadence IN ('monthly', 'quarterly', 'yearly')),
  price_minor bigint NOT NULL CHECK (price_minor >= 0),
  cost_minor bigint NOT NULL CHECK (cost_minor >= 0),
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  UNIQUE (workspace_id, sku)
);

CREATE TABLE IF NOT EXISTS discount_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES customer_tiers(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  ceiling_bps integer NOT NULL CHECK (ceiling_bps BETWEEN 0 AND 10000),
  UNIQUE (workspace_id, tier_id, category_id)
);

CREATE TABLE IF NOT EXISTS approval_settings (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  manager_score integer NOT NULL DEFAULT 40,
  finance_score integer NOT NULL DEFAULT 70,
  finance_value_minor bigint NOT NULL DEFAULT 100000000,
  margin_floor_bps integer NOT NULL DEFAULT 2000,
  discount_weight integer NOT NULL DEFAULT 45,
  margin_weight integer NOT NULL DEFAULT 30,
  value_weight integer NOT NULL DEFAULT 15,
  overdue_weight integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upsell_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  suggested_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (workspace_id, source_product_id, suggested_product_id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  quote_number bigint GENERATED BY DEFAULT AS IDENTITY,
  customer_id uuid NOT NULL REFERENCES customers(id),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  team_id uuid NOT NULL REFERENCES sales_teams(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_manager','pending_finance','approved','negotiation','accepted','rejected','expired')),
  revision integer NOT NULL DEFAULT 1,
  subtotal_minor bigint NOT NULL DEFAULT 0,
  discount_minor bigint NOT NULL DEFAULT 0,
  total_minor bigint NOT NULL DEFAULT 0,
  cost_minor bigint NOT NULL DEFAULT 0,
  margin_bps integer NOT NULL DEFAULT 0,
  risk_score integer NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  approval_route text[] NOT NULL DEFAULT '{}',
  valid_until date,
  version integer NOT NULL DEFAULT 1,
  submitted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, quote_number)
);

CREATE TABLE IF NOT EXISTS quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  unit_cost_minor bigint NOT NULL CHECK (unit_cost_minor >= 0),
  discount_bps integer NOT NULL DEFAULT 0 CHECK (discount_bps BETWEEN 0 AND 10000),
  billing_type text NOT NULL CHECK (billing_type IN ('one_time','recurring')),
  cadence text CHECK (cadence IN ('monthly','quarterly','yearly')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  snapshot jsonb NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, revision)
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  quote_revision integer NOT NULL,
  stage text NOT NULL CHECK (stage IN ('manager','finance')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','superseded')),
  assigned_team_id uuid REFERENCES sales_teams(id),
  decided_by uuid REFERENCES users(id),
  reason text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, quote_revision, stage)
);

CREATE TABLE IF NOT EXISTS negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  quote_revision integer NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('staff','customer')),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('comment','counteroffer','accept','reject')),
  message text,
  requested_lines jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  shipping_cost_minor bigint NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (workspace_id, code)
);

CREATE TABLE IF NOT EXISTS inventory_levels (
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  available_quantity integer NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
  reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND reserved_quantity <= available_quantity),
  version integer NOT NULL DEFAULT 1,
  PRIMARY KEY (warehouse_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL UNIQUE REFERENCES quotes(id),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','reserved','picking','partially_shipped','shipped','completed','backorder')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','picking','shipped','delivered','backorder')),
  shipping_cost_minor bigint NOT NULL DEFAULT 0,
  lines jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  quote_id uuid NOT NULL REFERENCES quotes(id),
  product_id uuid NOT NULL REFERENCES products(id),
  cadence text NOT NULL CHECK (cadence IN ('monthly','quarterly','yearly')),
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  starts_on date NOT NULL,
  next_bill_on date NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  quote_id uuid REFERENCES quotes(id),
  subscription_id uuid REFERENCES subscriptions(id),
  period_start date,
  period_end date,
  invoice_number bigint GENERATED BY DEFAULT AS IDENTITY,
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('draft','due','partially_paid','paid','overdue','void')),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  paid_minor bigint NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  due_on date NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL,
  unit_price_minor bigint NOT NULL,
  amount_minor bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  reference text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL REFERENCES users(id),
  idempotency_key text NOT NULL,
  UNIQUE (invoice_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS deal_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low','medium','high')),
  title text NOT NULL,
  message text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  target_type text,
  target_id uuid,
  priority boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_changes (
  cursor bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid,
  operation text NOT NULL CHECK (operation IN ('upsert','delete')),
  version integer,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quotes_workspace_status_idx ON quotes(workspace_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS quotes_owner_idx ON quotes(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS approval_requests_pending_idx ON approval_requests(stage, status, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, dismissed_at, created_at DESC);
CREATE INDEX IF NOT EXISTS sync_changes_workspace_cursor_idx ON sync_changes(workspace_id, cursor);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_subscription_period_idx ON invoices(subscription_id, period_start) WHERE subscription_id IS NOT NULL;

INSERT INTO approval_settings (workspace_id)
VALUES ('00000000-0000-4000-8000-000000000711')
ON CONFLICT (workspace_id) DO NOTHING;

COMMIT;
