import { Pool } from 'pg';
import { hashPassword } from '../auth/password.js';
import { seedSmokeData } from './smoke-data.js';

const workspaceId = process.env.WORKSPACE_ID ?? '00000000-0000-4000-8000-000000000711';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required.');

const accounts = [
  ['DEMO_ADMIN_PASSWORD', 'hiten@dealflow360.demo', 'Hiten', 'admin'],
  ['DEMO_SALES_PASSWORD', 'sujith@dealflow360.demo', 'Sujith Kumar', 'sales_rep'],
  ['DEMO_MANAGER_PASSWORD', 'manager@dealflow360.demo', 'Sales Manager Demo', 'sales_manager'],
  ['DEMO_FINANCE_PASSWORD', 'finance@dealflow360.demo', 'Finance/Ops Demo', 'finance_ops'],
];
for (const [key] of accounts) if (!process.env[key] || process.env[key].length < 7) throw new Error(`${key} must be at least 7 characters.`);

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const team = (await client.query(`INSERT INTO sales_teams(id,workspace_id,name) VALUES('71100000-0000-4000-8000-000000000001',$1,'Enterprise Sales') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [workspaceId])).rows[0];
  const users = {};
  for (const [key, email, fullName, role] of accounts) {
    const passwordHash = await hashPassword(process.env[key]);
    const user = (await client.query(`INSERT INTO users(workspace_id,email,full_name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash RETURNING id`, [workspaceId, email, fullName, passwordHash])).rows[0];
    users[role] = user.id;
    await client.query('DELETE FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2', [user.id, workspaceId]);
    await client.query(`INSERT INTO workspace_memberships(user_id,workspace_id,role,team_id) VALUES($1,$2,$3,$4)`, [user.id, workspaceId, role, team.id]);
    await client.query(`INSERT INTO user_preferences(user_id,theme,accent) VALUES($1,'system','blue') ON CONFLICT(user_id) DO NOTHING`, [user.id]);
  }
  await client.query('UPDATE sales_teams SET manager_user_id=$2 WHERE id=$1', [team.id, users.sales_manager]);

  const tiers = [
    ['71110000-0000-4000-8000-000000000001','Bronze',20],
    ['71110000-0000-4000-8000-000000000002','Silver',10],
    ['71110000-0000-4000-8000-000000000003','Gold',5],
  ];
  for (const [id,name,risk] of tiers) await client.query(`INSERT INTO customer_tiers(id,workspace_id,name,overdue_risk) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,overdue_risk=EXCLUDED.overdue_risk`,[id,workspaceId,name,risk]);
  const categories = [['71120000-0000-4000-8000-000000000001','Software'],['71120000-0000-4000-8000-000000000002','Services'],['71120000-0000-4000-8000-000000000003','Hardware']];
  for (const [id,name] of categories) await client.query(`INSERT INTO product_categories(id,workspace_id,name) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`,[id,workspaceId,name]);
  const products = [
    ['71130000-0000-4000-8000-000000000001',categories[0][0],'DF-CORE','DealFlow Core','recurring','monthly',4800000,900000],
    ['71130000-0000-4000-8000-000000000002',categories[1][0],'SUP-PLUS','Priority Support','recurring','monthly',1800000,350000],
    ['71130000-0000-4000-8000-000000000003',categories[2][0],'EDGE-100','Edge Gateway','one_time',null,12500000,8200000],
    ['71130000-0000-4000-8000-000000000004',categories[1][0],'ONBOARD','Enterprise Onboarding','one_time',null,24000000,8500000],
  ];
  for(const p of products)await client.query(`INSERT INTO products(id,workspace_id,category_id,sku,name,billing_type,cadence,price_minor,cost_minor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO UPDATE SET sku=EXCLUDED.sku,name=EXCLUDED.name,price_minor=EXCLUDED.price_minor,cost_minor=EXCLUDED.cost_minor`,[p[0],workspaceId,...p.slice(1)]);
  for(const [tierIndex,tier] of tiers.entries())for(const [categoryIndex,category] of categories.entries()){const ceilings=[[700,500,300],[1100,900,700],[1500,1200,1000]][tierIndex][categoryIndex];await client.query(`INSERT INTO discount_policies(workspace_id,tier_id,category_id,ceiling_bps) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,tier_id,category_id) DO UPDATE SET ceiling_bps=EXCLUDED.ceiling_bps`,[workspaceId,tier[0],category[0],ceilings]);}
  await client.query(`INSERT INTO upsell_rules(workspace_id,source_product_id,suggested_product_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[workspaceId,products[0][0],products[1][0]]);
  const customers=[['71140000-0000-4000-8000-000000000001',tiers[2][0],'Acme Corp','deals@acme.example','Acme Corp',0],['71140000-0000-4000-8000-000000000002',tiers[0][0],'Beta Industries','buyer@beta.example','Beta Industries',7500000],['71140000-0000-4000-8000-000000000003',tiers[1][0],'Northstar Labs','ops@northstar.example','Northstar Labs',0],['71140000-0000-4000-8000-000000000004',tiers[0][0],'Delta Retail','procurement@delta.example','Delta Retail',2500000]];
  for(const row of customers)await client.query(`INSERT INTO customers(id,workspace_id,tier_id,name,email,company,overdue_minor) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET tier_id=EXCLUDED.tier_id,name=EXCLUDED.name,email=EXCLUDED.email,company=EXCLUDED.company,overdue_minor=EXCLUDED.overdue_minor`,[row[0],workspaceId,...row.slice(1)]);
  const warehouses=[['71150000-0000-4000-8000-000000000001','MAIN','Main Warehouse',1800000],['71150000-0000-4000-8000-000000000002','EAST','East Depot',900000],['71150000-0000-4000-8000-000000000003','SOUTH','South Hub',1200000]];
  for(const row of warehouses)await client.query(`INSERT INTO warehouses(id,workspace_id,code,name,shipping_cost_minor) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,shipping_cost_minor=EXCLUDED.shipping_cost_minor`,[row[0],workspaceId,...row.slice(1)]);
  const stock=[[0,2,30],[0,3,10],[1,2,18],[1,3,8],[2,2,12],[2,3,24]];for(const [w,p,quantity] of stock)await client.query(`INSERT INTO inventory_levels(warehouse_id,product_id,available_quantity) VALUES($1,$2,$3) ON CONFLICT(warehouse_id,product_id) DO UPDATE SET available_quantity=EXCLUDED.available_quantity`,[warehouses[w][0],products[p][0],quantity]);
  await seedSmokeData(client, { workspaceId, users, team, tiers, categories, products, customers, warehouses });
  await client.query('COMMIT');
  console.log('DealFlow360 demo workspace provisioned.');
} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
