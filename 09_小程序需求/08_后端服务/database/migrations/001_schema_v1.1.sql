BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key varchar(500) NOT NULL UNIQUE,
  bucket varchar(100) NOT NULL,
  mime_type varchar(120) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256 char(64) NOT NULL,
  visibility varchar(20) NOT NULL DEFAULT 'PRIVATE',
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id varchar(64) NOT NULL,
  wechat_openid varchar(128) NOT NULL,
  wechat_unionid varchar(128),
  phone_ciphertext text,
  phone_hash char(64),
  nickname varchar(80),
  avatar_file_id uuid REFERENCES files(id),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, wechat_openid)
);
CREATE UNIQUE INDEX uq_users_phone_hash ON users(phone_hash) WHERE phone_hash IS NOT NULL;

CREATE TABLE pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  name varchar(80) NOT NULL,
  breed varchar(100) NOT NULL,
  size_class varchar(20),
  sex varchar(10),
  birth_date date,
  weight_kg numeric(6,2) CHECK (weight_kg IS NULL OR weight_kg > 0),
  vaccination_status varchar(20) NOT NULL DEFAULT 'UNKNOWN',
  vaccination_expires_on date,
  license_status varchar(20) NOT NULL DEFAULT 'UNKNOWN',
  neutered boolean,
  attack_history boolean NOT NULL DEFAULT false,
  risk_review_required boolean NOT NULL DEFAULT false,
  risk_review_status varchar(30) NOT NULL DEFAULT 'UNASSESSED',
  health_notes_ciphertext text,
  behavior_notes_ciphertext text,
  photo_file_id uuid REFERENCES files(id),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pets_owner_status ON pets(owner_user_id, status);
CREATE INDEX idx_pets_vaccine_expiry ON pets(vaccination_expires_on);

CREATE TABLE admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(80) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name varchar(80) NOT NULL,
  phone_ciphertext text,
  phone_hash char(64),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(80) NOT NULL,
  data_scope varchar(20) NOT NULL DEFAULT 'STORE',
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(100) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  resource varchar(80) NOT NULL,
  action varchar(30) NOT NULL,
  sensitive boolean NOT NULL DEFAULT false
);

CREATE TABLE admin_roles (
  admin_id uuid NOT NULL REFERENCES admins(id),
  role_id uuid NOT NULL REFERENCES roles(id),
  granted_by uuid REFERENCES admins(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_id, role_id)
);

CREATE TABLE role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id),
  permission_id uuid NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE temporary_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grantor_admin_id uuid NOT NULL REFERENCES admins(id),
  grantee_admin_id uuid NOT NULL REFERENCES admins(id),
  permission_code varchar(100) NOT NULL,
  amount_limit bigint,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  reason text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from),
  CHECK (grantor_admin_id <> grantee_admin_id)
);

CREATE TABLE agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_type varchar(50) NOT NULL,
  version varchar(20) NOT NULL,
  title varchar(200) NOT NULL,
  content_snapshot text NOT NULL,
  content_hash char(64) NOT NULL,
  change_summary text,
  change_reason text,
  requires_reacceptance boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  effective_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agreement_type, version)
);

