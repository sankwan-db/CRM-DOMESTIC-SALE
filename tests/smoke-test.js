const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app-v2.js'), 'utf8');
assert.match(html, /app-v2\.js\?v=weekly-plan-fix-20261004-05/, 'GitHub Pages cache key is refreshed for weekly plan fixes');
assert.doesNotMatch(html, /M_PRODUCT_GROUP:'G'/, 'Google Sheets loader does not request unused M_PRODUCT_GROUP');
assert.match(html, /T_WEEKLY_CUSTOMER_PLAN:'Y'/, 'Google Sheets loader reads Group Product fields on weekly plans');
assert.match(app, /HEAD\[TAB\.weeklyPlans\]=\[\.\.\.HEAD\[TAB\.weeklyPlans\],'Plan_Type','Contact_Completed','Product_Type','PART','SUB_PART'/, 'Weekly plans persist at Product Type/PART/SUB-PART grain');
assert.match(app, /delete TAB\.productGroups[\s\S]*delete HEAD\.M_PRODUCT_GROUP/, 'Product groups use M_GROUP_PRODUCT without loading M_PRODUCT_GROUP');
assert.match(app, /async function clonePreviousWeek\(\)[\s\S]*?shifted=source\.map[\s\S]*?openWeeklyEditor\(week,'',shifted\)/, 'Pulling the prior week copies all saved plans without requiring Sale selection');
assert.match(app, /data-w-sale[\s\S]*customer\?\.Assigned_Sale_ID/, 'Weekly plan selects Sale per customer from Customer Master');
assert.equal((app.match(/function weeklyPlanTable\(list\)\{/g)||[]).length,1,'Only one weekly plan table renderer is active');
assert.match(app,/data-weekly-expand[\s\S]*?ย่อกลับ/,'Weekly matrix has a visible expand/collapse control');
assert.match(app,/data-week-edit[\s\S]*?แก้ไขคิว/,'Weekly matrix retains per-plan schedule edit controls');
assert.match(app, /function downloadWeeklyPlanTemplate[\s\S]*CRM_Weekly_Customer_Plan_Template\.xlsx/, 'Weekly Plan provides an Excel template');
assert.match(app, /function exportWeeklyPlanExcel[\s\S]*Weekly_Plan_/, 'Weekly Plan supports Excel export');
assert.match(app, /function importWeeklyPlanExcel[\s\S]*prepareWeeklyPlanImport/, 'Weekly Plan supports validated Excel import');
assert.match(app, /data-w-prev-metric[\s\S]*?priorWeeklyMetrics/, 'Weekly planning rows show previous-week Plan and Actual context');
assert.match(app, /data-at="table"[\s\S]*data-at="kanban"[\s\S]*data-at="calendar"/, 'Action tabs are present');
assert.match(app, /id="baSale"[\s\S]*id="baChannel"[\s\S]*id="baType"[\s\S]*id="baPart"[\s\S]*id="baSub"[\s\S]*id="addActionPlan"[\s\S]*id="saveActionBatch"/, 'No-base Action has one shared header and add/save-all controls');
assert.match(app, /function batchPlanRow[\s\S]*data-a-date[\s\S]*data-a-kind[\s\S]*data-a-customer-type[\s\S]*data-a-qty[\s\S]*data-a-uom[\s\S]*data-a-detail/, 'No-base detail rows contain the required Plan fields');
assert.doesNotMatch(app.match(/function batchPlanRow[\s\S]*?\nfunction addActionPlanRow/)?.[0]||'', /data-a-item/, 'No-base detail rows do not require a separate Item selection');
assert.match(app, /function actionDetailFormV2[\s\S]*id="dNext"[\s\S]*id="dNextDate"[\s\S]*id="dComment"/, 'Action detail editor includes Next Action, due date, and Manager comment');
assert.match(app, /data-a-customer-box[\s\S]*data-a-prospect-box[\s\S]*onchange=e=>\{const p=e\.target\.value==='PROSPECT'/, 'Old customer and Prospect inputs switch mutually exclusively');
assert.match(app, /HEAD\[TAB\.targets\]=\[\.\.\.HEAD\[TAB\.targets\],'Product_Type','PART','SUB_PART'\]/, 'Monthly Sale target stores category grain');

const ctx = {
  console,
  CONFIG: {},
  TAB: { groupProducts:'M_GROUP_PRODUCT',productTypes:'M_PRODUCT_TYPE',parts:'M_PART',subParts:'M_SUB_PART',teamTargets: 'T_TEAM_TARGET', targets: 'T_MONTHLY_TARGET', weeklyPlans: 'T_WEEKLY_CUSTOMER_PLAN' },
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
ctx.rows = name => ctx.db[name] || [];
ctx.db = {
  groupProducts: [{Group_Product_ID:'GRP1',Group_Product_Name:'Demo Group',Product_Type_ID:'TYPE1',PART_ID:'PART1',SUB_PART_ID:'SUB1',Active:'Y'}],
  productTypes: [{Product_Type_ID:'TYPE1',Product_Type:'Special',Active:'Y'}],
  parts: [{PART_ID:'PART1',PART:'Leg',Active:'Y'}],
  subParts: [{SUB_PART_ID:'SUB1',PART_ID:'PART1',SUB_PART:'DMS',Active:'Y'}],
  items: [{Item_Code:'I1',Item_Name:'Demo Item',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Base_UOM:'BOX',KG_Per_UOM:500}],
  sales: [{Sale_ID:'S1',Sale_Name:'Sale One',Channel:'Market'},{Sale_ID:'S2',Sale_Name:'Sale Two',Channel:'Market'}],
  customers: [{Customer_Code:'C1',Customer_Name:'Customer One',Assigned_Sale_ID:'S1',Channel:'Market'},{Customer_Code:'C2',Customer_Name:'Customer Two',Assigned_Sale_ID:'S2',Channel:'Market'},{Customer_Code:'C3',Customer_Name:'Customer Three',Assigned_Sale_ID:'S1',Channel:'Market'}], actuals: [], actions: [], weeklyPlans: [],
  targets: [{Target_ID:'A1',Year:2026,Month:10,Channel:'Market',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Sale_ID:'S1',Target_MT:10,Data_Status:'LIVE'}]
};
let source = app.replace(/drawNav\(\);go\('dashboard'\);/g, '');
source += '\nthis.crmTestApi={selfCheck,isoWeek,toWeekRange,allocationsForTeam,teamTargetTable,salesProductReport,categoryMasterRows,buildWeeklyRecord,buildFollowupRecords,weeklyCalendar,weeklyPlanTable,passesWeeklyPlanFilters,normalizeWeeklyKey,weeklyPlanDateKey,weeklyActualInPlanUom,filterState,categoryActualInPlanUom,contactAcceptancePct,actionRowV2,actionCard,calendarMonth,groupUomOptions,customerLovOptionsForGroup,priorWeeklyMetrics,prepareWeeklyPlanImport};';
vm.runInNewContext(source, ctx, {filename:'app-v2.js'});
const api = ctx.crmTestApi;
assert.equal(api.selfCheck.bad.length, 0, 'built-in date/UOM checks pass');
assert.equal(api.isoWeek('2026-09-30'), 'W40/2026');
assert.deepEqual(JSON.parse(JSON.stringify(api.toWeekRange('W40/2026'))), {start:'2026-09-28',end:'2026-10-04'});
const team = {Year:2026,Month:10,Channel:'Market',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_MT:12,Data_Status:'LIVE'};
ctx.db.teamTargets = [team];
assert.equal(api.allocationsForTeam(team).reduce((n,x)=>n+Number(x.Target_MT),0),10,'allocation totals match exact category');
ctx.db.targets.push({Target_ID:'A2',Year:2026,Month:10,Channel:'Market',Product_Type:'Value Add',PART:'Leg',SUB_PART:'DMS',Sale_ID:'S1',Target_MT:99,Data_Status:'LIVE'});
assert.equal(api.allocationsForTeam(team).reduce((n,x)=>n+Number(x.Target_MT),0),10,'same SUB-PART under a different Product Type is excluded');
const targetHtml = api.teamTargetTable([team]);
for (const text of ['2026','10','Special','Leg','DMS','Team Target']) assert.ok(targetHtml.includes(text), `target summary includes ${text}`);
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
ctx.db.actuals=[{Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Sales_Date:'2026-09-30',Qty_MT:.5,Data_Status:'LIVE'}];
const weeklyMatrix=api.weeklyPlanTable([weekly]);
for(const text of ['28/09/2026','30/09/2026','<th class="plan-head">Plan</th><th class="actual-head">Actual</th>','Contact Plan','Spot Plan','weekly-total-actual'])assert.ok(weeklyMatrix.includes(text),`weekly matrix includes ${text}`);
assert.match(weeklyMatrix,/50\.0%/,'Coverage is calculated from imported Actual vs Plan');
api.filterState.periodMode='month';api.filterState.years=['2026'];api.filterState.periods=['2026-10'];
const savedW39={Week_Key:'W39/2026',Plan_Date:'22/9/2026',Data_Status:'',Sale_ID:'SALE-001',Customer_Code:'100003',Channel:'DMS',Product_Type:'VALUE ADD',PART:'PAWS',SUB_PART:'PAWS (A)',Group_Product_ID:'GRP-035'};
assert.equal(api.passesWeeklyPlanFilters(savedW39),true,'A selected weekly Plan is not hidden by an unrelated global month period filter');
assert.equal(api.normalizeWeeklyKey(' WEEK 39 / 2026 '),'W39/2026','Week labels are normalized despite spacing and WEEK prefix');
assert.equal(api.normalizeWeeklyKey('', '22/9/2026'),'W39/2026','Plan Date recovers the week when the saved Week_Key is blank');
assert.equal(String(savedW39.Week_Key).trim(),'W39/2026','Saved Sheet week key matches the selected week');
ctx.db.weeklyPlans=[{Week_Key:'W40/2026',Sale_ID:'S1',Customer_Code:'C1',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:2,Plan_UOM:'BOX',Data_Status:'LIVE'}];
ctx.db.actuals=[{Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Sales_Date:'2026-09-30',Qty_KG:500,Qty_MT:.5,Data_Status:'LIVE'}];
assert.deepEqual(JSON.parse(JSON.stringify(api.priorWeeklyMetrics('W41/2026','S1','C1','Special','Leg','DMS','BOX'))),{week:'W40/2026',planQty:2,actualQty:1,missing:0,uom:'BOX'},'Next-week plan carries prior Plan and item-converted Actual in selected Plan UOM');
const importedWeekly=api.prepareWeeklyPlanImport([{Week_Key:'W40/2026',Plan_Date:'2026-09-28',Plan_Type:'Contact',Customer_Code:'C2',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:2,Plan_UOM:'BOX',Sale_ID:''}],'W40/2026');
assert.equal(importedWeekly[0].Sale_ID,'S2','Excel import defaults Sale from Customer Master');
assert.equal(importedWeekly[0].Plan_MT,1,'Excel import converts Plan quantities using Item Master UOM');
const overriddenWeekly=api.prepareWeeklyPlanImport([{Week_Key:'W40/2026',Plan_Date:'2026-09-28',Plan_Type:'Contact',Customer_Code:'C2',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:2,Plan_UOM:'BOX',Sale_ID:'S1'}],'W40/2026');
assert.equal(overriddenWeekly[0].Sale_ID,'S1','Excel import allows a week-specific Sale override');
assert.deepEqual(weeklySet.map(x=>x.Plan_Type),['Contact','Spot'],'Contact and Spot are stored separately by scheduled date');
assert.deepEqual(weeklySet.map(x=>x.Plan_MT),[1,1.5]);
assert.throws(() => api.buildWeeklyRecord('W40/2026', ctx.db.sales[0], {Plan_Date:'2026-10-05',Customer_Code:'C1',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Qty:1,Plan_UOM:'MT',KG_Per_UOM:1000}), /ไม่อยู่ในช่วง/);
const followup = api.buildFollowupRecords(ctx.db.sales[0], 'Special', 'Leg', 'DMS', [
  {Due_Date:'2026-09-30',Action_Type:'เข้าพบลูกค้า',Customer_Type:'OLD',Customer_Code:'C1',Plan_Qty:2,Plan_UOM:'BOX',KG_Per_UOM:500,Action_Detail:'Visit'},
  {Due_Date:'2026-10-01',Action_Type:'โทรติดตาม',Customer_Type:'PROSPECT',Prospect_Name:'Prospect X',Plan_Qty:3,Plan_UOM:'MT',KG_Per_UOM:1000,Action_Detail:'Call'}
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
assert.match(oldLov,/C1/,'Old customer LOV can reuse prior Action history for the selected category');
assert.match(oldLov,/C2/,'Customer LOV can reuse a customer from prior weekly Plan');
assert.doesNotMatch(oldLov,/C3/,'Old customer LOV excludes unrelated product groups');
ctx.db.itemUoms=[{Item_Code:'I1',UOM:'BOX',KG_Per_UOM:500,Active:'Y'},{Item_Code:'I2',UOM:'BOX',KG_Per_UOM:500,Active:'Y'}];
ctx.db.items.push({Item_Code:'I2',Item_Name:'Demo Item 2',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Base_UOM:'BOX',KG_Per_UOM:500});
assert.match(api.groupUomOptions('Special','Leg','DMS'), /BOX.*500/,'Group UOM dropdown uses consistent master conversion');
ctx.db.itemUoms.push({Item_Code:'I2',UOM:'CRATE',KG_Per_UOM:800,Active:'Y'});
ctx.db.itemUoms.push({Item_Code:'I1',UOM:'CRATE',KG_Per_UOM:700,Active:'Y'});
assert.doesNotMatch(api.groupUomOptions('Special','Leg','DMS'), /CRATE/,'Single-factor UOM dropdown excludes inconsistent factors when a uniform conversion is required');
ctx.db.items.find(x=>x.Item_Code==='I2').KG_Per_UOM=600;
ctx.db.itemUoms.find(x=>x.Item_Code==='I2'&&x.UOM==='BOX').KG_Per_UOM=600;
assert.match(api.groupUomOptions('Special','Leg','DMS','BOX',true), /แปลงตามอัตราของแต่ละ Item/,'Weekly Plan permits the same UOM with different per-Item conversion factors');
ctx.db.weeklyPlans=[{Week_Key:'W40/2026',Plan_Date:'2026-09-30',Sale_ID:'S1',Customer_Code:'C1',Product_Type:'Special',PART:'Leg',SUB_PART:'DMS',Plan_Type:'Contact',Plan_Qty:10,Plan_UOM:'BOX',Data_Status:'LIVE'}];
ctx.db.actuals=[{Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Sales_Date:'2026-09-30',Qty_KG:1000,Qty_MT:1,Data_Status:'LIVE'},{Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I2',Sales_Date:'2026-09-30',Qty_KG:1200,Qty_MT:1.2,Data_Status:'LIVE'}];
const itemConverted=api.weeklyPlanTable(ctx.db.weeklyPlans);
assert.match(itemConverted,/4\.000/,'Actual sums item-by-item equivalents in the Plan UOM');
assert.match(itemConverted,/40\.0%/,'Coverage compares aggregated item-converted Actual with Plan quantity');
assert.equal(followup[0].Product_Type,'Special');
assert.equal(followup[0].PART,'Leg');
assert.equal(followup[0].SUB_PART,'DMS');
assert.match(api.weeklyCalendar([weekly]), /data-week-del="WPLAN-TEST"/, 'weekly Plan can be deleted from calendar');
const action={Action_ID:'ACT-1',Due_Date:'2026-09-30',Next_Action_Date:'2026-10-02',Next_Action:'Send quotation',Manager_Comment:'Follow up with price',Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Action_Type:'โทรติดตาม',Status:'OPEN',Plan_MT:2,Closed_Sales_MT:0,Product_Type:'Special',PART:'Leg',SUB_PART:'DMS'};
assert.match(api.actionRowV2(action), /Send quotation[\s\S]*2026-10-02[\s\S]*Follow up with price/, 'Action details include next step, due date, and manager comment');
assert.match(api.actionCard(action), /2026-10-02/, 'Kanban shows the latest Next Action date');
assert.match(api.calendarMonth([action]), /2026-10-02/, 'Calendar places Action on the latest Next Action date');
console.log('CRM smoke tests passed: script link, tabs, target dimensions, category matching, weekly matrix Plan/Actual by category, multi-customer Contract/Spot planning, Contact acceptance %, no-base batch saves at category grain, grouped UOM master conversion, weekly Sale defaults and Excel plan import/export, and item-to-category reporting.');
