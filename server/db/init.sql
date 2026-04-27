-- Schema and seed data for the pointz card catalog.
-- Loaded automatically by the Postgres Docker image on first init
-- (files in /docker-entrypoint-initdb.d run only when the data dir is empty).

CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,
  issuer      TEXT NOT NULL,
  name        TEXT NOT NULL,
  network     TEXT,
  annual_fee  INTEGER
);

CREATE TABLE IF NOT EXISTS reward_rules (
  id           BIGSERIAL PRIMARY KEY,
  card_id      TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  rate         NUMERIC NOT NULL,
  reward_type  TEXT NOT NULL,
  cap_amount   NUMERIC,
  cap_period   TEXT,
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS reward_rules_card_id_idx ON reward_rules (card_id);
CREATE INDEX IF NOT EXISTS reward_rules_category_idx ON reward_rules (category);

-- Seed cards
INSERT INTO cards (id, issuer, name, network, annual_fee) VALUES
  ('amex-gold', 'American Express', 'American Express Gold Card', 'amex', 325),
  ('chase-sapphire-preferred', 'Chase', 'Chase Sapphire Preferred', 'visa', 95),
  ('chase-sapphire-reserve', 'Chase', 'Chase Sapphire Reserve', 'visa', 550),
  ('chase-freedom-unlimited', 'Chase', 'Chase Freedom Unlimited', 'visa', 0),
  ('chase-freedom-flex', 'Chase', 'Chase Freedom Flex', 'mastercard', 0),
  ('citi-double-cash', 'Citi', 'Citi Double Cash', 'mastercard', 0),
  ('citi-custom-cash', 'Citi', 'Citi Custom Cash', 'mastercard', 0),
  ('capital-one-savor-cash', 'Capital One', 'Capital One Savor Cash Rewards', 'mastercard', 0),
  ('capital-one-venture-rewards', 'Capital One', 'Capital One Venture Rewards', 'visa', 95),
  ('capital-one-venture-x', 'Capital One', 'Capital One Venture X Rewards', 'visa', 395),
  ('blue-cash-preferred', 'American Express', 'Blue Cash Preferred Card', 'amex', 95),
  ('blue-cash-everyday', 'American Express', 'Blue Cash Everyday Card', 'amex', 0),
  ('discover-it-cash-back', 'Discover', 'Discover it Cash Back', 'discover', 0),
  ('wells-fargo-active-cash', 'Wells Fargo', 'Wells Fargo Active Cash', 'visa', 0),
  ('wells-fargo-autograph', 'Wells Fargo', 'Wells Fargo Autograph Card', 'visa', 0),
  ('bank-of-america-customized-cash', 'Bank of America', 'Bank of America Customized Cash Rewards', 'visa', 0),
  ('us-bank-altitude-go', 'U.S. Bank', 'U.S. Bank Altitude Go Visa Signature', 'visa', 0),
  ('us-bank-cash-plus', 'U.S. Bank', 'U.S. Bank Cash+ Visa Signature', 'visa', 0),
  ('bilt-mastercard', 'Wells Fargo', 'Bilt Mastercard', 'mastercard', 0),
  ('apple-card', 'Goldman Sachs', 'Apple Card', 'mastercard', 0),
  ('paypal-cashback-mastercard', 'Synchrony', 'PayPal Cashback Mastercard', 'mastercard', 0),
  ('amazon-prime-visa', 'Chase', 'Prime Visa', 'visa', 0),
  ('costco-anywhere-visa', 'Citi', 'Costco Anywhere Visa Card', 'visa', 0),
  ('aaa-daily-advantage', 'Comenity', 'AAA Daily Advantage Visa Signature', 'visa', 0),
  ('navy-federal-more-rewards', 'Navy Federal Credit Union', 'Navy Federal More Rewards American Express', 'amex', 0),
  ('sofi-credit-card', 'SoFi', 'SoFi Credit Card', 'mastercard', 0),
  ('fidelity-rewards-visa', 'Elan Financial Services', 'Fidelity Rewards Visa Signature', 'visa', 0)
ON CONFLICT (id) DO NOTHING;

-- Seed reward rules
INSERT INTO reward_rules (card_id, category, rate, reward_type, cap_amount, cap_period, notes) VALUES
  ('amex-gold', 'dining', 4, 'points', NULL, NULL, '4x at restaurants worldwide.'),
  ('amex-gold', 'groceries', 4, 'points', 25000, 'year', '4x at US supermarkets up to the annual cap.'),
  ('amex-gold', 'travel', 3, 'points', NULL, NULL, '3x on flights booked directly or through Amex Travel.'),
  ('amex-gold', 'general', 1, 'points', NULL, NULL, NULL),

  ('chase-sapphire-preferred', 'dining', 3, 'points', NULL, NULL, NULL),
  ('chase-sapphire-preferred', 'streaming', 3, 'points', NULL, NULL, NULL),
  ('chase-sapphire-preferred', 'groceries', 3, 'points', NULL, NULL, 'Online grocery purchases, excluding superstores.'),
  ('chase-sapphire-preferred', 'travel', 2, 'points', NULL, NULL, NULL),
  ('chase-sapphire-preferred', 'transit', 2, 'points', NULL, NULL, NULL),
  ('chase-sapphire-preferred', 'general', 1, 'points', NULL, NULL, NULL),

  ('chase-sapphire-reserve', 'dining', 3, 'points', NULL, NULL, NULL),
  ('chase-sapphire-reserve', 'travel', 3, 'points', NULL, NULL, NULL),
  ('chase-sapphire-reserve', 'transit', 3, 'points', NULL, NULL, NULL),
  ('chase-sapphire-reserve', 'general', 1, 'points', NULL, NULL, NULL),

  ('chase-freedom-unlimited', 'dining', 3, 'cashback_percent', NULL, NULL, NULL),
  ('chase-freedom-unlimited', 'drugstores', 3, 'cashback_percent', NULL, NULL, NULL),
  ('chase-freedom-unlimited', 'travel', 5, 'cashback_percent', NULL, NULL, 'Travel booked through Chase Travel.'),
  ('chase-freedom-unlimited', 'general', 1.5, 'cashback_percent', NULL, NULL, NULL),

  ('chase-freedom-flex', 'dining', 3, 'cashback_percent', NULL, NULL, NULL),
  ('chase-freedom-flex', 'drugstores', 3, 'cashback_percent', NULL, NULL, NULL),
  ('chase-freedom-flex', 'travel', 5, 'cashback_percent', NULL, NULL, 'Travel booked through Chase Travel.'),
  ('chase-freedom-flex', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('citi-double-cash', 'general', 2, 'cashback_percent', NULL, NULL, '1% when you buy plus 1% when you pay.'),

  ('citi-custom-cash', 'dining', 5, 'cashback_percent', 500, 'month', '5% in eligible top spend category up to monthly cap.'),
  ('citi-custom-cash', 'groceries', 5, 'cashback_percent', 500, 'month', NULL),
  ('citi-custom-cash', 'gas', 5, 'cashback_percent', 500, 'month', NULL),
  ('citi-custom-cash', 'travel', 5, 'cashback_percent', 500, 'month', NULL),
  ('citi-custom-cash', 'transit', 5, 'cashback_percent', 500, 'month', NULL),
  ('citi-custom-cash', 'drugstores', 5, 'cashback_percent', 500, 'month', NULL),
  ('citi-custom-cash', 'streaming', 5, 'cashback_percent', 500, 'month', NULL),
  ('citi-custom-cash', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('capital-one-savor-cash', 'dining', 3, 'cashback_percent', NULL, NULL, NULL),
  ('capital-one-savor-cash', 'groceries', 3, 'cashback_percent', NULL, NULL, NULL),
  ('capital-one-savor-cash', 'streaming', 3, 'cashback_percent', NULL, NULL, NULL),
  ('capital-one-savor-cash', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('capital-one-venture-rewards', 'travel', 5, 'miles', NULL, NULL, 'Hotels and rental cars booked through Capital One Travel.'),
  ('capital-one-venture-rewards', 'general', 2, 'miles', NULL, NULL, NULL),

  ('capital-one-venture-x', 'travel', 5, 'miles', NULL, NULL, 'Flights booked through Capital One Travel; higher rates may apply to hotels and rental cars.'),
  ('capital-one-venture-x', 'general', 2, 'miles', NULL, NULL, NULL),

  ('blue-cash-preferred', 'groceries', 6, 'cashback_percent', 6000, 'year', '6% at US supermarkets up to annual cap.'),
  ('blue-cash-preferred', 'streaming', 6, 'cashback_percent', NULL, NULL, NULL),
  ('blue-cash-preferred', 'gas', 3, 'cashback_percent', NULL, NULL, NULL),
  ('blue-cash-preferred', 'transit', 3, 'cashback_percent', NULL, NULL, NULL),
  ('blue-cash-preferred', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('blue-cash-everyday', 'groceries', 3, 'cashback_percent', 6000, 'year', NULL),
  ('blue-cash-everyday', 'gas', 3, 'cashback_percent', 6000, 'year', NULL),
  ('blue-cash-everyday', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('discover-it-cash-back', 'general', 1, 'cashback_percent', NULL, NULL, 'Rotating category activation is excluded from V1 logic.'),

  ('wells-fargo-active-cash', 'general', 2, 'cashback_percent', NULL, NULL, NULL),

  ('wells-fargo-autograph', 'dining', 3, 'points', NULL, NULL, NULL),
  ('wells-fargo-autograph', 'gas', 3, 'points', NULL, NULL, NULL),
  ('wells-fargo-autograph', 'travel', 3, 'points', NULL, NULL, NULL),
  ('wells-fargo-autograph', 'transit', 3, 'points', NULL, NULL, NULL),
  ('wells-fargo-autograph', 'streaming', 3, 'points', NULL, NULL, NULL),
  ('wells-fargo-autograph', 'general', 1, 'points', NULL, NULL, NULL),

  ('bank-of-america-customized-cash', 'gas', 3, 'cashback_percent', 2500, 'quarter', NULL),
  ('bank-of-america-customized-cash', 'dining', 3, 'cashback_percent', 2500, 'quarter', NULL),
  ('bank-of-america-customized-cash', 'travel', 3, 'cashback_percent', 2500, 'quarter', NULL),
  ('bank-of-america-customized-cash', 'groceries', 2, 'cashback_percent', 2500, 'quarter', NULL),
  ('bank-of-america-customized-cash', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('us-bank-altitude-go', 'dining', 4, 'points', NULL, NULL, NULL),
  ('us-bank-altitude-go', 'groceries', 2, 'points', NULL, NULL, NULL),
  ('us-bank-altitude-go', 'gas', 2, 'points', NULL, NULL, NULL),
  ('us-bank-altitude-go', 'streaming', 2, 'points', NULL, NULL, NULL),
  ('us-bank-altitude-go', 'general', 1, 'points', NULL, NULL, NULL),

  ('us-bank-cash-plus', 'streaming', 5, 'cashback_percent', 2000, 'quarter', 'Requires selected bonus category.'),
  ('us-bank-cash-plus', 'transit', 5, 'cashback_percent', 2000, 'quarter', 'Ground transportation category when selected.'),
  ('us-bank-cash-plus', 'groceries', 2, 'cashback_percent', NULL, NULL, NULL),
  ('us-bank-cash-plus', 'gas', 2, 'cashback_percent', NULL, NULL, NULL),
  ('us-bank-cash-plus', 'dining', 2, 'cashback_percent', NULL, NULL, NULL),
  ('us-bank-cash-plus', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('bilt-mastercard', 'dining', 3, 'points', NULL, NULL, NULL),
  ('bilt-mastercard', 'travel', 2, 'points', NULL, NULL, NULL),
  ('bilt-mastercard', 'general', 1, 'points', NULL, NULL, 'Requires at least five monthly transactions to earn rewards.'),

  ('apple-card', 'general', 2, 'cashback_percent', NULL, NULL, 'Assumes Apple Pay purchase.'),

  ('paypal-cashback-mastercard', 'general', 2, 'cashback_percent', NULL, NULL, NULL),

  ('amazon-prime-visa', 'gas', 2, 'cashback_percent', NULL, NULL, NULL),
  ('amazon-prime-visa', 'dining', 2, 'cashback_percent', NULL, NULL, NULL),
  ('amazon-prime-visa', 'transit', 2, 'cashback_percent', NULL, NULL, NULL),
  ('amazon-prime-visa', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('costco-anywhere-visa', 'gas', 4, 'cashback_percent', 7000, 'year', NULL),
  ('costco-anywhere-visa', 'travel', 3, 'cashback_percent', NULL, NULL, NULL),
  ('costco-anywhere-visa', 'dining', 3, 'cashback_percent', NULL, NULL, NULL),
  ('costco-anywhere-visa', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('aaa-daily-advantage', 'groceries', 5, 'cashback_percent', 10000, 'year', NULL),
  ('aaa-daily-advantage', 'gas', 3, 'cashback_percent', NULL, NULL, NULL),
  ('aaa-daily-advantage', 'drugstores', 3, 'cashback_percent', NULL, NULL, NULL),
  ('aaa-daily-advantage', 'streaming', 3, 'cashback_percent', NULL, NULL, NULL),
  ('aaa-daily-advantage', 'general', 1, 'cashback_percent', NULL, NULL, NULL),

  ('navy-federal-more-rewards', 'dining', 3, 'points', NULL, NULL, NULL),
  ('navy-federal-more-rewards', 'groceries', 3, 'points', NULL, NULL, NULL),
  ('navy-federal-more-rewards', 'gas', 3, 'points', NULL, NULL, NULL),
  ('navy-federal-more-rewards', 'transit', 3, 'points', NULL, NULL, NULL),
  ('navy-federal-more-rewards', 'general', 1, 'points', NULL, NULL, NULL),

  ('sofi-credit-card', 'general', 2, 'cashback_percent', NULL, NULL, NULL),

  ('fidelity-rewards-visa', 'general', 2, 'cashback_percent', NULL, NULL, NULL);
