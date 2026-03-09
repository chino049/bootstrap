// server.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { Client } = require("pg");
const path = require("path");
const { spawn, exec } = require("child_process");
const net = require("net"); // used to check if port is open

const app = express();
const port = 3001;

app.use(express.json());

const METABASE_SITE_URL = "http://localhost:3000";
const METABASE_SECRET_KEY = "c4b678889f045ebecebbc8729815803e8d32327ec81092813041be59a90aeaf1";
const DASHBOARD_ID = 2;

const PG_CONNECTION = "postgresql://postgres:nCircle007@localhost:5432/xero";

app.use(express.static(__dirname));

/* ====================================
   CHECK IF A PORT IS IN USE
==================================== */
function isPortOpen(port){
  return new Promise(resolve=>{
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect",()=>{ socket.destroy(); resolve(true); });
    socket.on("error",()=>{ resolve(false); });
    socket.on("timeout",()=>{ resolve(false); });
    socket.connect(port,"127.0.0.1");
  });
}

/* ====================================
   START METABASE IF NOT RUNNING
==================================== */
async function startMetabase(){
  const running = await isPortOpen(3000);
  if(running){
    console.log("Metabase already running on port 3000");
    return;
  }

  console.log("Starting Metabase...");
  const metabase = spawn(
    "/usr/bin/java",
    ["-jar","/home/jordonez/github/metabase/metabase.jar"],
    {
      cwd: "/home/jordonez/github/metabase",
      detached:true,
      stdio:"inherit"
    }
  );

  metabase.on("error",(err)=>{ console.error("Failed to start Metabase:",err); });
  metabase.on("spawn",()=>{ console.log("Metabase process started"); });
  metabase.on("exit",(code)=>{ console.log("Metabase exited with code:",code); });

  metabase.unref();
}

/* ====================================
   ROUTES
==================================== */
app.get("/",(req,res)=>{
  res.sendFile(path.join(__dirname,"index.html"));
});

app.get("/metabase-url",(req,res)=>{
  const payload={
    resource:{dashboard:DASHBOARD_ID},
    params:{},
    exp:Math.floor(Date.now()/1000)+600
  };
  const token=jwt.sign(payload,METABASE_SECRET_KEY);
  res.json({ url:`${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=true&titled=true` });
});

app.get("/pg-test", async(req,res)=>{
  const client = new Client({connectionString:PG_CONNECTION});
  try{
    await client.connect();
    const dbInfo = await client.query("SELECT current_database() AS db_name");
    const transactions = await client.query("SELECT * FROM bank_transactions LIMIT 200");
    await client.end();

    const colOrder=[
      "acct_code","acct_name","trans_date","acct_type","contact",
      "trans_des","invoice","trans_ref","gross","tax","source",
      "related_account","trans_net","tax_rate","contact_group",
      "trans_debit","trans_credit","trans_rate_name"
    ];

    const formattedSample = transactions.rows.map(txn=>{
      const row={};
      colOrder.forEach(c=>row[c]=txn[c]);
      return row;
    });

    res.json({
      status:"connected",
      database:dbInfo.rows[0].db_name,
      rowsReturned:transactions.rowCount,
      sample:formattedSample,
      colOrder
    });

  }catch(err){
    res.json({ status:"connection failed", error:err.message });
  }
});

app.post("/run-sql", async(req,res)=>{
  const query=req.body.query;
  if(!query.toLowerCase().trim().startsWith("select")){
    return res.json({error:"Only SELECT queries are allowed"});
  }

  const client=new Client({connectionString:PG_CONNECTION});
  try{
    await client.connect();
    const result = await client.query(query);
    await client.end();
    res.json({rows:result.rows});
  }catch(err){
    res.json({error:err.message});
  }
});

/* ====================================
   ROUTES FOR TRANSACTIONS (ALL COLUMNS)
==================================== */
async function getTransactions(acct){
  const client = new Client({connectionString:PG_CONNECTION});
  try{
    await client.connect();
    const result = await client.query(`
      SELECT * 
      FROM bank_transactions 
      WHERE acct_code = $1
        AND trans_date >= '2025-01-01'
      ORDER BY trans_date
    `,[acct]);
    await client.end();
    return result.rows;
  }catch(err){
    return {error: err.message};
  }
}

app.get("/transactions-930", async(req,res)=>{
  res.json(await getTransactions(930));
});

app.get("/transactions-476", async(req,res)=>{
  res.json(await getTransactions(476));
});

app.get("/transactions-446", async(req,res)=>{
  res.json(await getTransactions(446));
});

/* ====================================
   RUN COMMAND ROUTE (for Command Console)
==================================== */
app.post("/run-command", (req, res) => {
  const cmd = req.body.command;
  if(!cmd) return res.json({ output: "No command provided" });

  const child = spawn(cmd, { shell: true });

  let output = "";
  let error = "";

  child.stdout.on("data", (data) => { output += data.toString(); });
  child.stderr.on("data", (data) => { error += data.toString(); });

  child.on("close", (code) => {
      if (error) output += "\nERROR:\n" + error;
      res.json({ output });
  });
});

/* ====================================
   RUN PYTHON SCRIPT ROUTE (green button)
==================================== */
app.post("/run-python", (req, res) => {
  const command = "/usr/bin/python3.12 /home/jordonez/github/ban/GrokBuryV11.py";

  exec(command, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      return res.json({ output: `Error: ${err.message}` });
    }
    if (stderr) {
      return res.json({ output: `Stderr: ${stderr}` });
    }
    res.json({ output: stdout });
  });
});

/* ====================================
   START SERVICES
==================================== */
startMetabase();

app.listen(port,()=>{
  console.log(`Server running at http://localhost:${port}`);
});