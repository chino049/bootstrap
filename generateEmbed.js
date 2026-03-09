const jwt = require("jsonwebtoken");

const METABASE_SITE_URL = "http://localhost:3000";
const METABASE_SECRET_KEY = "c4b678889f045ebecebbc8729815803e8d32327ec81092813041be59a90aeaf1";

const payload = {
  resource: { dashboard: 2 },
  params: {},
  exp: Math.round(Date.now() / 1000) + (10 * 60)
};

const token = jwt.sign(payload, METABASE_SECRET_KEY);

const iframeUrl =
  METABASE_SITE_URL +
  "/embed/dashboard/" +
  token +
  "#bordered=true&titled=true";

console.log(iframeUrl);