CREATE TABLE agreement_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES agreements(id),
  user_id uuid NOT NULL REFERENCES users(id),
  pet_id uuid REFERENCES pets(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text,
  device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_agreement_acceptance
  ON agreement_acceptances(agreement_id, user_id, COALESCE(pet_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE legal_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuing_authority varchar(200) NOT NULL,
  title varchar(300) NOT NULL,
  source_url text NOT NULL,
  published_on date,
  effective_on date,
  snapshot_file_id uuid REFERENCES files(id),
  verified_at timestamptz NOT NULL,
  verified_by uuid NOT NULL REFERENCES admins(id),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE legal_catalog_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_type varchar(50) NOT NULL,
  version varchar(30) NOT NULL,
  source_id uuid NOT NULL REFERENCES legal_sources(id),
  content_snapshot jsonb NOT NULL,
  effective_on date,
  reviewed_at timestamptz NOT NULL,
  reviewed_by uuid NOT NULL REFERENCES admins(id),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  UNIQUE (catalog_type, version)
);

CREATE TABLE agreement_legal_links (
  agreement_id uuid NOT NULL REFERENCES agreements(id),
  legal_catalog_version_id uuid NOT NULL REFERENCES legal_catalog_versions(id),
  PRIMARY KEY (agreement_id, legal_catalog_version_id)
);

CREATE TABLE rule_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code varchar(100) NOT NULL,
  version integer NOT NULL,
  scope_type varchar(30) NOT NULL DEFAULT 'STORE',
  scope_id uuid,
  value_json jsonb NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  review_required_before_launch boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES admins(id),
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_code, version, scope_type, scope_id),
  CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES product_categories(id),
  name varchar(160) NOT NULL,
  product_type varchar(30) NOT NULL,
  description text,
  cover_file_id uuid REFERENCES files(id),
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  sku_code varchar(80) NOT NULL UNIQUE,
  specs jsonb NOT NULL DEFAULT '{}'::jsonb,
  list_price_amount bigint NOT NULL CHECK (list_price_amount >= 0),
  member_price_amount bigint CHECK (member_price_amount IS NULL OR member_price_amount >= 0),
  track_inventory boolean NOT NULL DEFAULT true,
  cost_method varchar(30) NOT NULL DEFAULT 'MOVING_AVERAGE',
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE card_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  version integer NOT NULL,
  name varchar(100) NOT NULL,
  card_kind varchar(20) NOT NULL,
  list_price_amount bigint NOT NULL CHECK (list_price_amount >= 0),
  sale_price_amount bigint NOT NULL CHECK (sale_price_amount >= 0),
  validity_days integer NOT NULL CHECK (validity_days > 0),
  standard_units integer,
  bonus_units integer NOT NULL DEFAULT 0 CHECK (bonus_units >= 0),
  included_people integer NOT NULL DEFAULT 2 CHECK (included_people > 0),
  included_pets integer NOT NULL DEFAULT 1 CHECK (included_pets > 0),
  daily_use_limit integer,
  max_verified_users integer NOT NULL DEFAULT 1,
  recognition_policy varchar(30) NOT NULL,
  refund_rule_version varchar(20) NOT NULL,
  rules_json jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  effective_from timestamptz,
  effective_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no varchar(40) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id),
  order_type varchar(30) NOT NULL,
  gross_amount bigint NOT NULL CHECK (gross_amount >= 0),
  discount_amount bigint NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  payable_amount bigint NOT NULL CHECK (payable_amount >= 0),
  paid_amount bigint NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  refunded_amount bigint NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  pricing_snapshot jsonb NOT NULL,
  fulfillment_type varchar(30),
  status varchar(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
  idempotency_key varchar(100) NOT NULL UNIQUE,
  paid_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_amount <= gross_amount)
);
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status_created ON orders(status, created_at DESC);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  item_type varchar(30) NOT NULL,
  product_ref_id uuid NOT NULL,
  name_snapshot varchar(200) NOT NULL,
  rule_snapshot jsonb NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_amount bigint NOT NULL CHECK (unit_price_amount >= 0),
  discount_amount bigint NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  net_amount bigint NOT NULL CHECK (net_amount >= 0),
  fulfilled_qty integer NOT NULL DEFAULT 0 CHECK (fulfilled_qty >= 0),
  cost_amount bigint,
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_no varchar(40) NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES orders(id),
  channel varchar(30) NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  channel_transaction_no varchar(100),
  status varchar(20) NOT NULL DEFAULT 'INIT',
  idempotency_key varchar(100) NOT NULL UNIQUE,
  callback_payload_hash char(64),
  requested_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_payment_channel_tx ON payments(channel, channel_transaction_no)
  WHERE channel_transaction_no IS NOT NULL;

