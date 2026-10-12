/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS Playwright utility. */
// Requires Playwright and the website development server; uses mocked API data only.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
async function pickerCatalogue(page, openEditor, openPicker, picker, editor) {
 await openEditor(); await openPicker();
 const choices = await picker().getByRole('radio').evaluateAll(nodes=>nodes.map(n=>[n.getAttribute('value'),n.getAttribute('aria-label')]));
 assert.equal(choices.length,21);
 await page.keyboard.press('Escape'); await editor().getByRole('button',{name:'Cancel',exact:true}).click();
 return choices;
}

(async () => {
 const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
 try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.setDefaultTimeout(15000);
  console.log('Browser started');
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  let types=[{location_type_id:'test-type',merchant_id:'00000000-0000-0000-0000-000000000001',title:'Example stop',slug:'stop',icon:'coffee',color:'#16a34a',sequence:1,collection_point:false,delivery_point:false,default:false}];
  let failSave=false, saves=0;
  await page.route('**/api/v1/location-types**', async route=>{
   if(route.request().method()==='PATCH') {
    saves++;
    if(failSave) return route.fulfill({status:500,json:{message:'Fixture save failed'}});
    const payload=route.request().postDataJSON();
    types=payload.types.map(t=>({...t,location_type_id:'test-type',merchant_id:payload.merchant_id}));
   }
   return route.fulfill({json:{success:true,data:types}});
  });
  await page.route('**/api/auth/session', route=>route.fulfill({json:{}}));
  await page.goto(`${process.argv[2] || 'http://localhost:3000'}/dev-location-icons-preview`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Fixture loaded');
  const openEditor=()=>page.getByText('Example stop',{exact:true}).click();
  const editor=()=>page.getByRole('dialog',{name:'Edit location type',exact:true});
  const picker=()=>page.getByRole('dialog',{name:'Choose a 3D icon',exact:true});
  const openPicker=()=>editor().getByRole('button',{name:'Choose icon',exact:true}).click();
  const finish=()=>editor().getByRole('button',{name:'Update type',exact:true}).click();
  const save=()=>page.getByRole('button',{name:'Save',exact:true}).click();
  console.log('Opening editor/picker'); await openEditor(); await openPicker();
  assert.equal(await picker().getByRole('radio',{checked:true}).count(),0);
  assert.equal(await picker().getByRole('button',{name:'Use icon',exact:true}).isDisabled(),true);
  await picker().getByRole('radio',{name:'Fuel station',exact:true}).click();
  await picker().getByRole('button',{name:'Cancel',exact:true}).click();
  await editor().getByText('Current value: coffee. Using Warehouse preview.',{exact:true}).waitFor();
  await openPicker(); await page.keyboard.press('Escape');
  await editor().getByRole('button',{name:'Choose icon',exact:true}).waitFor();
  assert.equal(await editor().getByRole('button',{name:'Choose icon',exact:true}).evaluate(el=>document.activeElement===el),true);
  await finish();
  assert.equal(await page.getByRole('button',{name:'Save',exact:true}).isDisabled(),true);
  assert.equal(saves,0);
  const choices = await pickerCatalogue(page, openEditor, openPicker, picker, editor);
  for(const [value,label] of choices) {
   console.log('Opening editor/picker'); await openEditor(); await openPicker();
   await picker().getByRole('radio',{name:label,exact:true}).click();
   await picker().getByRole('button',{name:'Use icon',exact:true}).click();
   await finish(); await save();
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Save'&&b.disabled));
   assert.equal(types[0].icon,value); console.log('Saved',value);
   await page.reload(); console.log('Opening editor/picker'); await openEditor(); await openPicker();
   assert.equal(await picker().getByRole('radio',{name:label,exact:true}).getAttribute('aria-checked'),'true');
   await page.keyboard.press('Escape'); await editor().getByRole('button',{name:'Cancel',exact:true}).click();
  }
  console.log('Opening editor/picker'); await openEditor(); await openPicker();
  await picker().getByRole('radio',{name:'Warehouse',exact:true}).press('ArrowRight');
  await picker().getByRole('radio',{name:'Truck workshop',exact:true,checked:true}).waitFor();
  assert.equal(await picker().getByRole('radio',{name:'Truck workshop',exact:true}).getAttribute('aria-checked'),'true');
  await picker().getByRole('button',{name:'Use icon',exact:true}).click(); await finish();
  failSave=true; await save(); await page.getByText('Fixture save failed',{exact:true}).waitFor();
  assert.equal(types[0].icon,'fuel-station-2');
  assert.equal(await page.getByRole('button',{name:'Save',exact:true}).isEnabled(),true);
  console.log('Opening editor/picker'); await openEditor(); await openPicker();
  assert.equal(await picker().getByRole('radio',{name:'Truck workshop',exact:true}).getAttribute('aria-checked'),'true');
  await page.getByText('Fixture save failed',{exact:true}).waitFor({state:'hidden'});
  await page.screenshot({path:'/tmp/location-icon-picker-light.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{document.documentElement.classList.add('dark');document.body.classList.add('dark');document.documentElement.style.colorScheme='dark';});
  await page.waitForFunction(()=>getComputedStyle(document.body).getPropertyValue('--background').trim()==='oklch(0.145 0 0)');
  await page.screenshot({path:'/tmp/location-icon-picker-dark-mobile.png',animations:'disabled'});
  const bounds=await picker().boundingBox();
  assert.ok(bounds.x>=0 && bounds.x+bounds.width<=390 && bounds.y>=0 && bounds.y+bounds.height<=844);
  await page.keyboard.press('Escape'); await editor().getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'New type',exact:true}).click();
  await page.getByRole('dialog',{name:'Create location type',exact:true}).getByText('Default preview. No icon selected.',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: all 21 save/reload choices, legacy preservation, cancel/Escape/focus, keyboard selection, failed-save draft, blank new type and desktop/light + mobile/dark layout.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
