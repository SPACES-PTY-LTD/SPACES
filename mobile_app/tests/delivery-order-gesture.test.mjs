import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness() {
 const slots=[],effects=[],requests=[];let cursor=0;
 const rows=['a','b','c'].map(shipment_id=>({shipment_id,reference:shipment_id,destination:'Destination'}));
 const react={useRef:initial=>{const i=cursor++;slots[i]??={current:initial};return slots[i];},useState:initial=>{const i=cursor++;slots[i]??={value:initial};return[slots[i].value,value=>{slots[i].value=typeof value==='function'?value(slots[i].value):value;}];},useMemo:(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j]))slots[i]={deps,value:fn()};return slots[i].value;},useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((d,j)=>d!==slots[i].deps[j])){slots[i]?.cleanup?.();slots[i]={deps};effects.push(()=>{slots[i].cleanup=fn();});}}};
 const gesture=()=>{const g={};for(const name of ['enabled','minDistance','maxPointers','blocksExternalGesture','runOnJS','onStart','onUpdate','onFinalize'])g[name]=value=>{g[name+'Value']=value;return g;};return g;};
 const modules={react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'react-native':{...Object.fromEntries(['View','ScrollView','Pressable','ActivityIndicator'].map(n=>[n,n])),Platform:{OS:'ios'},StyleSheet:{create:s=>s},useWindowDimensions:()=>({height:900})},'react-native-gesture-handler':{Gesture:{Native:gesture,Pan:gesture},GestureDetector:'GestureDetector'},'@expo/vector-icons':{Feather:'Feather'},'@gorhom/bottom-sheet':{},'@/component/ui/BottomSheet':{BottomSheet:'BottomSheet'},'@/component/ui/Text':{Text:'Text'},'@/hooks/use-color-scheme':{useColorScheme:()=>({colorScheme:'light'})},'@/src/lib/api':{driverRunActionsApi:{deliveryOrder:async()=>({shipments:rows}),updateDeliveryOrder:async(_token,_run,payload)=>requests.push(payload)}}};
 const source=ts.transpileModule(readFileSync(new URL('../src/components/dashboard/DeliveryOrderSheet.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:false,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(source,{exports,require:name=>{assert.ok(name in modules,name);return modules[name];},requestAnimationFrame:fn=>{effects.push(fn);return 1;},cancelAnimationFrame(){},setInterval:()=>1,clearInterval(){}});
 function render(component,props){cursor=0;const tree=component(props);while(effects.length)effects.shift()();return tree;}
 function findAll(node,predicate){if(!node||typeof node!=='object')return[];return[...(predicate(node)?[node]:[]),...[node.props?.children].flat(Infinity).flatMap(child=>findAll(child,predicate))];}
 return{exports,render,findAll,requests,flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}
test('native handle blocks scroll and stays stable across drag renders with current callbacks',()=>{
 const h=harness(),scroll={},events=[];
 const props={scrollGesture:scroll,label:'Delivery',disabled:false,color:'grey',onStart:y=>events.push(['start',y]),onMove:(dy,y)=>events.push(['move',dy,y]),onFinish:cancel=>events.push(['finish',cancel]),onAdjust(){}};
 const pan=h.render(h.exports.DeliveryDragHandle,props).props.gesture;
 assert.equal(pan.blocksExternalGestureValue,scroll);assert.equal(pan.runOnJSValue,true);assert.equal(pan.enabledValue,true);
 pan.onStartValue({absoluteY:300});
 const current=h.render(h.exports.DeliveryDragHandle,{...props,onMove:(dy,y)=>events.push(['fresh',dy,y])}).props.gesture;assert.equal(current,pan);
 current.onUpdateValue({translationY:100,absoluteY:400});current.onFinalizeValue({translationY:105,absoluteY:405},true);
 assert.deepEqual(events,[['start',300],['fresh',100,400],['fresh',105,405],['finish',false]]);
});
test('cancellation discards drag and disabled accessibility moves are blocked',()=>{
 const h=harness(),events=[],props={scrollGesture:{},label:'Delivery',disabled:false,color:'grey',onStart(){},onMove(){},onFinish:cancel=>events.push(cancel),onAdjust:n=>events.push(n)};
 const tree=h.render(h.exports.DeliveryDragHandle,props),pan=tree.props.gesture;pan.onStartValue({absoluteY:300});pan.onFinalizeValue({translationY:90,absoluteY:390},false);assert.deepEqual(events,[true]);
 tree.props.children.props.onAccessibilityAction({nativeEvent:{actionName:'increment'}});assert.deepEqual(events,[true,1]);
 const disabled=h.render(h.exports.DeliveryDragHandle,{...props,disabled:true});assert.equal(disabled.props.gesture.enabledValue,false);disabled.props.children.props.onAccessibilityAction({nativeEvent:{actionName:'decrement'}});assert.deepEqual(events,[true,1]);
});
test('reorder saves complete new sequence with the original concurrency guard',async()=>{
 const h=harness(),props={token:'token',runId:'run',onDismiss(){},onSaved(){}};h.render(h.exports.DeliveryOrderSheet,props);await h.flush();let tree=h.render(h.exports.DeliveryOrderSheet,props);
 const handle=()=>h.findAll(tree,n=>n.type===h.exports.DeliveryDragHandle)[0].props;
 handle().onStart(300);tree=h.render(h.exports.DeliveryOrderSheet,props);assert.equal(tree.props.dismissible,false);
 handle().onMove(192,492);tree=h.render(h.exports.DeliveryOrderSheet,props);handle().onFinish();tree=h.render(h.exports.DeliveryOrderSheet,props);
 const handles=h.findAll(tree,n=>n.type===h.exports.DeliveryDragHandle);assert.match(handles[0].props.label,/b/);assert.match(handles[2].props.label,/a/);
 const button=h.findAll(tree,n=>n.type==='Pressable').at(-1);assert.equal(button.props.disabled,false);button.props.onPress();await h.flush();
 assert.deepEqual(JSON.parse(JSON.stringify(h.requests)),[{shipment_ids:['b','c','a'],expected_shipment_ids:['a','b','c']}]);
});