CREATE TABLE user_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_no varchar(40) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id),
  card_product_id uuid NOT NULL REFERENCES card_products(id),
  order_item_id uuid NOT NULL REFERENCES order_items(id),
  product_snapshot jsonb NOT NULL,
  recognition_policy varchar(30) NOT NULL,
  refund_rule_version varchar(20) NOT NULL,
  actual_paid_amount bigint NOT NULL CHECK (actual_paid_amount >= 0),
  standard_units integer,
  bonus_units integer NOT NULL DEFAULT 0,
  total_units integer,
  redeemed_units integer NOT NULL DEFAULT 0,
  remaining_units integer,
  unit_recognition_amount bigint,
  rounding_remainder_amount bigint NOT NULL DEFAULT 0,
  recognized_amount bigint NOT NULL DEFAULT 0,
  unrecognized_amount bigint NOT NULL CHECK (unrecognized_amount >= 0),
  activated_at timestamptz,
  valid_from date,
  valid_until date,
  expiry_action_deadline date,
  family_member_change_count integer NOT NULL DEFAULT 0,
  status varchar(30) NOT NULL DEFAULT 'PENDING_ACTIVATION',
  lock_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_units IS NULL OR total_units = COALESCE(standard_units, 0) + bonus_units),
  CHECK (remaining_units IS NULL OR remaining_units >= 0),
  CHECK (recognized_amount + unrecognized_amount <= actual_paid_amount)
);
CREATE INDEX idx_user_cards_user_status ON user_cards(user_id, status);
CREATE INDEX idx_user_cards_expiry ON user_cards(valid_until, status);

CREATE TABLE card_family_member_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_card_id uuid NOT NULL REFERENCES user_cards(id),
  member_user_id uuid REFERENCES users(id),
  name varchar(80) NOT NULL,
  phone_ciphertext text NOT NULL,
  phone_hash char(64) NOT NULL,
  binding_sequence integer NOT NULL,
  verified_at timestamptz,
  bound_at timestamptz NOT NULL DEFAULT now(),
  unbound_at timestamptz,
  change_reason text,
  approved_by uuid REFERENCES admins(id),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE'
);
CREATE UNIQUE INDEX uq_active_card_member ON card_family_member_history(user_card_id, phone_hash)
  WHERE status = 'ACTIVE';

CREATE TABLE card_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_card_id uuid NOT NULL REFERENCES user_cards(id),
  requested_by_user_id uuid REFERENCES users(id),
  reason_type varchar(30) NOT NULL,
  reason_text text NOT NULL,
  proof_file_id uuid REFERENCES files(id),
  requested_start date NOT NULL,
  requested_days integer NOT NULL CHECK (requested_days > 0),
  approved_days integer CHECK (approved_days > 0),
  actual_start date,
  actual_end date,
  status varchar(30) NOT NULL DEFAULT 'REQUESTED',
  reviewed_by uuid REFERENCES admins(id),
  reviewed_at timestamptz,
  resumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE card_benefit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_card_id uuid NOT NULL REFERENCES user_cards(id),
  benefit_type varchar(40) NOT NULL,
  quantity_delta numeric(14,3) NOT NULL,
  cost_amount bigint NOT NULL DEFAULT 0,
  source_type varchar(40) NOT NULL,
  source_id uuid NOT NULL,
  business_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'POSTED',
  reversal_of_id uuid REFERENCES card_benefit_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, benefit_type)
);

CREATE TABLE reservation_capacity_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name varchar(120) NOT NULL,
  applies_to varchar(30) NOT NULL,
  weekday smallint,
  specific_date date,
  start_time time NOT NULL,
  end_time time NOT NULL,
  people_capacity integer NOT NULL CHECK (people_capacity >= 0),
  pet_capacity integer NOT NULL CHECK (pet_capacity >= 0),
  large_pet_capacity integer,
  small_pet_capacity integer,
  swimming_pet_capacity integer,
  risk_review_pet_capacity integer,
  effective_from date NOT NULL,
  effective_until date,
  version integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  approved_by uuid REFERENCES admins(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE TABLE reservation_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity_rule_id uuid NOT NULL REFERENCES reservation_capacity_rules(id),
  people_capacity integer NOT NULL,
  pet_capacity integer NOT NULL,
  booked_people integer NOT NULL DEFAULT 0,
  booked_pets integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_date, start_time, end_time),
  CHECK (booked_people BETWEEN 0 AND people_capacity),
  CHECK (booked_pets BETWEEN 0 AND pet_capacity)
);

