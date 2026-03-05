const { Client } = require("pg");

const BASE_URL = "http://localhost:5001/api/v1";

async function seedActions() {
  const client = new Client({
    connectionString:
      "postgresql://postgres:12345@localhost:5432/que_code_devs",
  });

  try {
    await client.connect();
    console.log("🔌 Connected to database\n");

    // Step 1: Get or create an organization
    console.log("🏢 Getting organization...");
    let orgResult = await client.query(
      'SELECT id, name FROM "Organizations" LIMIT 1',
    );

    let organizationId;
    if (orgResult.rows.length === 0) {
      console.log("   Creating test organization...");
      const createOrgResult = await client.query(`
        INSERT INTO "Organizations" (
          id, name, email, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          'Test Organization',
          'org@test.com',
          NOW(),
          NOW()
        ) RETURNING id, name
      `);
      organizationId = createOrgResult.rows[0].id;
      console.log(
        `✅ Organization created: ${createOrgResult.rows[0].name} (${organizationId})`,
      );
    } else {
      organizationId = orgResult.rows[0].id;
      console.log(
        `✅ Using existing organization: ${orgResult.rows[0].name} (${organizationId})`,
      );
    }

    // Step 2: Create diverse Actions
    console.log("\n📝 Creating Actions...\n");

    const actions = [
      {
        type: "ticket",
        name: "Kigali Music Festival 2026",
        slug: "kigali-music-festival-2026",
        displayLayout: "mosaic",
        shortDescription:
          "Annual music festival featuring local and international artists",
        description:
          "Join us for the biggest music festival in Rwanda! Three days of amazing performances, food, and fun.",
        currency: "RWF",
        pricing: { mode: "tiered" },
        availability: {
          startsAt: "2026-06-15T09:00:00Z",
          endsAt: "2026-06-17T23:00:00Z",
          userQuota: 5,
        },
        visibility: { mode: "public" },
        buyerFields: ["fullName", "email", "phone"],
        fulfillment: {
          storeOnBuyerQR: true,
          objectType: "eticket",
          postPurchaseMessage:
            "Thank you! Your e-ticket has been sent to your email.",
        },
        status: "published",
      },
      {
        type: "transport",
        name: "Kigali-Rubavu Express Bus",
        slug: "kigali-rubavu-express",
        displayLayout: "list",
        shortDescription: "Daily express bus service to Rubavu",
        description:
          "Comfortable express bus service with WiFi and AC. Departure times: 6:00 AM, 10:00 AM, 2:00 PM, 6:00 PM",
        currency: "RWF",
        pricing: { mode: "fixed", amount: 5000 },
        availability: { timezone: "Africa/Kigali" },
        visibility: { mode: "public" },
        buyerFields: ["fullName", "phone", "nationalId"],
        fulfillment: {
          storeOnBuyerQR: true,
          objectType: "eticket",
          postPurchaseMessage:
            "Your bus ticket is ready. Please arrive 15 minutes before departure.",
        },
        status: "published",
      },
      {
        type: "service",
        name: "Professional Photography Session",
        slug: "photography-session",
        displayLayout: "card",
        shortDescription:
          "Professional photo shoot for events, portraits, or commercial use",
        description:
          "Book a professional photographer for your special moments. Includes editing and digital delivery.",
        currency: "RWF",
        pricing: { mode: "range", min: 50000, max: 200000 },
        availability: {},
        visibility: { mode: "public" },
        buyerFields: ["fullName", "email", "phone"],
        fulfillment: {
          storeOnBuyerQR: false,
          postPurchaseMessage:
            "Thank you! We will contact you within 24 hours to schedule your session.",
        },
        status: "published",
      },
      {
        type: "subscription",
        name: "Gym Membership - Premium",
        slug: "gym-membership-premium",
        displayLayout: "card",
        shortDescription: "Full access to all gym facilities and classes",
        description:
          "Premium membership includes access to all equipment, group classes, personal training sessions, and sauna.",
        currency: "RWF",
        pricing: { mode: "tiered" },
        availability: {},
        visibility: { mode: "public" },
        buyerFields: ["fullName", "email", "phone", "dateOfBirth"],
        fulfillment: {
          storeOnBuyerQR: true,
          objectType: "membership",
          postPurchaseMessage:
            "Welcome! Your membership card will be ready at reception.",
        },
        status: "published",
      },
      {
        type: "donation",
        name: "Support Local Schools",
        slug: "support-local-schools",
        displayLayout: "icons",
        shortDescription:
          "Help provide education materials to underprivileged students",
        description:
          "Your donation helps purchase books, uniforms, and school supplies for children in need.",
        currency: "RWF",
        pricing: { mode: "free" },
        availability: {},
        visibility: { mode: "public" },
        buyerFields: ["fullName", "email"],
        fulfillment: {
          storeOnBuyerQR: false,
          postPurchaseMessage:
            "Thank you for your generous donation! You will receive a receipt via email.",
        },
        status: "published",
      },
      {
        type: "booking",
        name: "Conference Room Booking",
        slug: "conference-room-booking",
        displayLayout: "list",
        shortDescription: "Reserve our modern conference rooms",
        description:
          "Fully equipped conference rooms with projectors, whiteboards, and high-speed internet.",
        currency: "RWF",
        pricing: { mode: "fixed", amount: 30000 },
        availability: { timezone: "Africa/Kigali" },
        visibility: { mode: "public" },
        buyerFields: ["fullName", "email", "phone", "companyName"],
        fulfillment: {
          storeOnBuyerQR: true,
          objectType: "badge",
          postPurchaseMessage:
            "Booking confirmed! Check-in at reception on your arrival.",
        },
        status: "published",
      },
      {
        type: "ticket",
        name: "Tech Conference 2026 (Draft)",
        slug: "tech-conference-2026-draft",
        displayLayout: "card",
        shortDescription: "Annual technology conference - Coming Soon",
        description:
          "Stay tuned for details about speakers, workshops, and networking events.",
        currency: "RWF",
        pricing: { mode: "fixed", amount: 15000 },
        availability: {},
        visibility: { mode: "unlisted" },
        buyerFields: ["fullName", "email", "phone"],
        fulfillment: { storeOnBuyerQR: true, objectType: "eticket" },
        status: "draft",
      },
    ];

    const createdActions = [];
    for (const action of actions) {
      const result = await client.query(
        `
        INSERT INTO "Actions" (
          id, "organizationId", type, name, slug, "displayLayout",
          "coverImage", "shortDescription", description, currency,
          pricing, availability, visibility, "buyerFields", fulfillment,
          policy, webhooks, "customFields", status, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
        ) RETURNING id, name, type, status
      `,
        [
          organizationId,
          action.type,
          action.name,
          action.slug,
          action.displayLayout,
          null, // coverImage
          action.shortDescription,
          action.description,
          action.currency,
          JSON.stringify(action.pricing),
          JSON.stringify(action.availability),
          JSON.stringify(action.visibility),
          JSON.stringify(action.buyerFields),
          JSON.stringify(action.fulfillment),
          JSON.stringify({}), // policy
          JSON.stringify({}), // webhooks
          JSON.stringify({}), // customFields
          action.status,
        ],
      );

      createdActions.push(result.rows[0]);
      console.log(
        `  ✅ ${result.rows[0].name} (${result.rows[0].type}) - ${result.rows[0].status}`,
      );
    }

    // Step 3: Create SubActions for relevant actions
    console.log("\n🎯 Creating SubActions...\n");

    // Festival ticket tiers
    const festivalAction = createdActions.find((a) =>
      a.name.includes("Music Festival"),
    );
    if (festivalAction) {
      const festivalSubActions = [
        {
          name: "VIP Pass - 3 Days",
          price: 50000,
          stock: 100,
          metadata: { access: "VIP", days: 3 },
        },
        {
          name: "General Admission - 3 Days",
          price: 25000,
          stock: 500,
          metadata: { access: "General", days: 3 },
        },
        {
          name: "Single Day Pass - Friday",
          price: 10000,
          stock: 300,
          metadata: { access: "General", day: "Friday" },
        },
        {
          name: "Single Day Pass - Saturday",
          price: 10000,
          stock: 300,
          metadata: { access: "General", day: "Saturday" },
        },
        {
          name: "Single Day Pass - Sunday",
          price: 10000,
          stock: 300,
          metadata: { access: "General", day: "Sunday" },
        },
      ];

      for (const [index, subAction] of festivalSubActions.entries()) {
        await client.query(
          `
          INSERT INTO "SubActions" (
            id, "actionId", name, description, price, stock, "stockReserved",
            variants, metadata, "isActive", "sortOrder", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, 0, $6, $7, true, $8, NOW(), NOW()
          )
        `,
          [
            festivalAction.id,
            subAction.name,
            null,
            subAction.price,
            subAction.stock,
            JSON.stringify({}),
            JSON.stringify(subAction.metadata),
            index,
          ],
        );
        console.log(
          `  ✅ ${subAction.name} - RWF ${subAction.price.toLocaleString()}`,
        );
      }
    }

    // Bus seats
    const busAction = createdActions.find((a) => a.name.includes("Bus"));
    if (busAction) {
      const busSubActions = [
        {
          name: "Front Seat (1A)",
          price: 5000,
          stock: 1,
          metadata: { seat: "1A", row: 1 },
        },
        {
          name: "Front Seat (1B)",
          price: 5000,
          stock: 1,
          metadata: { seat: "1B", row: 1 },
        },
        {
          name: "Regular Seat (2A)",
          price: 4500,
          stock: 1,
          metadata: { seat: "2A", row: 2 },
        },
        {
          name: "Regular Seat (2B)",
          price: 4500,
          stock: 1,
          metadata: { seat: "2B", row: 2 },
        },
        {
          name: "Regular Seat (3A)",
          price: 4500,
          stock: 1,
          metadata: { seat: "3A", row: 3 },
        },
        {
          name: "Regular Seat (3B)",
          price: 4500,
          stock: 1,
          metadata: { seat: "3B", row: 3 },
        },
        {
          name: "Back Seat (10A)",
          price: 4000,
          stock: 1,
          metadata: { seat: "10A", row: 10 },
        },
        {
          name: "Back Seat (10B)",
          price: 4000,
          stock: 1,
          metadata: { seat: "10B", row: 10 },
        },
      ];

      for (const [index, subAction] of busSubActions.entries()) {
        await client.query(
          `
          INSERT INTO "SubActions" (
            id, "actionId", name, description, price, stock, "stockReserved",
            variants, metadata, "isActive", "sortOrder", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, 0, $6, $7, true, $8, NOW(), NOW()
          )
        `,
          [
            busAction.id,
            subAction.name,
            null,
            subAction.price,
            subAction.stock,
            JSON.stringify({}),
            JSON.stringify(subAction.metadata),
            index,
          ],
        );
        console.log(
          `  ✅ ${subAction.name} - RWF ${subAction.price.toLocaleString()}`,
        );
      }
    }

    // Gym membership tiers
    const gymAction = createdActions.find((a) => a.name.includes("Gym"));
    if (gymAction) {
      const gymSubActions = [
        {
          name: "1 Month Membership",
          price: 30000,
          stock: null,
          metadata: { duration: "1 month" },
        },
        {
          name: "3 Months Membership",
          price: 80000,
          stock: null,
          metadata: { duration: "3 months", savings: 10000 },
        },
        {
          name: "6 Months Membership",
          price: 150000,
          stock: null,
          metadata: { duration: "6 months", savings: 30000 },
        },
        {
          name: "1 Year Membership",
          price: 280000,
          stock: null,
          metadata: { duration: "12 months", savings: 80000 },
        },
      ];

      for (const [index, subAction] of gymSubActions.entries()) {
        await client.query(
          `
          INSERT INTO "SubActions" (
            id, "actionId", name, description, price, stock, "stockReserved",
            variants, metadata, "isActive", "sortOrder", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, 0, $6, $7, true, $8, NOW(), NOW()
          )
        `,
          [
            gymAction.id,
            subAction.name,
            subAction.metadata.savings
              ? `Save RWF ${subAction.metadata.savings.toLocaleString()}`
              : null,
            subAction.price,
            subAction.stock,
            JSON.stringify({}),
            JSON.stringify(subAction.metadata),
            index,
          ],
        );
        console.log(
          `  ✅ ${subAction.name} - RWF ${subAction.price.toLocaleString()}`,
        );
      }
    }

    // Get statistics
    console.log("\n📊 Database Statistics:");
    const statsQueries = await Promise.all([
      client.query('SELECT COUNT(*) as count FROM "Actions"'),
      client.query('SELECT COUNT(*) as count FROM "SubActions"'),
      client.query(
        "SELECT COUNT(*) as count FROM \"Actions\" WHERE status = 'published'",
      ),
      client.query(
        "SELECT COUNT(*) as count FROM \"Actions\" WHERE status = 'draft'",
      ),
      client.query(
        "SELECT COUNT(*) as count FROM \"Actions\" WHERE status = 'archived'",
      ),
      client.query(
        "SELECT COUNT(*) as count FROM \"Actions\" WHERE status = 'suspended'",
      ),
    ]);

    console.log(`  Total Actions: ${statsQueries[0].rows[0].count}`);
    console.log(`  Total SubActions: ${statsQueries[1].rows[0].count}`);
    console.log(`  Published: ${statsQueries[2].rows[0].count}`);
    console.log(`  Draft: ${statsQueries[3].rows[0].count}`);
    console.log(`  Archived: ${statsQueries[4].rows[0].count}`);
    console.log(`  Suspended: ${statsQueries[5].rows[0].count}`);

    console.log("\n✅ Seeding completed successfully!");
    console.log("\n📌 You can now:");
    console.log(
      "   - View actions at: http://localhost:5001/api/v1/admin/actions",
    );
    console.log("   - Test suspend/unsuspend endpoints");
    console.log("   - Access actions in your frontend");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("Details:", error);
  } finally {
    await client.end();
    console.log("\n🔌 Database connection closed");
  }
}

seedActions();
