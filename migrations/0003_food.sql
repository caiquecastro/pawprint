CREATE TABLE food_supplies (
  id TEXT PRIMARY KEY NOT NULL,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  food TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'oz', 'cups', 'servings')),
  purchased_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX food_supplies_pet_idx ON food_supplies (pet_id, purchased_at);

CREATE TABLE food_entries (
  id TEXT PRIMARY KEY NOT NULL,
  pet_id TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  food TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'oz', 'cups', 'servings')),
  supply_id TEXT REFERENCES food_supplies(id),
  fed_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX food_pet_fed_idx ON food_entries (pet_id, fed_at);