CREATE TABLE reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_no varchar(40) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id),
  slot_id uuid NOT NULL REFERENCES reservation_slots(id),
  people_count integer NOT NULL CHECK (people_count > 0),
  pet_count integer NOT NULL CHECK (pet_count > 0),
  large_pet_count integer NOT NULL DEFAULT 0,
  small_pet_count integer NOT NULL DEFAULT 0,
  swimming_pet_count integer NOT NULL DEFAULT 0,
  risk_review_pet_count integer NOT NULL DEFAULT 0,
  usage_type varchar(20) NOT NULL,
  user_card_id uuid REFERENCES user_cards(id),
  order_id uuid REFERENCES orders(id),
  review_reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  health_declaration jsonb NOT NULL,
  rule_snapshot jsonb NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  reviewed_by uuid REFERENCES admins(id),
  reviewed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  no_show_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservations_slot_status ON reservations(slot_id, status);
CREATE INDEX idx_reservations_user_created ON reservations(user_id, created_at DESC);

CREATE TABLE reservation_pets (
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  pet_id uuid NOT NULL REFERENCES pets(id),
  is_swimming boolean NOT NULL DEFAULT false,
  life_jacket_required boolean NOT NULL DEFAULT false,
  risk_review_required boolean NOT NULL DEFAULT false,
  PRIMARY KEY (reservation_id, pet_id)
);

CREATE TABLE reservation_benefit_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservations(id),
  user_card_id uuid NOT NULL REFERENCES user_cards(id),
  units_locked integer NOT NULL CHECK (units_locked > 0),
  expires_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'LOCKED',
  released_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_active_reservation_lock ON reservation_benefit_locks(reservation_id, user_card_id)
  WHERE status = 'LOCKED';

CREATE TABLE closure_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_no varchar(40) NOT NULL UNIQUE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  reason text NOT NULL,
  compensation_rule jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES admins(id),
  approved_by uuid NOT NULL REFERENCES admins(id),
  status varchar(20) NOT NULL DEFAULT 'APPROVED',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no varchar(40) NOT NULL UNIQUE,
  reservation_id uuid REFERENCES reservations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  people_count integer NOT NULL CHECK (people_count > 0),
  pet_count integer NOT NULL CHECK (pet_count > 0),
  checklist_snapshot jsonb NOT NULL,
  risk_review_result varchar(30) NOT NULL,
  arrived_at timestamptz NOT NULL,
  left_at timestamptz,
  operator_id uuid NOT NULL REFERENCES admins(id),
  status varchar(20) NOT NULL DEFAULT 'IN_PROGRESS',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admission_pets (
  admission_id uuid NOT NULL REFERENCES admissions(id),
  pet_id uuid NOT NULL REFERENCES pets(id),
  risk_review_status varchar(30) NOT NULL,
  swimming boolean NOT NULL DEFAULT false,
  life_jacket_confirmed boolean,
  notes text,
  PRIMARY KEY (admission_id, pet_id)
);

CREATE TABLE dynamic_redemption_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_card_id uuid NOT NULL REFERENCES user_cards(id),
  nonce_hash char(64) NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'ISSUED',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at)
);

CREATE TABLE redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  redemption_no varchar(40) NOT NULL UNIQUE,
  batch_no varchar(40) NOT NULL,
  user_card_id uuid NOT NULL REFERENCES user_cards(id),
  admission_id uuid REFERENCES admissions(id),
  reservation_id uuid REFERENCES reservations(id),
  dynamic_code_id uuid REFERENCES dynamic_redemption_codes(id),
  units integer NOT NULL CHECK (units > 0),
  recognized_amount bigint NOT NULL DEFAULT 0,
  operator_id uuid NOT NULL REFERENCES admins(id),
  idempotency_key varchar(100) NOT NULL UNIQUE,
  status varchar(20) NOT NULL,
  failure_code varchar(50),
  reversed_redemption_id uuid REFERENCES redemptions(id),
  redeemed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_redemptions_card_time ON redemptions(user_card_id, redeemed_at DESC);

