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
const staffPassword = process.env.DEMO_STAFF_PASSWORD ?? process.env.DEMO_SALES_PASSWORD;
if (!staffPassword || staffPassword.length < 7) throw new Error('DEMO_STAFF_PASSWORD must be at least 7 characters.');

const teamSeeds = [
  ['71100000-0000-4000-8000-000000000001', 'Enterprise Sales', 'enterprise'],
  ['71100000-0000-4000-8000-000000000002', 'North Region', 'north'],
  ['71100000-0000-4000-8000-000000000003', 'South Region', 'south'],
  ['71100000-0000-4000-8000-000000000004', 'Strategic Accounts', 'strategic'],
  ['71100000-0000-4000-8000-000000000005', 'Growth Markets', 'growth'],
  ['71100000-0000-4000-8000-000000000006', 'Channel Sales', 'channel'],
];
const staffNames = [
  'Aarav Shah', 'Aditi Rao', 'Aditya Menon', 'Ananya Iyer', 'Arjun Kapoor', 'Diya Nair',
  'Ishaan Verma', 'Kavya Reddy', 'Meera Joshi', 'Neel Gupta', 'Nisha Patel', 'Pranav Bose',
  'Priya Sethi', 'Rahul Khanna', 'Rhea Malhotra', 'Rohan Das', 'Saanvi Kulkarni', 'Sahil Jain',
  'Sara Thomas', 'Shreya Bhat', 'Siddharth Roy', 'Tanvi Arora', 'Varun Pillai', 'Vihaan Mehta',
  'Yash Arvind', 'Zara Fernandes', 'Devika Sen', 'Karan Wadhwa', 'Lakshya Anand', 'Mira George',
  'Nakul Dutta', 'Pooja Krishnan', 'Reyansh Kohli', 'Tara Chawla', 'Kabir Suri', 'Ira Mathur',
];

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const teams = [];
  for (const [id, name, slug] of teamSeeds) {
    const team = (await client.query(`INSERT INTO sales_teams(id,workspace_id,name) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name RETURNING id,name`, [id, workspaceId, name])).rows[0];
    teams.push({ ...team, slug });
  }
  const team = teams[0];
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

  const staffUsers = [];
  let staffIndex = 0;
  for (const assignedTeam of teams.slice(1)) {
    const managerName = staffNames[staffIndex++];
    const managerEmail = `${assignedTeam.slug}.manager@dealflow360.demo`;
    const managerHash = await hashPassword(staffPassword);
    const manager = (await client.query(`INSERT INTO users(workspace_id,email,full_name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash RETURNING id`, [workspaceId, managerEmail, managerName, managerHash])).rows[0];
    await client.query('DELETE FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2', [manager.id, workspaceId]);
    await client.query(`INSERT INTO workspace_memberships(user_id,workspace_id,role,team_id) VALUES($1,$2,'sales_manager',$3)`, [manager.id, workspaceId, assignedTeam.id]);
    await client.query(`INSERT INTO user_preferences(user_id,theme,accent) VALUES($1,'system','blue') ON CONFLICT(user_id) DO NOTHING`, [manager.id]);
    await client.query('UPDATE sales_teams SET manager_user_id=$2 WHERE id=$1', [assignedTeam.id, manager.id]);
    staffUsers.push({ id: manager.id, role: 'sales_manager', teamId: assignedTeam.id, fullName: managerName, email: managerEmail });
    for (let rep = 1; rep <= 5; rep += 1) {
      const fullName = staffNames[staffIndex++];
      const email = `${assignedTeam.slug}.rep${rep}@dealflow360.demo`;
      const passwordHash = await hashPassword(staffPassword);
      const user = (await client.query(`INSERT INTO users(workspace_id,email,full_name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash RETURNING id`, [workspaceId, email, fullName, passwordHash])).rows[0];
      await client.query('DELETE FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2', [user.id, workspaceId]);
      await client.query(`INSERT INTO workspace_memberships(user_id,workspace_id,role,team_id) VALUES($1,$2,'sales_rep',$3)`, [user.id, workspaceId, assignedTeam.id]);
      await client.query(`INSERT INTO user_preferences(user_id,theme,accent) VALUES($1,'system','blue') ON CONFLICT(user_id) DO NOTHING`, [user.id]);
      staffUsers.push({ id: user.id, role: 'sales_rep', teamId: assignedTeam.id, fullName, email });
    }
  }
  for (let rep = 1; rep <= 4; rep += 1) {
    const fullName = staffNames[staffIndex++];
    const email = `enterprise.rep${rep}@dealflow360.demo`;
    const passwordHash = await hashPassword(staffPassword);
    const user = (await client.query(`INSERT INTO users(workspace_id,email,full_name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash RETURNING id`, [workspaceId, email, fullName, passwordHash])).rows[0];
    await client.query('DELETE FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2', [user.id, workspaceId]);
    await client.query(`INSERT INTO workspace_memberships(user_id,workspace_id,role,team_id) VALUES($1,$2,'sales_rep',$3)`, [user.id, workspaceId, team.id]);
    await client.query(`INSERT INTO user_preferences(user_id,theme,accent) VALUES($1,'system','blue') ON CONFLICT(user_id) DO NOTHING`, [user.id]);
    staffUsers.push({ id: user.id, role: 'sales_rep', teamId: team.id, fullName, email });
  }
  for (const [role, email, fullName] of [['admin', 'workspace.admin2@dealflow360.demo', staffNames[staffIndex++]], ['finance_ops', 'finance.ops2@dealflow360.demo', staffNames[staffIndex++]]]) {
    const passwordHash = await hashPassword(staffPassword);
    const user = (await client.query(`INSERT INTO users(workspace_id,email,full_name,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash RETURNING id`, [workspaceId, email, fullName, passwordHash])).rows[0];
    await client.query('DELETE FROM workspace_memberships WHERE user_id=$1 AND workspace_id=$2', [user.id, workspaceId]);
    await client.query(`INSERT INTO workspace_memberships(user_id,workspace_id,role,team_id) VALUES($1,$2,$3,$4)`, [user.id, workspaceId, role, team.id]);
    await client.query(`INSERT INTO user_preferences(user_id,theme,accent) VALUES($1,'system','blue') ON CONFLICT(user_id) DO NOTHING`, [user.id]);
    staffUsers.push({ id: user.id, role, teamId: team.id, fullName, email });
  }

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
  await seedSmokeData(client, { workspaceId, users, team, staffUsers, tiers, categories, products, customers, warehouses });
  await client.query('COMMIT');
  console.log('DealFlow360 demo workspace provisioned.');
} catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
