import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness() {
  const slots=[],effects=[],requests=[],saves=[];let cursor=0,tree;
  let props={token:'session',busy:false,onSave:payload=>saves.push(payload),onDismiss(){}};
  const modules={
    react:{useRef:initial=>{const i=cursor++;slots[i]??={current:initial};return slots[i];},useState:initial=>{const i=cursor++;slots[i]??={value:initial};return[slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value;}];},useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j])){slots[i]?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=fn();});}}},
    'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    '@expo/vector-icons':{Feather:'Feather'},'@gorhom/bottom-sheet':{BottomSheetTextInput:'TextInput'},
    'react-native':{ActivityIndicator:'ActivityIndicator',Pressable:'Pressable',TextInput:'TextInput',View:'View'},
    '@/component/ui/BottomSheet':{BottomSheet:'BottomSheet'},'@/component/ui/Text':{Text:'Text'},
    '@/hooks/use-color-scheme':{useColorScheme:()=>({colorScheme:'dark'})},
    '@/src/lib/api':{driverApi:{listCancelReasons:token=>new Promise((resolve,reject)=>requests.push({token,resolve,reject}))}},
  };
  const exports={};const source=ts.transpileModule(readFileSync(new URL('../src/components/shipments/CancelShipmentSheet.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>modules[name],requestAnimationFrame:fn=>{effects.push(fn);return 1;},cancelAnimationFrame(){}});
  function nodes(type){const found=[];function visit(n){if(!n||typeof n!=='object')return;if(Array.isArray(n))return n.forEach(visit);if(n.type===type)found.push(n);visit(n.props?.children);visit(n.props?.footer);}visit(tree);return found;}
  const app={requests,saves,nodes,render(changes={}){props={...props,...changes};cursor=0;tree=exports.CancelShipmentSheet(props);while(effects.length)effects.shift()();return tree;},async flush(){for(let i=0;i<8;i++)await Promise.resolve();app.render();},press(label){const n=nodes('Pressable').find(n=>n.props.accessibilityLabel===label);assert.ok(n,label);n.props.onPress();app.render();},input(label,value){const n=nodes('TextInput').find(n=>n.props.accessibilityLabel===label);assert.ok(n,label);n.props.onChangeText(value);app.render();},saveButton(){return nodes('Pressable').find(n=>n.props.accessibilityLabel==='Save cancellation');},unmount(){slots.forEach(s=>s?.cleanup?.());}};app.render();return app;
}
const reasons=[{code:'other',title:'Other',enabled:true},{code:'weather_delay',title:'Weather delay',enabled:true},{code:'disabled',title:'Disabled reason',enabled:false}];
async function ready(){const app=harness();assert.equal(app.requests[0].token,'session');app.requests[0].resolve({data:reasons});await app.flush();return app;}
test('server reasons retain codes, filter disabled and place Other last; selection never saves',async()=>{
 const app=await ready();assert.equal(app.saveButton().props.disabled,true);app.press('Cancellation reason');
 assert.deepEqual(app.nodes('Pressable').filter(n=>n.props.accessibilityRole==='radio').map(n=>n.props.accessibilityLabel),['Weather delay','Other']);
 app.press('Weather delay');assert.equal(app.saves.length,0);assert.equal(app.nodes('TextInput').some(n=>n.props.accessibilityLabel==='Custom cancellation reason'),false);
 app.input('Cancellation note','  Delayed  ');app.press('Save cancellation');assert.deepEqual(JSON.parse(JSON.stringify(app.saves)),[{reason_code:'weather_delay',note:'Delayed'}]);
});
test('Other needs trimmed custom reason; changing preset excludes stale custom text',async()=>{
 const app=await ready();app.press('Cancellation reason');app.press('Other');app.input('Custom cancellation reason','   ');assert.equal(app.saveButton().props.disabled,true);
 app.input('Custom cancellation reason','  Customer requested cancellation  ');app.press('Save cancellation');assert.equal(app.saves[0].reason,'Customer requested cancellation');
 app.press('Cancellation reason');app.press('Weather delay');app.press('Save cancellation');assert.equal(app.saves[1].reason,undefined);
});
test('loading/error retry and empty reasons block save without flashing empty state',async()=>{
 const app=harness();assert.equal(app.saveButton().props.disabled,true);assert.equal(app.nodes('Text').some(n=>n.props.children==='No cancellation reasons available.'),false);
 app.requests[0].reject(new Error('offline'));await app.flush();assert.equal(app.saveButton().props.disabled,true);app.press('Retry cancellation reasons');assert.equal(app.requests.length,2);app.requests[1].resolve({data:[]});await app.flush();assert.equal(app.saveButton().props.disabled,true);assert.ok(app.nodes('Text').some(n=>n.props.children==='No cancellation reasons available.'));
});
test('busy/errors preserve draft and late requests cannot update unmounted form',async()=>{
 const app=await ready();app.press('Cancellation reason');app.press('Other');app.input('Custom cancellation reason','Custom reason');const sheet=app.render({busy:true,error:'Try again'});assert.equal(sheet.props.dismissible,false);app.press('Save cancellation');assert.equal(app.saves.length,0);
 app.render({busy:false});app.press('Save cancellation');assert.equal(app.saves[0].reason,'Custom reason');
 const late=harness();late.unmount();late.requests[0].resolve({data:reasons});await late.flush();assert.equal(late.saveButton().props.disabled,true);
});

test('keyboard-aware custom/note inputs scroll above a persistent save footer',async()=>{
 const app=await ready();app.press('Cancellation reason');app.press('Other');const tree=app.render();assert.equal(tree.props.keyboardBehavior,'fillParent');assert.equal(tree.props.footer.props.accessibilityLabel,'Save cancellation');assert.equal(app.nodes('TextInput').length,2);
});