CREATE TABLE offline_admission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES reservations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  user_card_id uuid REFERENCES user_cards(id),
  occurred_at timestamptz NOT NULL,
  evidence_file_id uuid REFERENCES files(id),
  recorded_by uuid NOT NULL REFERENCES admins(id),
  validated_by uuid REFERENCES admins(id),
  validation_result varchar(30),
  linked_redemption_id uuid REFERENCES redemptions(id),
  status varchar(30) NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_no varchar(40) NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES orders(id),
  payment_id uuid NOT NULL REFERENCES payments(id),
  user_card_id uuid REFERENCES user_cards(id),
  rule_version varchar(20) NOT NULL,
  requested_amount bigint NOT NULL CHECK (requested_amount >= 0),
  base_refundable_amount bigint NOT NULL CHECK (base_refundable_amount >= 0),
  visit_reference_amount bigint,
  approved_amount bigint,
  succeeded_amount bigint NOT NULL DEFAULT 0,
  calculation_snapshot jsonb NOT NULL,
  reason text NOT NULL,
  requested_by_admin_id uuid REFERENCES admins(id),
  manager_reviewed_by uuid REFERENCES admins(id),
  final_approved_by uuid REFERENCES admins(id),
  channel_refund_no varchar(100),
  idempotency_key varchar(100) NOT NULL UNIQUE,
  status varchar(30) NOT NULL DEFAULT 'REQUESTED',
  succeeded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requested_by_admin_id IS NULL OR final_approved_by IS NULL OR requested_by_admin_id <> final_approved_by)
);

CREATE TABLE refund_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id uuid NOT NULL REFERENCES refunds(id),
  component_type varchar(40) NOT NULL,
  description text NOT NULL,
  quantity numeric(14,3),
  unit_amount bigint,
  amount bigint NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE inventory_balances (
  sku_id uuid PRIMARY KEY REFERENCES product_skus(id),
  on_hand_qty numeric(14,3) NOT NULL DEFAULT 0 CHECK (on_hand_qty >= 0),
  reserved_qty numeric(14,3) NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  average_cost_amount bigint NOT NULL DEFAULT 0 CHECK (average_cost_amount >= 0),
  lock_version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (reserved_qty <= on_hand_qty)
);

CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_no varchar(40) NOT NULL UNIQUE,
  sku_id uuid NOT NULL REFERENCES product_skus(id),
  movement_type varchar(30) NOT NULL,
  quantity_delta numeric(14,3) NOT NULL,
  unit_cost_amount bigint NOT NULL CHECK (unit_cost_amount >= 0),
  total_cost_amount bigint NOT NULL,
  source_type varchar(40) NOT NULL,
  source_id uuid NOT NULL,
  order_item_id uuid REFERENCES order_items(id),
  operator_id uuid REFERENCES admins(id),
  occurred_at timestamptz NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'POSTED',
  reversal_of_id uuid REFERENCES inventory_movements(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, sku_id, movement_type)
);

CREATE TABLE revenue_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recognition_no varchar(40) NOT NULL UNIQUE,
  source_type varchar(40) NOT NULL,
  source_id uuid NOT NULL,
  user_card_id uuid REFERENCES user_cards(id),
  order_item_id uuid REFERENCES order_items(id),
  amount bigint NOT NULL,
  recognition_date date NOT NULL,
  policy varchar(30) NOT NULL,
  policy_version varchar(20) NOT NULL,
  calculation_snapshot jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'POSTED',
  reversal_of_id uuid REFERENCES revenue_recognitions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, policy, policy_version)
);
CREATE INDEX idx_revenue_date ON revenue_recognitions(recognition_date);

