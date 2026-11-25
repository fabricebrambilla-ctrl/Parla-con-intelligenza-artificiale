'use strict';
async function purge(db,slug,days){
  return db.query("DELETE FROM talk_org_log WHERE org=$1 AND created_at <= now()-$2::int * interval '1 day'",[slug,days]);
}
function storage(organizations){
  let pool,ready;
  async function db(){
    if(!process.env.ORG_DATABASE_URL)throw Error('Organization database unavailable');
    if(!pool){
      const {Pool}=require('pg');
      pool=new Pool({connectionString:process.env.ORG_DATABASE_URL,max:3,connectionTimeoutMillis:5000});
      pool.on('error',()=>console.error('Organization database unavailable'));
    }
    if(!ready)ready=pool.query(`CREATE TABLE IF NOT EXISTS talk_org_log(
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, org text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      session_id uuid NOT NULL,question text NOT NULL,answer text NOT NULL,unknown boolean NOT NULL,kind text NOT NULL);
      ALTER TABLE talk_org_log ADD COLUMN IF NOT EXISTS request_summary text;
      CREATE INDEX IF NOT EXISTS talk_org_date ON talk_org_log(org,created_at);
      CREATE TABLE IF NOT EXISTS talk_org_count(org text,stage text,total bigint NOT NULL DEFAULT 0,PRIMARY KEY(org,stage));
      ALTER TABLE talk_org_log ENABLE ROW LEVEL SECURITY;
      ALTER TABLE talk_org_count ENABLE ROW LEVEL SECURITY`).catch(err=>{ready=null;throw err;});
    await ready;return pool;
  }
  async function clean(){const p=await db();for(const o of organizations.values())await purge(p,o.slug,o.retentionDays);}
  if(process.env.ORG_DATABASE_URL){
    const sweep=()=>clean().catch(()=>console.error('Organization retention sweep unavailable'));
    sweep();setInterval(sweep,3600000).unref();
  }
  return {available:db,async append(o,sid,question,result){await (await db()).query('INSERT INTO talk_org_log(org,session_id,question,answer,unknown,kind,request_summary) VALUES($1,$2,$3,$4,$5,$6,$7)',[o.slug,sid,question,result.text,!!result.unknown,result.kind||'answer',result.requestSummary||null]);},
    async rows(o){const p=await db();await purge(p,o.slug,o.retentionDays);return (await p.query('SELECT * FROM talk_org_log WHERE org=$1 ORDER BY created_at DESC,id DESC',[o.slug])).rows;},
    async count(o,stage){await (await db()).query('INSERT INTO talk_org_count VALUES($1,$2,1) ON CONFLICT(org,stage) DO UPDATE SET total=talk_org_count.total+1',[o.slug,stage]);}};
}
module.exports={purge,storage};
