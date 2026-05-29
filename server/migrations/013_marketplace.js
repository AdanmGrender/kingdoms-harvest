exports.up = async function (db) {
  await db.schema.createTable('market_listings', (t) => {
    t.increments('id');
    t.bigInteger('seller_id').notNullable();
    t.string('resource_id', 30).notNullable();
    t.integer('quantity').notNullable();
    t.integer('quantity_remaining').notNullable();
    t.integer('price_per_unit').notNullable();
    t.string('status', 20).defaultTo('active'); // active | sold | cancelled | expired
    t.text('created_at').notNullable();
    t.text('expires_at').notNullable();
  });

  await db.schema.createTable('market_transactions', (t) => {
    t.increments('id');
    t.integer('listing_id').notNullable();
    t.bigInteger('buyer_id').notNullable();
    t.integer('quantity_bought').notNullable();
    t.integer('total_price').notNullable();
    t.integer('fee').notNullable();
    t.text('transacted_at').notNullable();
  });

  await db.raw('CREATE INDEX IF NOT EXISTS idx_market_listings_seller ON "market_listings" ("seller_id")');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_market_listings_status ON "market_listings" ("status")');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_market_transactions_buyer ON "market_transactions" ("buyer_id")');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_market_transactions_listing ON "market_transactions" ("listing_id")');
};

exports.down = async function (db) {
  await db.schema.dropTableIfExists('market_transactions');
  await db.schema.dropTableIfExists('market_listings');
};