CREATE TABLE deferred_entitlement_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no varchar(40) NOT NULL UNIQUE,
  user_card_id uuid NOT NULL REFERENCES user_cards(id),
  entry_type varchar(40) NOT NULL,
  amount_delta bigint NOT NULL,
  source_type varchar(40) NOT NULL,
  source_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL,
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  reversal_of_id uuid REFERENCES deferred_entitlement_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, entry_type)
);

CREATE TABLE cash_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  account_type varchar(40) NOT NULL,
  opening_balance_amount bigint,
  opening_balance_confirmed_by uuid REFERENCES admins(id),
  opening_balance_confirmed_at timestamptz,
  is_available_cash boolean NOT NULL DEFAULT false,
  restricted_reason text,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cash_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no varchar(40) NOT NULL UNIQUE,
  account_id uuid NOT NULL REFERENCES cash_accounts(id),
  direction varchar(10) NOT NULL CHECK (direction IN ('INFLOW','OUTFLOW')),
  business_type varchar(50) NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  source_type varchar(40) NOT NULL,
  source_id uuid NOT NULL,
  counterparty varchar(200),
  shareholder_fund_type varchar(30),
  value_at timestamptz NOT NULL,
  transfer_group_id uuid,
  status varchar(20) NOT NULL DEFAULT 'POSTED',
  reversal_of_id uuid REFERENCES cash_ledger(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_id, account_id, business_type)
);

CREATE TABLE operating_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_no varchar(40) NOT NULL UNIQUE,
  category varchar(50) NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  business_date date NOT NULL,
  belonging_month date NOT NULL,
  payee varchar(200) NOT NULL,
  purpose text NOT NULL,
  cash_account_id uuid REFERENCES cash_accounts(id),
  payment_method varchar(30),
  applicant_id uuid NOT NULL REFERENCES admins(id),
  voucher_file_id uuid REFERENCES files(id),
  invoice_status varchar(30),
  is_fixed boolean NOT NULL DEFAULT false,
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  paid_at timestamptz,
  reversal_of_id uuid REFERENCES operating_expenses(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expense_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES operating_expenses(id),
  approval_level varchar(30) NOT NULL,
  approver_id uuid NOT NULL REFERENCES admins(id),
  decision varchar(20) NOT NULL,
  comment text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision IN ('APPROVED','REJECTED')),
  UNIQUE (expense_id, approval_level)
);

CREATE TABLE accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL UNIQUE,
  cutoff_at timestamptz NOT NULL,
  supplemental_deadline timestamptz NOT NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES admins(id),
  reopened_at timestamptz,
  reopened_by uuid REFERENCES admins(id),
  reopen_reason text,
  status varchar(20) NOT NULL DEFAULT 'OPEN'
);

CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code varchar(50) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  contact_name varchar(80),
  phone_ciphertext text,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_no varchar(40) NOT NULL UNIQUE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  total_amount bigint NOT NULL CHECK (total_amount >= 0),
  ordered_at timestamptz,
  received_at timestamptz,
  applicant_id uuid NOT NULL REFERENCES admins(id),
  approved_by uuid REFERENCES admins(id),
  status varchar(30) NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
  sku_id uuid NOT NULL REFERENCES product_skus(id),
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  received_quantity numeric(14,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit_cost_amount bigint NOT NULL CHECK (unit_cost_amount >= 0),
  expiry_date date,
  UNIQUE (purchase_order_id, sku_id)
);

CREATE TABLE revenue_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_card_id uuid NOT NULL REFERENCES user_cards(id),
  schedule_date date NOT NULL,
  scheduled_amount bigint NOT NULL CHECK (scheduled_amount >= 0),
  pause_id uuid REFERENCES card_pauses(id),
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  recognition_id uuid REFERENCES revenue_recognitions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_card_id, schedule_date)
);

CREATE TABLE financial_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_no varchar(40) NOT NULL UNIQUE,
  target_type varchar(60) NOT NULL,
  target_id uuid NOT NULL,
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb NOT NULL,
  reason text NOT NULL,
  evidence_file_id uuid REFERENCES files(id),
  requested_by uuid NOT NULL REFERENCES admins(id),
  approved_by uuid REFERENCES admins(id),
  status varchar(20) NOT NULL DEFAULT 'REQUESTED',
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requested_by <> approved_by)
);

