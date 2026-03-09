// server.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { Client } = require("pg");
const path = require("path");

const app = express();
const port = 3001;

// === Metabase Settings ===
const METABASE_SITE_URL = "http://localhost:3000";
const METABASE_SECRET_KEY = "c4b678889f045ebecebbc8729815803e8d32327ec81092813041be59a90aeaf1";
const DASHBOARD_ID = 2;

// === PostgreSQL Connection ===
const PG_CONNECTION = "postgresql://postgres:nCircle007@localhost:5432/xero";

// === Serve static files from project root ===
app.use(express.static(__dirname));

// === Fallback for root route ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === Metabase Embed URL Endpoint ===
app.get("/metabase-url", (req, res) => {
  const payload = {
    resource: { dashboard: DASHBOARD_ID },
    params: {},
    exp: Math.floor(Date.now() / 1000) + 10 * 60, // 10 minutes
  };
  const token = jwt.sign(payload, METABASE_SECRET_KEY);
  res.json({ url: `${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=true&titled=true` });
});

// === PostgreSQL Test Endpoint ===
app.get("/pg-test", async (req, res) => {
  const client = new Client({ connectionString: PG_CONNECTION });

  try {
    await client.connect();

    const dbInfo = await client.query("SELECT current_database() AS db_name, NOW() AS server_time");
    const transactions = await client.query("SELECT * FROM bank_transactions");
    await client.end();

    // Define fixed column order
    const colOrder = [
      "acct_code",
      "acct_name",
      "trans_date",
      "acct_type",
      "contact",
      "trans_des",
      "invoice",
      "trans_ref",
      "gross",
      "tax",
      "source",
      "related_account",
      "trans_net",
      "tax_rate",
      "contact_group",
      "trans_debit",
      "trans_credit",
      "trans_rate_name"
    ];

    // Format rows for frontend in the fixed order
    const formattedSample = transactions.rows.map(txn => {
      const row = {
        description: txn.trans_des ?? txn.Description ?? "Txn",
        amount: Number(txn.gross ?? txn.Amount ?? 0),
      };
      colOrder.forEach(col => row[col] = txn[col] ?? '');
      return row;
    });

    res.json({
      status: "connected",
      database: dbInfo.rows[0].db_name,
      time: dbInfo.rows[0].server_time,
      rowsReturned: transactions.rowCount,
      sample: formattedSample,
      colOrder // send the column order to the frontend
    });

  } catch (err) {
    res.json({ status: "connection failed", error: err.message });
  }
});

// === Start Server ===
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
