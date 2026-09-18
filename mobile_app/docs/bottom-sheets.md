# Shared sheets

Use `component/ui/BottomSheet.tsx` for custom sheet content and `component/ui/ActionSheet.tsx` for action menus. Both use the existing root `BottomSheetModalProvider`.

## BottomSheet

```tsx
const sheet = useRef<BottomSheetModal>(null);

<Button onPress={() => sheet.current?.present()} />
<BottomSheet modalRef={sheet} title="Details" scrollable onDismiss={handleDismiss}>
  <YourContent />
</BottomSheet>
```

The shared component owns floating margins, corners, backdrop, close button, safe areas and light/dark styling. Change those defaults there to update every consumer. Enable `scrollable` for long content; use `BottomSheetTextInput` from Gorhom for keyboard-aware forms inside a sheet. Set `dismissible={false}` while a request must finish. Custom content should follow the app theme.

## ActionSheet

```tsx
const actions = useRef<ActionSheetRef>(null);

actions.current?.present({
  title: 'Document options',
  actions: [
    { id: 'replace', label: 'Replace document', onPress: chooseDocument },
    { id: 'remove', label: 'Remove document', variant: 'destructive', onPress: removeDocument },
  ],
});

<ActionSheet ref={actions} />
```

Actions may return promises, provide accessibility hints, or be disabled. Only one action runs at a time, after dismissal finishes. Supply `onError` for contextual error handling; otherwise an alert is shown. Dismissing without choosing an action runs no action.

The shipment upload route is a transparent modal hosting BottomSheet, so dashboard links and run preselection remain supported. Its ActionSheet selects a run and manages a selected document. Confirmation, review, processing, and completion use ImportSheetPage on the review route after the upload sheet dismisses. All sheets size dynamically to their content, including scrollable sheets. Long content stops at the safe-area-aware maximum height and scrolls within it. The backdrop component keeps a stable identity when dismissal is blocked during processing.