CREATE TABLE metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code varchar(80) NOT NULL,
  period_type varchar(20) NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  value_numeric numeric(24,6) NOT NULL,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  dimension_hash char(64) NOT NULL,
  formula_version varchar(30) NOT NULL,
  source_max_time timestamptz,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_code, period_type, period_start, period_end, dimension_hash, formula_version)
);

CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  campaign_type varchar(40) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  audience_rule jsonb NOT NULL,
  benefit_rule jsonb NOT NULL,
  stack_rule jsonb NOT NULL,
  budget_amount bigint,
  quota integer,
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_no varchar(50) NOT NULL UNIQUE,
  campaign_id uuid REFERENCES campaigns(id),
  user_id uuid NOT NULL REFERENCES users(id),
  coupon_type varchar(40) NOT NULL,
  face_value_amount bigint,
  threshold_amount bigint,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  rule_snapshot jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ISSUED',
  used_order_id uuid REFERENCES orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from)
);

CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL REFERENCES users(id),
  invitee_user_id uuid NOT NULL REFERENCES users(id),
  invite_code varchar(50) NOT NULL,
  registered_at timestamptz NOT NULL,
  qualified_at timestamptz,
  qualifying_order_id uuid REFERENCES orders(id),
  reward_coupon_id uuid REFERENCES coupons(id),
  calendar_month date,
  risk_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'REGISTERED',
  UNIQUE (invitee_user_id)
);
CREATE INDEX idx_referrals_inviter_month ON referrals(inviter_user_id, calendar_month);

CREATE TABLE incident_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_no varchar(40) NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL,
  location varchar(120) NOT NULL,
  people_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  pets_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text NOT NULL,
  camera_device_no varchar(80),
  video_time_from timestamptz,
  video_time_to timestamptz,
  evidence_file_id uuid REFERENCES files(id),
  handled_by uuid NOT NULL REFERENCES admins(id),
  result text,
  severity varchar(20) NOT NULL,
  evidence_restricted boolean NOT NULL DEFAULT false,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE responsibility_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsibility_type varchar(60) NOT NULL,
  primary_admin_id uuid REFERENCES admins(id),
  backup_admin_id uuid REFERENCES admins(id),
  contact_ciphertext text,
  scope_text text NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  authorization_status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE metric_threshold_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code varchar(80) NOT NULL,
  version integer NOT NULL,
  thresholds_json jsonb NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  approved_by uuid NOT NULL REFERENCES admins(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric_code, version)
);

CREATE TABLE legacy_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_no varchar(40) NOT NULL UNIQUE,
  source_file_id uuid NOT NULL REFERENCES files(id),
  source_sha256 char(64) NOT NULL,
  row_count integer NOT NULL,
  valid_count integer NOT NULL DEFAULT 0,
  invalid_count integer NOT NULL DEFAULT 0,
  validation_report_file_id uuid REFERENCES files(id),
  confirmed_by uuid REFERENCES admins(id),
  confirmed_at timestamptz,
  status varchar(30) NOT NULL DEFAULT 'UPLOADED',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  notification_type varchar(60) NOT NULL,
  source_type varchar(50) NOT NULL,
  source_id uuid NOT NULL,
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz,
  template_version varchar(30) NOT NULL,
  payload_snapshot jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_type, source_type, source_id, scheduled_at)
);

CREATE TABLE sensitive_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admins(id),
  resource_type varchar(60) NOT NULL,
  resource_id uuid NOT NULL,
  field_name varchar(80) NOT NULL,
  reason text NOT NULL,
  ip inet,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id varchar(100) NOT NULL,
  actor_type varchar(20) NOT NULL,
  actor_id uuid,
  action varchar(80) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  ip inet,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id, occurred_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, occurred_at DESC);

CREATE TABLE outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type varchar(80) NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'PENDING'
);
CREATE INDEX idx_outbox_pending ON outbox_events(status, occurred_at);

COMMIT;
