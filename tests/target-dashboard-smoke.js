const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app-v2.js'), 'utf8');

// Check strict date normalization: incomplete action dates must never become Dashboard periods.
const normDate = html.match(/function normDate\(v\)\{[^\n]+\}/)?.[0];
assert.ok(normDate, 'normDate is available in the application');
const dateCtx = {};
vm.runInNewContext(normDate + '\nthis.parseDate=normDate;', dateCtx);
assert.equal(dateCtx.parseDate('21/9'), '', 'an incomplete date is rejected');
assert.equal(dateCtx.parseDate('31/02/2026'), '', 'an impossible date is rejected');
assert.equal(dateCtx.parseDate('1/10/2026'), '2026-10-01', 'Thai day/month date parses correctly');
assert.equal(dateCtx.parseDate('2026-10-01'), '2026-10-01', 'ISO date remains valid');

// Dashboard date options now use actual dates; Action dates are scoped to Action views.
const dateFns = app.slice(app.indexOf('function rowDate('), app.indexOf('function selected('));
const dateCtx2 = {page:'dashboard',filterState:{periodMode:'month'},rows:n=>({actuals:[{Sales_Date:'2026-10-01'}],actions:[{Due_Date:'21/9'}],weeklyPlans:[{Plan_Date:'22/9'}],teamTargets:[],targets:[]}[n]||[]),normDate:dateCtx.parseDate,isoWeek:()=>''};
vm.runInNewContext(dateFns+'\nthis.getDates=allDates;this.getPeriods=availablePeriods;',dateCtx2);
assert.deepEqual(Array.from(dateCtx2.getPeriods(),x=>Array.from(x)),[['2026-10','OCT/2026']], 'invalid Action dates do not pollute Dashboard period choices');
dateCtx2.page='actions';
assert.deepEqual(Array.from(dateCtx2.getDates()),[], 'incomplete Action dates are rejected in Action filters too');

