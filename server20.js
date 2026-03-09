// server.js
const express = require("express");
const jwt = require("jsonwebtoken");
const { Client } = require("pg");
const path = require("path");

const app = express();
const port = 3001;

app.use(express.json());

const METABASE_SITE_URL = "http://localhost:3000";
const METABASE_SECRET_KEY = "c4b678889f045ebecebbc8729815803e8d32327ec81092813041be59a90aeaf1";
const DASHBOARD_ID = 2;

const PG_CONNECTION = "postgresql://postgres:nCircle007@localhost:5432/xero";

app.use(express.static(__dirname));

app.get("/", (req,res)=>{
res.sendFile(path.join(__dirname,"index.html"));
});

app.get("/metabase-url",(req,res)=>{

const payload={
resource:{dashboard:DASHBOARD_ID},
params:{},
exp:Math.floor(Date.now()/1000)+600
};

const token=jwt.sign(payload,METABASE_SECRET_KEY);

res.json({
url:`${METABASE_SITE_URL}/embed/dashboard/${token}#bordered=true&titled=true`
});

});

app.get("/pg-test",async(req,res)=>{

const client=new Client({connectionString:PG_CONNECTION});

try{

await client.connect();

const dbInfo=await client.query("SELECT current_database() AS db_name");

const transactions=await client.query("SELECT * FROM bank_transactions LIMIT 200");

await client.end();

const colOrder=[
"acct_code","acct_name","trans_date","acct_type","contact",
"trans_des","invoice","trans_ref","gross","tax","source",
"related_account","trans_net","tax_rate","contact_group",
"trans_debit","trans_credit","trans_rate_name"
];

const formattedSample=transactions.rows.map(txn=>{
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

res.json({
status:"connection failed",
error:err.message
});

}

});

app.post("/run-sql",async(req,res)=>{

const query=req.body.query;

if(!query.toLowerCase().trim().startsWith("select")){
return res.json({error:"Only SELECT queries are allowed"});
}

const client=new Client({connectionString:PG_CONNECTION});

try{

await client.connect();

const result=await client.query(query);

await client.end();

res.json({rows:result.rows});

}catch(err){

res.json({error:err.message});

}

});

app.listen(port,()=>{
console.log(`Server running at http://localhost:${port}`);
});

