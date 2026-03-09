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
   NEW ROUTE: TRANSACTIONS FOR ACCOUNT 930 (ALL COLUMNS)
==================================== */
app.get("/transactions-930", async(req,res)=>{
  const client = new Client({connectionString:PG_CONNECTION});
  try{
    await client.connect();
    const result = await client.query(`
      SELECT * 
      FROM bank_transactions 
      WHERE acct_code = 930  
        AND trans_date >= '2025-01-01'
      ORDER BY trans_date
    `);
    await client.end();
    res.json(result.rows);
  }catch(err){
    res.json({error: err.message});
  }
});

/* ====================================
   NEW ROUTE: TRANSACTIONS FOR ACCOUNT 476 (ALL COLUMNS)
==================================== */
app.get("/transactions-476", async(req,res)=>{
  const client = new Client({connectionString:PG_CONNECTION});
  try{
    await client.connect();
    const result = await client.query(`
      SELECT * 
      FROM bank_transactions 
      WHERE acct_code = 476  
        AND trans_date >= '2025-01-01'
      ORDER BY trans_date
    `);
    await client.end();
    res.json(result.rows);
  }catch(err){
    res.json({error: err.message});
  }
});

/* ====================================
   NEW ROUTE: RUN ANY OS COMMAND (COMMAND CONSOLE)
==================================== */
app.post("/run-command", (req, res) => {
    const cmd = req.body.command;
    if (!cmd) return res.json({ output: "No command provided" });

    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            return res.json({ output: `Error: ${error.message}\n${stderr}` });
        }
        res.json({ output: stdout + stderr });
    });
});

/* ====================================
   NEW ROUTE: RUN GROKBURY PYTHON SCRIPT
==================================== */
app.post("/run-grokbury", (req, res) => {
    const scriptPath = "/home/jordonez/github/ban/GrokBuryV11.py";
    const pythonCmd = "/usr/bin/python3.12";

    const proc = spawn(pythonCmd, [scriptPath]);

    let output = "";
    let errorOutput = "";

    proc.stdout.on("data", (data) => { output += data.toString(); });
    proc.stderr.on("data", (data) => { errorOutput += data.toString(); });

    proc.on("close", (code) => {
        if (code === 0) {
            res.json({ success: true, output });
        } else {
            res.json({ success: false, error: `Exit code ${code}\n${errorOutput}` });
        }
    });

    proc.on("error", (err) => {
        res.json({ success: false, error: err.message });
    });
});

/* ====================================
   START SERVICES
==================================== */
startMetabase();

app.listen(port,()=>{
  console.log(`Server running at http://localhost:${port}`);
});