// Monthly target filter markup includes all requested product dimensions.
assert.match(app, /function targetsPage\(\)[\s\S]*multiFilter\('types','Product Type'[\s\S]*multiFilter\('parts','PART'[\s\S]*multiFilter\('subparts','SUB-PART'[\s\S]*multiFilter\('groupProducts','Group Product'[\s\S]*multiFilter\('products','Product \/ Item'/);
assert.match(app, /function targetMatchesFilter\(x\)[\s\S]*passesTargetDimensions\(x,false\)/, 'team and sale target rows obey product filters');

// Forecast product picker must be enhanced before event binding to prevent native full-screen option lists.
assert.match(app, /if\(page==='productionForecast'\)\{enableSelectSearch\(\$\('#app'\)\);bindProductionForecast\(\)\}/);
assert.match(html, /\.search-select-menu\{display:none[\s\S]*max-height:280px/, 'searchable picker menu stays bounded');

// Check hierarchy table function in isolation with a two-level mock dataset.
const start = app.lastIndexOf('function teamTargetTable(data){');
const end = app.indexOf('function splitTable(data)', start);
assert.ok(start >= 0 && end > start, 'latest teamTargetTable implementation exists');
const ctx = {
  channelUniqueRows:()=>[{Channel_Code:'DMS-001',Channel_Name:'ตลาดสด'}],
  rows:()=>[], esc:x=>String(x??''), fmt:(x,d=2)=>Number(x||0).toFixed(d),
  groupForTarget:t=>t, targetLevel:t=>t.Target_Level||'SUB_PART', targetDimensionLabel:t=>t.Group_Product_Name||t.SUB_PART,
  allocationsForTeam:()=>[], targetActualQty:()=>0
};
vm.runInNewContext(app.slice(app.indexOf('function channelNameForTarget'), end)+'\nthis.makeTree=teamTargetTable;',ctx);
const rows = [
 {Target_ID:'T1',Year:2026,Month:10,Channel:'DMS-001',Product_Type:'SPECIAL',PART:'BB',SUB_PART:'TRIMMING',Target_Level:'SUB_PART',Plan_MT:50},
 {Target_ID:'T2',Year:2026,Month:10,Channel:'DMS-001',Product_Type:'SPECIAL',PART:'BB',SUB_PART:'TRIMMING',Group_Product_Name:'BB TRIMMING',Target_Level:'GROUP_PRODUCT',Plan_MT:25}
];
const tree = ctx.makeTree(rows);
assert.match(tree, /PRODUCT TYPE → PART → SUB-PART → GROUP PRODUCT/);
assert.match(tree, /BB TRIMMING/);
assert.match(tree, /ตลาดสด/, 'Channel code is rendered as its master name');
assert.doesNotMatch(tree, /<th>ปี<\/th>|<th>เดือน<\/th>/, 'Year and Month are not repeated as table columns');
assert.match(tree, /data-team-detail=/, 'records have a detail popup action');
assert.match(tree, /data-tree-expand-all[\s\S]*data-tree-collapse-all/, 'hierarchy has Expand All and Collapse All');
assert.match(app, /function showTeamTargetDetail\(t\)[\s\S]*ปี \/ เดือน[\s\S]*String\(t.Month\)/, 'popup displays target year and month');
assert.match(app, /function categoryActualInPlanUom\(group,date,uom\)[\s\S]*actualSaleKey\(a\)/, 'weekly actual maps a report row with blank Sale_ID through customer master');
assert.match(app, /function weeklyActualInPlanUom\(group,date,uom\)[\s\S]*actualSaleKey\(a\)/, 'weekly matrix actual uses customer assigned Sale as fallback');
assert.match(app, /function weeklyActualPlanSaleMatch\(a,saleId\)[\s\S]*return !assigned\|\|String\(assigned\)===String\(saleId\)/, 'weekly actual rows without Sale_ID can match by customer and item/date');
assert.match(app, /weeklyActualFilterRow\(a,group.Sale_ID\)/, 'weekly filters use the planned Sale when imported Sale_ID and customer assignment are blank');
assert.match(html, /\.team-target-tree \.hierarchy-row\{min-width:1340px;grid-template-columns:[^}]+\}/, 'hierarchy table columns fit the added management actions');
assert.match(app, /weekly-total-plan[^]*weekly-total-actual[^]*% Coverage[^]*ปรับ Plan/, 'weekly summary columns follow Plan, Actual, Coverage, Adjust Plan');
assert.match(app, /function openWeeklyEdit\(o\)[^]*weeklyGroupKey\(x\)===key[^]*openWeeklyEditor/, 'Edit Plan loads every date and plan type for the selected customer/product group');
assert.match(app, /<tr class=\"hierarchy-data-row level-'.*?hierarchy-qty/, 'Dashboard detail rows use table-native rows, not the div hierarchy grid');
assert.match(app, /<colgroup><col class=\"hier-col-product\"><col class=\"hier-col-period\"><col class=\"hier-col-sale\"><col class=\"hier-col-plan\"><col class=\"hier-col-actual\"><col class=\"hier-col-coverage\"><\/colgroup>/, 'Dashboard detail defines one fixed width for each of its six columns');
const targetTreeFn = app.slice(app.lastIndexOf('function teamTargetTable(data){'), app.indexOf('function splitTable(data)', app.lastIndexOf('function teamTargetTable(data){')));
assert.match(targetTreeFn, /channelNameForTarget\(t.Channel\)\)\+'<\/span>/, 'target leaf row shows the Channel name');
assert.doesNotMatch(targetTreeFn, /channelNameForTarget\(t.Channel\).*Group Product|channelNameForTarget\(t.Channel\).*SUB-PART/, 'target leaf does not repeat SUB-PART or Group Product after Channel');
assert.match(html, /hierarchy-table tr\.hierarchy-data-row\{display:table-row/, 'hierarchy rows retain native table column alignment');
assert.match(html, /weekly-summary-row\.weekly-spot-total>th:first-child\{justify-content:flex-start!important;text-align:left!important\}/, 'Contact and Spot summary labels stay left aligned consistently');
assert.match(html, /T_SALES_ACTUAL:\[[^\]]*'Plan_Type'\]/, 'Actual import schema contains Plan_Type');
assert.match(html, /planTypeK=find\('Plan_Type','Plan Type','ประเภทแผน'\)[\s\S]*!planTypeK/, 'Actual import requires the Plan_Type column');
assert.match(html, /Plan_Type:x\.planType/, 'Actual import persists the row Plan_Type');
assert.match(html, /\['Sales_Date','Item_Code','Customer_Code','Plan_Type','Qty','UOM'\]/, 'Actual import template includes Plan_Type');
assert.match(app, /'Contact_Order_Qty','Contact_Order_Date'/, 'weekly plan schema stores Contact order receipt separately');
assert.match(app, /data-w-order-qty[\s\S]*data-w-order-date/, 'weekly plan editor can record received Contact order and date');
assert.match(app, /Contact_Order_Qty:'',Contact_Order_Date:''/, 'cloning last week clears the previous Contact order milestone');
assert.match(app, /weeklyActualPlanTypeMatch\(a,group,date\)/, 'weekly actual matching scopes sales to the selected plan type');
assert.match(app, /รับ Order[\s\S]*ขายจริง/, 'weekly Contact view displays order receipt separately from final sales actual');

const typeMatchCode = app.slice(app.indexOf('function normalizeWeeklyPlanType('), app.indexOf('function categoryActualInPlanUom(', app.indexOf('function normalizeWeeklyPlanType(')));
const matchCtx = {
  actualSaleKey: a => a.Sale_ID || '',
  rows: name => name === 'weeklyPlans' ? matchCtx.weeklyPlans : name === 'items' ? matchCtx.items : [],
  weeklyPlans: [], items: [],
  weeklyPlanDateKey: x => x,
  weeklyActualPlanSaleMatch: (a, saleId) => !a.Sale_ID || a.Sale_ID === saleId
};
vm.runInNewContext(typeMatchCode + '\nthis.typeMatch=weeklyActualPlanTypeMatch;', matchCtx);
const typeGroup = {Plan_Type:'Contact',Sale_ID:'S1',Customer_Code:'C1',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB'};
assert.equal(matchCtx.typeMatch({Plan_Type:'Contact'},typeGroup,'2026-10-05'), true, 'Contact actual maps only to Contact plan');
assert.equal(matchCtx.typeMatch({Plan_Type:'Spot'},typeGroup,'2026-10-05'), false, 'Spot actual is not counted as Contact');
matchCtx.weeklyPlans = [
  {Data_Status:'LIVE',Plan_Date:'2026-10-05',Customer_Code:'C1',Sale_ID:'S1',Plan_Type:'Contact',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB'},
  {Data_Status:'LIVE',Plan_Date:'2026-10-05',Customer_Code:'C1',Sale_ID:'S1',Plan_Type:'Spot',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB'}
];
assert.equal(matchCtx.typeMatch({},typeGroup,'2026-10-05'), false, 'untyped historical sales are not ambiguously attributed when both types are planned');
matchCtx.weeklyPlans.pop();
assert.equal(matchCtx.typeMatch({},typeGroup,'2026-10-05'), true, 'untyped historical sales can map when only one plan type exists');
const weeklyActualStart = app.indexOf('function normalizeWeeklyPlanType(');
const weeklyActualEnd = app.indexOf('function weeklyPlanTable(', weeklyActualStart);
const actualRows = [
  {Data_Status:'LIVE',Sales_Date:'2026-10-05',Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Plan_Type:'Contact',UOM:'KG',Qty:4,Qty_KG:4},
  {Data_Status:'LIVE',Sales_Date:'2026-10-05',Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Plan_Type:'Spot',UOM:'KG',Qty:7,Qty_KG:7}
];
const actualCtx = {
  actualSaleKey:a=>a.Sale_ID,
  rows:name=>name==='weeklyPlans'?matchCtx.weeklyPlans:name==='items'?matchCtx.items:name==='actuals'?actualRows:[],
  weeklyActualPlanSaleMatch:()=>true,weeklyActualFilterRow:a=>a,passesWeeklyPlanFilters:()=>true,
  weeklyPlanDateKey:x=>x,normDate:x=>x,actualUomConversion:()=>({factor:1}),itemFactorInUom:()=>1
};
matchCtx.items=[{Item_Code:'I1',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB',Base_UOM:'KG'}];
matchCtx.weeklyPlans=[
  {Data_Status:'LIVE',Plan_Date:'2026-10-05',Customer_Code:'C1',Sale_ID:'S1',Plan_Type:'Contact',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB'},
  {Data_Status:'LIVE',Plan_Date:'2026-10-05',Customer_Code:'C1',Sale_ID:'S1',Plan_Type:'Spot',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB'}
];
vm.runInNewContext(app.slice(weeklyActualStart,weeklyActualEnd)+'\nthis.weekActual=weeklyActualInPlanUom;',actualCtx);
assert.equal(actualCtx.weekActual({...typeGroup,Item_Code:'I1'},'2026-10-05','KG').qty,4,'Contact weekly Actual totals only Contact-classified sales');
assert.equal(actualCtx.weekActual({...typeGroup,Plan_Type:'Spot',Item_Code:'I1'},'2026-10-05','KG').qty,7,'Spot weekly Actual totals only Spot-classified sales');
assert.match(app, /data-week-subview="orders"[\s\S]*บันทึก Order Contact/, 'weekly plan menu has a separate Contact order-entry view');
assert.match(app, /function contactOrderTable\(week\)[\s\S]*contactOrderCustomer[\s\S]*data-contact-order-qty[\s\S]*data-contact-order-date/, 'Contact order entry selects week/customer and lists planned daily rows');
assert.match(app, /unitTotals=\[\.\.\.new Set\(shown\.map\(x=>String\(x\.Plan_UOM/, 'Contact order summary groups quantities by UOM instead of adding incompatible units');
assert.match(app, /coverageTotal=unitTotals\.map\(x=>x\.uom\+.*x\.order\/x\.plan/, 'Contact order coverage is calculated separately for each UOM');
assert.match(app, /function saveContactOrders\(\)[\s\S]*Contact_Order_Qty:qtyText[\s\S]*Contact_Completed:qtyText\?1:0/, 'Contact order quantities and completion are saved as their own milestone');
assert.match(app, /Contact_Order_Qty','Contact_Order_Date/, 'weekly plan Excel includes Contact order receipt fields');
assert.match(app, /target-metric[\s\S]*target-percent/, 'target hierarchy separates numeric weight values from percentage cells');
assert.match(html, /target-metric\{text-align:right!important[\s\S]*target-percent\{text-align:center!important/, 'target table amounts align right and percentage cells center');
assert.match(app, /weekly-contact-total/, 'weekly matrix keeps a distinct Contact Total row');
assert.match(html, /weekly-contact-total>th:first-child[^]*left:0[^]*wf-identity-width/, 'Contact Total label stays aligned with the frozen identity columns through Sale');

console.log('Target/dashboard smoke checks passed: date validation, scoped filters, searchable production picker, monthly product filters, named Channel display, target hierarchy, detail popup, and expand/collapse.');
