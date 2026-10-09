import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness() {
  const slots = [], effects = [], requests = []; let cursor = 0, tree;
  const modules = {
    react: {
      useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
      useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
      useCallback(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((dep,j) => dep !== slots[i].deps[j])) slots[i] = { fn, deps }; return slots[i].fn; },
      useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((dep,j) => dep !== slots[i].deps[j])) { slots[i]?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
    },
    'react/jsx-runtime': { jsx: (type,props) => ({type,props}), jsxs: (type,props) => ({type,props}) },
    'react-native': { View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', AppState: { addEventListener: () => ({ remove() {} }) } },
    '@gorhom/bottom-sheet': {}, '@/component/ui/BottomSheet': { BottomSheet: 'BottomSheet' }, '@/component/ui/Text': { Text: 'Text' },
    '@/hooks/use-color-scheme': { useColorScheme: () => ({ colorScheme: 'dark' }) },
    '@/src/lib/api': { driverApi: { getRun: (...args) => new Promise((resolve,reject) => requests.push({args,resolve,reject})) } },
    './RunSummaryCard': { RunSummaryCard: 'RunSummaryCard' }, '../dashboard/RunTimeline': { RunTimeline: 'RunTimeline' },
    '../dashboard/StopDetailsSheet': { StopDetailsSheet: 'StopDetailsSheet' }, '../shipments/ShipmentDetails': { ShipmentDetailsSheet: 'ShipmentDetailsSheet' },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/components/runs/RunDetailsSheet.tsx',import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>modules[name],requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){}});
  function render(){cursor=0;tree=exports.RunDetailsSheet({token:'token',runId:'run-1',onDismiss(){}});while(effects.length)effects.shift()();}
  function nodes(type){const result=[];function visit(n){if(!n||typeof n!=='object')return;if(Array.isArray(n))return n.forEach(visit);if(n.type===type)result.push(n);visit(n.props?.children);}visit(tree);return result;}
  return {render,nodes,requests,async flush(){for(let i=0;i<10;i++)await Promise.resolve();render();},unmount(){slots.forEach(s=>s?.cleanup?.());}};
}
const run = status => ({reference:'Run 123',status,shipments:[{shipment_id:'shipment-1',merchant_order_ref:'Shipment 123',status:'delivered'}],recorded_stops:[{stop_id:'stop-1'}]});
test('run sheet loads authorized details and preserves completed shipment scope', async()=>{
  const app=harness();app.render();assert.deepEqual(app.requests[0].args,['token','run-1']);app.requests[0].resolve(run('completed'));await app.flush();
  assert.equal(app.nodes('RunSummaryCard')[0].props.run.reference,'Run 123');
  app.nodes('Pressable').find(n=>n.props.accessibilityLabel==='Open Shipment 123').props.onPress();app.render();
  assert.equal(app.nodes('ShipmentDetailsSheet')[0].props.runId,'run-1');
  const stop={stop_id:'stop-1'};app.nodes('RunTimeline')[0].props.onOpenStop(stop);app.render();assert.equal(app.nodes('StopDetailsSheet')[0].props.stop,stop);app.unmount();
});
test('failed run loading retries and unmounted requests cannot apply details',async()=>{
  const app=harness();app.render();app.requests[0].reject(new Error('Not authorized'));await app.flush();assert.equal(app.nodes('RunSummaryCard').length,0);
  app.nodes('Pressable')[0].props.onPress();app.render();assert.equal(app.requests.length,2);app.unmount();app.requests[1].resolve(run('in_progress'));await app.flush();assert.equal(app.nodes('RunSummaryCard').length,0);
});
