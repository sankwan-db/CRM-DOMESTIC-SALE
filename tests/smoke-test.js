const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app-v2.js'), 'utf8');
assert.match(html, /<script src="app-v2\.js(?:\?[^" ]*)?"><\/script>/, 'V2 UI script is loaded by GitHub Pages with or without a cache-busting query');
assert.match(html, /weekly-matrix thead th,[\s\S]*?position:static!important;inset:auto!important/, 'Weekly matrix has no frozen rows or columns');
assert.match(html, /M_GROUP_PRODUCT:'G'/, 'Google Sheets loader requests the product group master');
assert.match(html, /T_WEEKLY_CUSTOMER_PLAN:'Y'/, 'Google Sheets loader reads exactly the live weekly-plan columns');
assert.match(html, /T_SALES_ACTION:'AM'/, 'Google Sheets loader reads all 39 live Action columns through Group Product');
assert.doesNotMatch(html, /T_SALES_ACTION:'AI'/, 'Google Sheets loader does not truncate the extended Action sheet at AI');
assert.match(html, /ensureCustomerLookupSheets\(\)[\s\S]*T_CONTACT_ORDER[\s\S]*T_DAILY_PRODUCTION_FORECAST/, 'missing app-owned transaction sheets are created before batch loading');
assert.match(html, /path\.startsWith\('\?'\)\|\|path\.startsWith\('\:'\)\?base\+path/, 'Sheets method URLs support the colon form required by batchUpdate');
assert.doesNotMatch(html + app, /api\('batchUpdate'/, 'all spreadsheet batchUpdate calls use the correct colon endpoint');
assert.match(app, /HEAD\[TAB\.weeklyPlans\]=\[\.\.\.HEAD\[TAB\.weeklyPlans\],'Plan_Type','Contact_Completed','Product_Type','PART','SUB_PART','Group_Product_ID','Group_Product_Name'\]/, 'Weekly plans persist at Product Type/PART/SUB-PART/Group Product grain without order fields');
assert.match(app, /async function clonePreviousWeek\(\)[\s\S]*?cloneWeeklyPlanRow\(x,week\)[\s\S]*?append\(TAB\.weeklyPlans,cloned\)[\s\S]*?openWeeklyEditor\(week,'',targetPlans\)/, 'Pulling the prior week copies saved plans into the target week without requiring Sale selection');
assert.match(app, /data-w-sale[\s\S]*customer\?\.Assigned_Sale_ID/, 'Weekly plan selects Sale per customer from Customer Master');
assert.match(app, /function downloadWeeklyPlanTemplate[\s\S]*CRM_Weekly_Customer_Plan_Template\.xlsx/, 'Weekly Plan provides an Excel template');
assert.match(app, /function exportWeeklyPlanExcel[\s\S]*Weekly_Plan_/, 'Weekly Plan supports Excel export');
assert.match(app, /function importWeeklyPlanExcel[\s\S]*prepareWeeklyPlanImport/, 'Weekly Plan supports validated Excel import');
assert.match(app, /data-w-prev-metric[\s\S]*?priorWeeklyMetrics/, 'Weekly planning rows show previous-week Plan and Actual context');
assert.match(app, /data-at="table"[\s\S]*data-at="kanban"[\s\S]*data-at="calendar"/, 'Action tabs are present');
assert.match(app, /data-action-mode="combined"[\s\S]*เป้าหมายย่อยรายสัปดาห์/, 'Sales Action opens on the weekly sub-target view');
assert.match(app, /id="combinedAddAction"[\s\S]*function actionTypeChoice[\s\S]*data-action-choice="base"[\s\S]*data-action-choice="followup"/, 'A single + Action control routes users to the existing base-plan or Prospect tab');
assert.match(app, /function monthlySaleTargetMt[\s\S]*function weeklyTargetBySale[\s\S]*monthlySaleTargetMt\(t\)[\s\S]*monthWeeks\(y,m\)\.size/, 'Monthly targets allocated per Sale become evenly split weekly sub-targets');
assert.match(app, /function weeklyTargetSummary[\s\S]*เป้าหมายย่อยรวม[\s\S]*Plan รวม[\s\S]*Actual รวม/, 'Weekly action page compares sub-target, plan, and imported actual');
assert.match(app, /function combinedWeeklyPlanRows\(week\)[\s\S]*weeklyDailyRows\(week,weekPlans\)[\s\S]*rows\('actions'\)/, 'Combined weekly tab merges base-customer plans and prospect actions');
assert.match(app, /function combinedWeeklyPlanRows\(week\)[\s\S]*toWeekRange\(week\)[\s\S]*Due_Date/, 'Combined weekly tab scopes follow-up actions to the selected Monday–Sunday week');
assert.match(app, /data-combined-edit-base[\s\S]*data-combined-edit-action/, 'Combined weekly rows keep separate edit actions for both plan types');
assert.match(html, /oauthClientId:'227097865826-pp11vn2t5qtg69q8ito5nb9g9t165e47\.apps\.googleusercontent\.com'/, 'Google OAuth Client ID is available in the inline config before the app bundle loads');
assert.doesNotMatch(html, /oauthClientId:'PASTE_GOOGLE_OAUTH_WEB_CLIENT_ID'/, 'Google connection does not fall back to the placeholder OAuth ID');
const dashboardTables = html.match(/const PAGE_TABLE_KEYS=\{dashboard:\[([^\]]+)\]/)?.[1] || '';
const actionTables = html.match(/actions:\[([^\]]+)\]/)?.[1] || '';
assert.ok(dashboardTables.includes('actuals') && !dashboardTables.includes('weeklyPlans') && !dashboardTables.includes('actionHistory'), 'Dashboard loads its own data first and defers weekly/action history tables until Sales Action opens');
assert.ok(actionTables.includes('weeklyPlans') && actionTables.includes('actionHistory'), 'Sales Action loads its weekly plans and history only when needed');
assert.match(html, /async function go\(p\)[\s\S]*loadDb\(p,false\)/, 'Changing pages only fetches tables not loaded yet');
assert.match(html, /async function loadDb\(scope=page,force=true\)[\s\S]*keys=keys.filter\(k=>!loadedDbTables.has\(k\)\)/, 'Manual refresh can force the active page data while navigation loads only missing sheets');
assert.match(app, /id="baSale"[\s\S]*id="baChannel"[\s\S]*id="baType"[\s\S]*id="baPart"[\s\S]*id="baSub"[\s\S]*id="addActionPlan"[\s\S]*id="saveActionBatch"/, 'No-base Action has one shared header and add/save-all controls');
assert.match(app, /function batchPlanRow[\s\S]*data-a-date[\s\S]*data-a-kind[\s\S]*data-a-customer-type[\s\S]*data-a-qty[\s\S]*data-a-uom[\s\S]*data-a-detail/, 'No-base detail rows contain the required Plan fields');
assert.doesNotMatch(app.match(/function batchPlanRow[\s\S]*?\nfunction addActionPlanRow/)?.[0]||'', /data-a-item/, 'No-base detail rows do not require a separate Item selection');
assert.match(app, /function actionDetailFormV2[\s\S]*id="dNext"[\s\S]*id="dNextDate"[\s\S]*id="dComment"/, 'Action detail editor includes Next Action, due date, and Manager comment');
assert.match(app, /data-a-customer-box[\s\S]*data-a-prospect-box[\s\S]*onchange=e=>\{const p=e\.target\.value==='PROSPECT'/, 'Old customer and Prospect inputs switch mutually exclusively');
assert.match(app, /HEAD\[TAB\.targets\]=\[\.\.\.HEAD\[TAB\.targets\],'Product_Type','PART','SUB_PART'\]/, 'Monthly Sale target stores category grain');

const ctx = {
  console,
  document: { documentElement: { dataset: {} }, addEventListener() {}, querySelector() { return null; } },
  window: { addEventListener() {} },
  $() { return null; },
  CONFIG: {},
  TAB: { teamTargets: 'T_TEAM_TARGET', targets: 'T_MONTHLY_TARGET', weeklyPlans: 'T_WEEKLY_CUSTOMER_PLAN' },
  HEAD: {
    T_TEAM_TARGET: ['Target_ID','Year','Month','Channel','SUB_PART','Plan_MT','Updated_By','Updated_At','Data_Status'],
    T_MONTHLY_TARGET: ['Target_ID','Year','Month','Channel','Item_Code','Target_MT'],
    T_WEEKLY_CUSTOMER_PLAN: ['Plan_ID','Week_Key','Plan_Date']
  },
  db: {},
  rows: null,
  active(arr) { return arr.filter(x => String(x.Active || 'Y').toUpperCase() !== 'N'); },
  esc(value) { return String(value ?? ''); },
  fmt(value, digits=2) { return Number(value || 0).toFixed(digits); },
  normDate(value) { return String(value || '').slice(0,10); },
  id(prefix) { return prefix + '-TEST'; },
  legacyActionForm() {},
  legacyImportMaster() {},
  localToday: () => '2026-09-30',
  me: 'test@example.com'
};
ctx.selectedTestChannel='';
ctx.$ = selector => selector==='#baChannel' ? {value:ctx.selectedTestChannel} : null;
ctx.rows = name => ctx.db[name] || [];
ctx.db = {
  productGroups: [{Product_Group_ID:'G1',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Base_UOM:'MT',Active:'Y'}],
  items: [{Item_Code:'I1',Item_Name:'Demo Item',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Base_UOM:'BOX',KG_Per_UOM:500}],
  sales: [{Sale_ID:'S1',Sale_Name:'Sale One',Channel:'Market'},{Sale_ID:'S2',Sale_Name:'Sale Two',Channel:'Market'}],
  customers: [{Customer_Code:'C1',Customer_Name:'Customer One',Assigned_Sale_ID:'S1',Channel:'Market'},{Customer_Code:'C2',Customer_Name:'Customer Two',Assigned_Sale_ID:'S2',Channel:'Market'},{Customer_Code:'C3',Customer_Name:'Customer Three',Assigned_Sale_ID:'S1',Channel:'Market'}], actuals: [], actions: [], weeklyPlans: [],
  targets: [{Target_ID:'A1',Year:2026,Month:10,Channel:'Market',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Sale_ID:'S1',Target_MT:10,Data_Status:'LIVE'}]
};
let source = app.replace(/drawNav\(\);go\('dashboard'\);/g, '');
source += '\nthis.crmTestApi={selfCheck,isoWeek,toWeekRange,allocationsForTeam,teamTargetTable,salesProductReport,categoryMasterRows,buildWeeklyRecord,buildFollowupRecords,weeklyCalendar,weeklyPlanTable,weeklyDailyPlanTable,weeklyProductSummaryTable,contactAcceptancePct,actionRowV2,actionCard,calendarMonth,groupUomOptions,customerLovOptionsForGroup,priorWeeklyMetrics,prepareWeeklyPlanImport,combinedWeeklyPlanRows,weeklyTargetBySale,weeklyTargetSummary,weeklySalePlanTotals,weeklySaleActuals};';
vm.runInNewContext(source, ctx, {filename:'app-v2.js'});
const api = ctx.crmTestApi;
ctx.db.actions = [
  {Action_ID:'ACT-W40',Due_Date:'2026-09-28',Sale_ID:'S1',Customer_Code:'C1',Customer_Type:'EXISTING',Plan_Qty:2,Plan_UOM:'BOX',Status:'OPEN',Data_Status:'LIVE'},
  {Action_ID:'ACT-W40-PROSPECT',Due_Date:'2026-10-04',Sale_ID:'S1',Prospect_Name:'Prospect Sunday',Customer_Type:'PROSPECT',Plan_Qty:1,Plan_UOM:'BOX',Status:'OPEN',Data_Status:'LIVE'},
  {Action_ID:'ACT-W41',Due_Date:'2026-10-05',Sale_ID:'S1',Customer_Code:'C1',Customer_Type:'EXISTING',Plan_Qty:9,Plan_UOM:'BOX',Status:'OPEN',Data_Status:'LIVE'}
];
ctx.db.weeklyPlans = [{Plan_ID:'WPLAN-W40',Week_Key:'W40/2026',Plan_Date:'2026-09-28',Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Channel:'Market',Plan_Type:'Contact',Plan_Qty:3,Plan_UOM:'BOX',KG_Per_UOM:500,Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Data_Status:'LIVE'}];
ctx.db.actuals=[{Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Plan_Type:'Contact',Sales_Date:'2026-09-30',Qty_MT:.5,Data_Status:'LIVE'}];
const combined = api.combinedWeeklyPlanRows('W40/2026');
assert.equal(api.weeklyTargetBySale('W40/2026').get('S1'),2,'October monthly Sale target is spread evenly over its five ISO weeks; a cross-month week receives one weekly share');
ctx.db.targets.push({Target_ID:'SEP-PLANMT',Year:2026,Month:9,Channel:'Market',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Sale_ID:'S1',Target_MT:'',Plan_MT:50,Data_Status:'LIVE'});
assert.equal(api.weeklyTargetBySale('W39/2026').get('S1'),10,'Weekly sub-target comes from monthly Sale target rows, falls back to Plan_MT, and divides evenly across September ISO weeks');
assert.equal(api.weeklyTargetBySale('W40/2026').get('S1'),12,'A week spanning September and October receives one weekly share from each month');
assert.equal(api.weeklySalePlanTotals('W40/2026').get('S1'),1.5,'Weekly Plan totals combine the base-customer plan in MT');
assert.equal(api.weeklySaleActuals('W40/2026').get('S1'),0.5,'Weekly Actual totals come from imported sales Actual');
const weeklySummary=api.weeklyTargetSummary('W40/2026');
for(const text of ['เป้าหมายย่อยรวม','Plan รวม','Actual รวม','12.000 MT','1.500 MT','0.500 MT'])assert.ok(weeklySummary.includes(text),`weekly summary contains ${text}`);
assert.equal(combined.length,3,'Combined weekly plan includes base and follow-up rows from selected ISO week only');
assert.equal(combined.filter(x=>x.kind==='BASE').length,1,'Base-customer weekly Plan is included');
assert.equal(combined.filter(x=>x.kind==='FOLLOWUP').length,2);
assert.ok(combined.every(x=>x.date>='2026-09-28'&&x.date<='2026-10-04'),'Combined weekly plan respects Monday–Sunday boundaries');
assert.equal(api.selfCheck.bad.length, 0, 'built-in date/UOM checks pass');
assert.equal(api.isoWeek('2026-09-30'), 'W40/2026');
assert.deepEqual(JSON.parse(JSON.stringify(api.toWeekRange('W40/2026'))), {start:'2026-09-28',end:'2026-10-04'});
const team = {Year:2026,Month:10,Channel:'Market',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_MT:12,Data_Status:'LIVE'};
ctx.db.teamTargets = [team];
assert.equal(api.allocationsForTeam(team).reduce((n,x)=>n+Number(x.Target_MT),0),10,'allocation totals match exact category');
ctx.db.targets.push({Target_ID:'A2',Year:2026,Month:10,Channel:'Market',Product_Type:'Value Add',PART:'Leg',SUB_PART:'DMS',Sale_ID:'S1',Target_MT:99,Data_Status:'LIVE'});
assert.equal(api.allocationsForTeam(team).reduce((n,x)=>n+Number(x.Target_MT),0),10,'same SUB-PART under a different Product Type is excluded');
const targetHtml = api.teamTargetTable([team]);
for (const text of ['Special','Leg','DMS','12.00 MT','เป้าทีม (MT)','Actual (MT)']) assert.ok(targetHtml.includes(text), `target hierarchy includes ${text}`);
const report = api.salesProductReport([{Sale_ID:'S1',Item_Code:'I1',Qty_MT:4}],ctx.db.targets.slice(0,1));
assert.equal(report.length,1);
assert.equal(report[0].Plan,10);
assert.equal(report[0].Actual,4,'item Actual aggregates to category Plan');
assert.equal(report[0].Success,40);
const weekly = api.buildWeeklyRecord('W40/2026', ctx.db.sales[0], {
  Plan_Date:'2026-09-30', Customer_Code:'C1', Product_Type:'Special', PART:'Leg', SUB_PART:'DMS', Plan_Qty:2,
  Plan_UOM:'BOX', KG_Per_UOM:500, Plan_Type:'Contact'
});
assert.equal(weekly.Plan_KG,1000);
assert.equal(weekly.Plan_MT,1);
assert.equal(weekly.Plan_Type,'Contact');
assert.equal(weekly.Contact_Completed,0);
assert.equal(weekly.Item_Code,'','weekly Plan stores category grain, not Item');
assert.equal(weekly.Product_Type,'Special');
assert.equal(api.contactAcceptancePct(1,.5),50,'Contact acceptance is Actual divided by Plan MT');
const weeklySet=[
  api.buildWeeklyRecord('W40/2026',ctx.db.sales[0],{Plan_Date:'2026-09-28',Customer_Code:'C1',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:2,Plan_UOM:'BOX',KG_Per_UOM:500,Plan_Type:'Contact'}),
  api.buildWeeklyRecord('W40/2026',ctx.db.sales[0],{Plan_Date:'2026-09-29',Customer_Code:'C2',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:3,Plan_UOM:'BOX',KG_Per_UOM:500,Plan_Type:'Spot'})
];
assert.equal(weeklySet.length,2,'one coordinator batch can contain plans for multiple customers');
assert.deepEqual(weeklySet.map(x=>x.Sale_ID),['S1','S2'],'weekly Sale defaults independently from each Customer Master row');
ctx.db.actuals=[{Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Plan_Type:'Contact',Sales_Date:'2026-09-30',Qty_MT:.5,Data_Status:'LIVE'}];
const weeklyMatrix=api.weeklyPlanTable([weekly]);
for(const text of ['28/09/2026','30/09/2026','Contact','Spot รายวัน','Actual','ขยายตาราง','ปรับ Plan'])assert.ok(weeklyMatrix.includes(text),`weekly matrix includes ${text}`);
assert.match(weeklyMatrix,/50\.0%/,'Contact coverage is calculated from imported Actual vs Plan');
const pairedWeekly=api.buildWeeklyRecord('W40/2026',ctx.db.sales[0],{Plan_Date:'2026-09-30',Customer_Code:'C1',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:1,Plan_UOM:'BOX',KG_Per_UOM:500,Plan_Type:'Spot'});
const pairHtml=api.weeklyPlanTable([weekly,pairedWeekly]);
assert.match(pairHtml,/weekly-type-group[\s\S]*Contact[\s\S]*weekly-type-group[\s\S]*Spot รายวัน/,'Contact and Spot plans are shown in separate plan-type groups');
assert.match(pairHtml,/Sale 50\.0%/,'Actual is matched to the Contact plan and not counted against Spot');
assert.match(pairHtml, /<td class="num weekly-total-actual">1\.000<\/td>/, 'Summary Actual is aggregated in Plan UOM across the customer/product group');
assert.match(pairHtml,/weekly-expand-toggle/,'weekly matrix includes a reversible expand control');
const weeklyDailyHtml=api.weeklyDailyPlanTable('W40/2026',[weekly]);
assert.match(weeklyDailyHtml,/สินค้า · SUB-PART \/ GROUP PRODUCT/,'daily plan retains the selected product label');
assert.doesNotMatch(weeklyDailyHtml,/Demo Item|Special · Leg|<small>Special/,'daily plan hides crossed-out secondary item and category details');
const weeklyProductHtml=api.weeklyProductSummaryTable('W40/2026',[]);
assert.doesNotMatch(weeklyProductHtml,/Item ที่รวม|Item ·/,'weekly product summary omits the crossed-out Item aggregation column');

ctx.db.weeklyPlans=[{Week_Key:'W40/2026',Plan_Date:'2026-09-30',Sale_ID:'S1',Customer_Code:'C1',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:2,Plan_UOM:'BOX',Plan_Type:'Contact',Data_Status:'LIVE'}];
ctx.db.actuals=[{Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Plan_Type:'Contact',Sales_Date:'2026-09-30',Qty_MT:.5,Data_Status:'LIVE'}];
assert.deepEqual(JSON.parse(JSON.stringify(api.priorWeeklyMetrics('W41/2026','S1','C1','Special','Leg','DMS','BOX','Contact'))),{week:'W40/2026',planQty:2,actualQty:1,missing:0,uom:'BOX'},'Next-week plan carries previous-week Plan and Actual in the selected UOM for the same Sale/customer/category');
const importedWeekly=api.prepareWeeklyPlanImport([{Week_Key:'W40/2026',Plan_Date:'2026-09-28',Plan_Type:'Contact',Customer_Code:'C2',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:2,Plan_UOM:'BOX',Sale_ID:''}],'W40/2026');
assert.equal(importedWeekly[0].Sale_ID,'S2','Excel import defaults Sale from Customer Master');
assert.equal(importedWeekly[0].Plan_MT,1,'Excel import converts Plan quantities using Item Master UOM');
const overriddenWeekly=api.prepareWeeklyPlanImport([{Week_Key:'W40/2026',Plan_Date:'2026-09-28',Plan_Type:'Contact',Customer_Code:'C2',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:2,Plan_UOM:'BOX',Sale_ID:'S1'}],'W40/2026');
assert.equal(overriddenWeekly[0].Sale_ID,'S1','Excel import allows a week-specific Sale override');
assert.deepEqual(weeklySet.map(x=>x.Plan_Type),['Contact','Spot'],'Contact and Spot are stored separately by scheduled date');
assert.deepEqual(weeklySet.map(x=>x.Plan_MT),[1,1.5]);
assert.throws(() => api.buildWeeklyRecord('W40/2026', ctx.db.sales[0], {Plan_Date:'2026-10-05',Customer_Code:'C1',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:1,Plan_UOM:'MT',KG_Per_UOM:1000}), /ไม่อยู่ในช่วง/);
const followup = api.buildFollowupRecords(ctx.db.sales[0], [
  {Due_Date:'2026-09-30',Action_Type:'เข้าพบลูกค้า',Customer_Type:'OLD',Customer_Code:'C1',Plan_Qty:2,Plan_UOM:'BOX',KG_Per_UOM:500,Action_Detail:'Visit',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Action_Product_Level:'SUB_PART'},
  {Due_Date:'2026-10-01',Action_Type:'โทรติดตาม',Customer_Type:'PROSPECT',Prospect_Name:'Prospect X',Plan_Qty:3,Plan_UOM:'MT',KG_Per_UOM:1000,Action_Detail:'Call',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Action_Product_Level:'SUB_PART'}
], 'B1');
assert.equal(followup.length,2);
assert.equal(followup[0].Customer_Code,'C1');
assert.equal(followup[0].Item_Code,'','No-base Plan remains at Product Type/PART/SUB-PART grain');
assert.equal(followup[0].Plan_MT,1);
assert.equal(followup[1].Customer_Code,'');
assert.equal(followup[1].Prospect_Name,'Prospect X');
assert.equal(followup[1].Plan_MT,3);
assert.equal(followup[0].Channel,'Market');
ctx.db.customerProducts=[{Customer_Code:'C2',Product_Type:'Value Add',PART:'Leg',SUB_PART:'DMS',Active:'Y'},{Customer_Code:'C3',Product_Type:'Value Add',PART:'Leg',SUB_PART:'DMS',Active:'Y'}];
ctx.db.actions=followup;
ctx.db.weeklyPlans=[{Customer_Code:'C2',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Data_Status:'LIVE'}];
const oldLov=api.customerLovOptionsForGroup('Special','Leg','DMS');
ctx.db.sales.push({Sale_ID:'S3',Sale_Name:'Other Sale',Channel:'Other'});
ctx.db.customers.push({Customer_Code:'C4',Customer_Name:'Other Channel Customer',Assigned_Sale_ID:'S3',Channel:'Other'});
ctx.db.channels=[{Channel_Code:'Market',Channel_Name:'ตลาดสด',Active:'Y'}];
ctx.db.customers.slice(0,3).forEach(c=>c.Channel='ตลาดสด');
ctx.selectedTestChannel='Market';
const channelLov=api.customerLovOptionsForGroup();
assert.match(channelLov,/Customer One/,'Existing customer LOV lists Customer Master names for the selected Channel');
assert.match(channelLov,/Customer Three/,'Existing customer LOV does not require a product association before products are selected');
assert.doesNotMatch(channelLov,/Other Channel Customer/,'Existing customer LOV is filtered by the Sale Channel');
ctx.db.itemUoms=[{Item_Code:'I1',UOM:'BOX',KG_Per_UOM:500,Active:'Y'},{Item_Code:'I2',UOM:'BOX',KG_Per_UOM:500,Active:'Y'}];
ctx.db.items.push({Item_Code:'I2',Item_Name:'Demo Item 2',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Base_UOM:'BOX',KG_Per_UOM:500});
assert.match(api.groupUomOptions('Special','Leg','DMS'), /BOX.*500/,'Group UOM dropdown uses consistent master conversion');
ctx.db.itemUoms.push({Item_Code:'I2',UOM:'CRATE',KG_Per_UOM:800,Active:'Y'});
ctx.db.itemUoms.push({Item_Code:'I1',UOM:'CRATE',KG_Per_UOM:700,Active:'Y'});
assert.doesNotMatch(api.groupUomOptions('Special','Leg','DMS'), /CRATE/,'Variable-conversion UOM is not silently treated as one fixed conversion');
assert.match(api.groupUomOptions('Special','Leg','DMS','',true), /CRATE[\s\S]*data-variable=\"Y\"/,'Configured variable-conversion UOM remains selectable and is marked per Item');
const variableGroupPlan=api.buildWeeklyRecord('W40/2026',ctx.db.sales[0],{Plan_Date:'2026-09-30',Customer_Code:'C1',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:2,Plan_UOM:'CRATE',Plan_Type:'Contact'});
assert.equal(variableGroupPlan.Plan_MT,'','Variable conversion is not falsely flattened into one MT value');
assert.equal(followup[0].Product_Type,'Special');
assert.equal(followup[0].PART,'Leg');
assert.equal(followup[0].SUB_PART,'DMS');
assert.match(api.weeklyCalendar([weekly]), /data-week-del="WPLAN-TEST"/, 'weekly Plan can be deleted from calendar');
const action={Action_ID:'ACT-1',Due_Date:'2026-09-30',Next_Action_Date:'2026-10-02',Next_Action:'Send quotation',Manager_Comment:'Follow up with price',Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Action_Type:'โทรติดตาม',Status:'OPEN',Plan_MT:2,Closed_Sales_MT:0,Product_Type:'Special',PART:'Leg',SUB_PART:'DMS'};
assert.match(api.actionRowV2(action), /Send quotation[\s\S]*2026-10-02[\s\S]*Follow up with price/, 'Action details include next step, due date, and manager comment');
assert.match(api.actionCard(action), /2026-10-02/, 'Kanban shows the latest Next Action date');
assert.match(api.calendarMonth([action]), /2026-10-02/, 'Calendar places Action on the latest Next Action date');
console.log('CRM smoke tests passed: script link, tabs, target dimensions, category matching, weekly matrix Plan/Actual by category, multi-customer Contract/Spot planning, Contact acceptance %, no-base batch saves at category grain, grouped UOM master conversion, weekly Sale defaults and Excel plan import/export, and item-to-category reporting.');
