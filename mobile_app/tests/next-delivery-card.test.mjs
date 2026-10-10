import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
let slots = [], index = 0;
const hooks = { useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => slots[i] = value]; }, useEffect() {} };
const exports = {};
const native = { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x }, AppState: { currentState: 'active' }, Linking: { openURL: async () => {} } };
const transition = { duration() { return this; }, easing() { return this; }, reduceMotion() { return this; } };
const reanimated = { default: { View: 'AnimatedView' }, LinearTransition: transition, Easing: { out: x => x, cubic: x => x }, ReduceMotion: { System: 'system' } };
const modules = { react: hooks, 'react-native-reanimated': reanimated, 'react/jsx-runtime': jsx, 'react-native': native, 'expo-router/react-navigation': { useIsFocused: () => true }, '@expo/vector-icons': { Feather: 'Feather' }, '@/component/ui/Text': { Text: 'Text' }, '@/src/lib/api': { driverApi: {} }, './run-map-data': { locationCoordinate: l => l && l.latitude != null && l.longitude != null ? { latitude: l.latitude, longitude: l.longitude } : null } };
const code = ts.transpileModule(fs.readFileSync(new URL('../src/components/dashboard/NextDeliveryCard.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
vm.runInNewContext(code, { exports, require: n => modules[n], Date, JSON, setInterval, clearInterval });
const shipment = { shipment_id: 'next', status: 'booked', merchant_order_ref: 'REF', dropoff_location: { name: 'Destination', latitude: 0, longitude: 0 } };
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)]; }
function render() { index = 0; return exports.NextDeliveryCard({ shipment, runId: 'run', token: 'token', topInset: 44, onOpenShipment: id => opened = id, onNavigate: id => navigated = id }); }
let opened, navigated;
test('next delivery follows supplied sequence and omits terminal work', () => {
 assert.equal(exports.nextDelivery([{ ...shipment, status: 'delivered' }, shipment, { ...shipment, shipment_id: 'later' }]).shipment_id, 'next');
 for (const status of ['delivered', 'failed', 'returned', 'cancelled']) assert.equal(exports.nextDelivery([{ ...shipment, status }]), undefined);
});
test('Navigate uses the in-app callback for the displayed shipment, including zero coordinates', () => {
 slots = []; let tree = render();
 nodes(tree).find(n => n.props.accessibilityLabel === 'Expand next delivery').props.onPress(); tree = render();
 const button = nodes(tree).find(n => n.props.accessibilityLabel === 'Navigate to delivery in app');
 assert.equal(button.props.disabled, false);
 button.props.onPress(); assert.equal(navigated, 'next');
 assert.ok(nodes(render()).some(n => n.props.accessibilityLabel === 'Expand next delivery'));
 const saved = shipment.dropoff_location; shipment.dropoff_location = null;
 nodes(render()).find(n => n.props.accessibilityLabel === 'Expand next delivery').props.onPress();
 assert.equal(nodes(render()).find(n => n.props.accessibilityLabel === 'Navigate to delivery in app').props.disabled, true);
 shipment.dropoff_location = saved;
});
test('ETA requires matching shipment, real duration and recent calculation', () => {
 const now = Date.now(), route = { status: 'ready', shipment_id: 'next', duration_seconds: 121, calculated_at: new Date(now).toISOString() };
 assert.equal(exports.deliveryEta(route, 'next', now).minutes, 3);
 for (const patch of [{ shipment_id: 'old' }, { duration_seconds: -1 }, { duration_seconds: NaN }, { status: 'unavailable' }, { calculated_at: new Date(now - 91_000).toISOString() }]) assert.equal(exports.deliveryEta({ ...route, ...patch }, 'next', now), null);
});
test('starts collapsed and restores actions only after expanding', () => {
 slots = []; let tree = render();
 assert.equal(nodes(tree).some(n => n.props.children === 'Navigate'), false);
 assert.ok(nodes(tree).some(n => n.props.children === 'Destination'));
 nodes(tree).find(n => n.props.accessibilityLabel === 'Expand next delivery').props.onPress(); tree = render();
 nodes(tree).find(n => n.type === 'Pressable' && nodes(n).some(t => t.props.children === 'View shipment')).props.onPress(); assert.equal(opened, 'next');
 nodes(tree).find(n => n.props.accessibilityLabel === 'Collapse next delivery').props.onPress(); tree = render();
 assert.equal(nodes(tree).some(n => n.props.children === 'Navigate'), false);
 assert.ok(nodes(tree).some(n => n.props.children === 'Destination'));
 nodes(tree).find(n => n.props.accessibilityLabel === 'Expand next delivery').props.onPress(); tree = render();
 assert.ok(nodes(tree).some(n => n.props.children === 'Navigate'));
});
