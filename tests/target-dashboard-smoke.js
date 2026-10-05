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
assert.match(html, /weekly-contact-total>\*\{position:static!important;left:auto!important;top:auto!important;z-index:auto!important\}/, 'optional weekly matrix has no frozen identity/summary columns');
assert.match(html, /grid-template-columns:minmax\(285px,2fr\) repeat\(4,minmax\(125px,\.95fr\)\) repeat\(2,minmax\(105px,\.8fr\)\) minmax\(250px,1\.8fr\)/, 'team target hierarchy explicitly allocates eight columns including management actions');
assert.match(app, /data-week-subview=\"daily\"[\s\S]*data-week-subview=\"summary\"[\s\S]*data-week-subview=\"matrix\"[\s\S]*data-week-subview=\"orders\"/, 'weekly page provides vertical, product summary, matrix, and Contact order tabs');
assert.match(app, /function weeklyDailyPlanTable\([\s\S]*วันที่ \/ วัน[\s\S]*ประมาณการณ์ผลิต[\s\S]*Actual \(หน่วย Plan\)[\s\S]*weeklyDailyPrev/, 'vertical weekly list shows daily forecast, planned-unit Actual and pagination');
assert.match(app, /function weeklyProductSummaryTable\([\s\S]*Plan Contact \(MT\)[\s\S]*Plan Spot \(MT\)[\s\S]*ประมาณการณ์ผลิต \(MT\)[\s\S]*Actual \(MT\)/, 'product summary compares Contact/Spot plans, forecast, and actual');
assert.match(html, /#app \.weekly-matrix tbody td[^]*position:static!important/, 'weekly matrix cells are not sticky');

// Weekly product summary uses one product-level row and rolls Item actuals to the configured Plan level.
const weeklyCoreStart = app.indexOf('function weeklyPlanToMt(');
const weeklyCoreEnd = app.indexOf('function weeklyPlanTable(', weeklyCoreStart);
const summaryPlans = [
  {Plan_ID:'W1',Week_Key:'W41/2026',Plan_Date:'2026-10-05',Customer_Code:'C1',Sale_ID:'S1',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB',Plan_Type:'Contact',Plan_Qty:2,Plan_UOM:'MT',Plan_MT:2,KG_Per_UOM:1000},
  {Plan_ID:'W2',Week_Key:'W41/2026',Plan_Date:'2026-10-06',Customer_Code:'C1',Sale_ID:'S1',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB',Plan_Type:'Spot',Plan_Qty:500,Plan_UOM:'KG',Plan_KG:500,KG_Per_UOM:1}
];
const summaryCtx={
  rows:name=>({weeklyPlans:summaryPlans,items:[{Item_Code:'I1',Item_Name:'Item one',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB',Group_Product_ID:'G1'}],groupProducts:[{Group_Product_ID:'G1',Group_Product_Name:'Group one'}],customers:[{Customer_Code:'C1',Customer_Name:'Customer one'}],sales:[{Sale_ID:'S1',Sale_Name:'Sale one'}],dailyProductionForecast:[{Data_Status:'LIVE',Forecast_Date:'2026-10-05',Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB',Forecast_MT:4}],actuals:[{Data_Status:'LIVE',Sales_Date:'2026-10-05',Sale_ID:'S1',Customer_Code:'C1',Item_Code:'I1',Plan_Type:'Contact',Qty_MT:1}]}[name]||[]),
  active:x=>x, weeklyPlanDateKey:x=>String(x||'').slice(0,10),toWeekRange:()=>({start:'2026-10-05',end:'2026-10-11'}),normalizeWeeklyPlanType:x=>String(x||''),
  weeklyActualPlanTypeMatch:()=>true,weeklyActualFilterRow:(a,s)=>({...a,Sale_ID:s}),actualSaleKey:a=>a.Sale_ID||'',passesWeeklyPlanFilters:()=>true,actualQtyMT:a=>Number(a.Qty_MT||0),
  groupUomFactor:()=>1000,itemFactorInUom:()=>1000,contactOrderEntriesForPlan:()=>[],fmt:(x,d=2)=>Number(x||0).toFixed(d),esc:x=>String(x??''),
  weeklySummarySearch:'',weeklySummaryPage:1,filterState:{},
};
vm.runInNewContext(app.slice(weeklyCoreStart,weeklyCoreEnd)+'\nthis.makeSummary=weeklyProductSummaryRows;this.planMt=weeklyPlanToMt;',summaryCtx);
const productSummary=summaryCtx.makeSummary('W41/2026',summaryPlans);
assert.equal(productSummary.length,1,'weekly summary is grouped at the selected SUB-PART plan level');
assert.equal(productSummary[0].contactPlanMt,2,'Contact plan is converted to MT');
assert.equal(productSummary[0].spotPlanMt,.5,'Spot plan is converted from KG to MT');
assert.equal(productSummary[0].forecastMt,4,'production forecast is rolled up by product and date');
assert.equal(productSummary[0].actualMt,1,'Actual is rolled from Item to the matching SUB-PART Plan');
assert.equal(productSummary[0].coverage,40,'coverage uses Actual divided by total Plan');

// Contact order entry defaults receipt date from Plan and supports multiple editable receipt events.
assert.match(app,/TAB\.contactOrders='T_CONTACT_ORDER'[\s\S]*HEAD\[TAB\.contactOrders\]=\['Order_ID','Plan_ID'[\s\S]*Order_Date[\s\S]*Order_Qty/,'multi-date Contact orders have a dedicated Sheet schema');
assert.match(app,/function contactOrderEntryRow\([\s\S]*Order_Date\?weeklyPlanDateKey\(entry\.Order_Date\):extra\?'':d[\s\S]*data-contact-order-date[\s\S]*data-contact-order-add/,'planned queue date initializes editable receipt date and add-order action exists');
assert.match(app,/tabs=\[\.\.\.Object\.keys\(schema\),TAB\.customers,TAB\.prospects,TAB\.actions,TAB\.contactOrders\]/,'new contact-order ledger sheet is created automatically when missing');
assert.match(app,/HEAD\[TAB\.weeklyPlans\]=\[\.\.\.HEAD\[TAB\.weeklyPlans\],'Plan_Type','Contact_Completed','Product_Type','PART','SUB_PART','Group_Product_ID','Group_Product_Name'\]/,'weekly-plan schema remains within the live A:Y sheet; order receipt detail stays in the separate ledger');
assert.doesNotMatch(app,/HEAD\[TAB\.weeklyPlans\]=[^\n]*Contact_Order_Qty|HEAD\[TAB\.weeklyPlans\]=[^\n]*Contact_Order_Date/,'contact-order columns are not appended beyond the live weekly-plan grid');
assert.match(app,/function saveContactOrders\([\s\S]*Order_Type:extra\?'EXTRA':'PLAN'[\s\S]*orderAdds\.push\(updated\)/,'receipt dates and extra order quantities are stored separately from the Plan');
const entryStart=app.indexOf('function contactOrderEntriesForPlan(');
const entryEnd=app.indexOf('function contactOrderEntryRow(',entryStart);
const entryCtx={weeklyRemovedOrderIds:[],rows:n=>n==='contactOrders'?entryCtx.orders:[],weeklyPlanDateKey:x=>String(x||'').slice(0,10),orders:[]};
vm.runInNewContext(app.slice(entryStart,entryEnd)+'\nthis.getEntries=contactOrderEntriesForPlan;',entryCtx);
const planRow={Plan_ID:'P1',Week_Key:'W41/2026',Plan_Date:'2026-10-05',Plan_UOM:'KG',Contact_Order_Qty:'',Contact_Order_Date:''};
assert.equal(entryCtx.getEntries(planRow)[0].Order_Date,'2026-10-05','first receipt date is seeded from the Plan date');
const orderRowStart=app.indexOf('function contactOrderEntryRow(');const orderRowEnd=app.indexOf('function contactOrderTable(',orderRowStart);const orderRowCtx={rows:n=>n==='groupProducts'?[]:n==='sales'?[{Sale_ID:'S1',Sale_Name:'Sale one'}]:[],weeklyPlanDateKey:x=>String(x||'').slice(0,10),esc:x=>String(x??''),fmt:x=>String(x||0)};vm.runInNewContext(app.slice(orderRowStart,orderRowEnd)+'\nthis.drawOrderRow=contactOrderEntryRow;',orderRowCtx);const seededRow=orderRowCtx.drawOrderRow({...planRow,Sale_ID:'S1',Plan_Qty:10,Product_Type:'TYPE',PART:'PART',SUB_PART:'SUB'},entryCtx.getEntries(planRow)[0],false);assert.match(seededRow,/data-contact-order-date type=\"date\" value=\"2026-10-05\"/,'editable receipt-date input is initially filled with Plan date');assert.match(orderRowCtx.drawOrderRow({...planRow,Sale_ID:'S1'}, {Order_Type:'EXTRA',Order_Date:'',Order_Qty:''},true),/รับเพิ่มจากแผน/,'extra order entry is visibly identified');
entryCtx.orders=[{Order_ID:'O1',Plan_ID:'P1',Order_Date:'2026-10-05',Order_Qty:10,Order_UOM:'KG',Order_Type:'PLAN',Data_Status:'LIVE'},{Order_ID:'O2',Plan_ID:'P1',Order_Date:'2026-10-07',Order_Qty:5,Order_UOM:'KG',Order_Type:'EXTRA',Data_Status:'LIVE'}];
assert.equal(entryCtx.getEntries(planRow).length,2,'one Plan can have multiple received-order dates/quantities');

console.log('Target/dashboard smoke checks passed: date validation, scoped filters, searchable production picker, monthly product filters, named Channel display, target hierarchy, detail popup, and expand/collapse.');
