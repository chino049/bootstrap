const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const port = 3001; // your local server

// Metabase settings
const METABASE_SITE_URL = "http://localhost:3000"; // Metabase URL
const METABASE_SECRET_KEY = "c4b678889f045ebecebbc8729815803e8d32327ec81092813041be59a90aeaf1"; // from Admin → Embedding
const DASHBOARD_ID = 2; // numeric dashboard ID

// Serve static files (index.html)
app.use(express.static(__dirname));

// API endpoint to generate signed token
app.get("/metabase-url", (req, res) => {
  const payload = {
    resource: { dashboard: DASHBOARD_ID },
    params: {}, // optional filters
    exp: Math.round(Date.now() / 1000) + 10 * 60 // 10 min expiry
  };

  const token = jwt.sign(payload, METABASE_SECRET_KEY);
  const iframeUrl = `${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=true&titled=true`;

  res.json({ url: iframeUrl });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
