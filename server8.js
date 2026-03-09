const express = require("express");
const jwt = require("jsonwebtoken");
const { Client } = require("pg");

const app = express();
const port = 3001;

// Metabase settings
const METABASE_SITE_URL = "http://localhost:3000";
const METABASE_SECRET_KEY = "c4b678889f045ebecebbc8729815803e8d32327ec81092813041be59a90aeaf1";
const DASHBOARD_ID = 2;

// PostgreSQL connection string
const PG_CONNECTION = "postgresql://postgres:nCircle007@localhost:5432/xero";

// Serve static files (your index.html is in the same folder)
app.use(express.static(__dirname));

// Generate Metabase signed embed URL
app.get("/metabase-url", (req, res) => {
  const payload = {
    resource: { dashboard: DASHBOARD_ID },
    params: {},
    exp: Math.round(Date.now() / 1000) + 10 * 60, // 10 minutes expiry
  };

  const token = jwt.sign(payload, METABASE_SECRET_KEY);

  const iframeUrl = `${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=true&titled=true`;
  res.json({ url: iframeUrl });
});

// PostgreSQL test endpoint
app.get("/pg-test", async (req, res) => {
  const client = new Client({ connectionString: PG_CONNECTION });

  try {
    await client.connect();

    const dbInfo = await client.query(
      "SELECT current_database() AS db_name, NOW() AS server_time"
    );

    const transactions = await client.query(
      "SELECT * FROM bank_transactions"
    );

    await client.end();

    // Log the raw rows to check column names
    console.log("Transactions fetched from DB:", transactions.rows);

    // Normalize the rows for frontend
    const formattedSample = transactions.rows.map(txn => ({
      description: txn.trans_des ?? txn.Description ?? "Txn",
      amount: Number(txn.gross ?? txn.Amount ?? 0),
      category: txn.acct_name ?? txn.Category ?? "Other",
      ...txn
    }));

    res.json({
      status: "connected",
      database: dbInfo.rows[0].db_name,
      time: dbInfo.rows[0].server_time,
      rowsReturned: transactions.rowCount,
      sample: formattedSample
    });

  } catch (err) {
    res.json({
      status: "connection failed",
      error: err.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
