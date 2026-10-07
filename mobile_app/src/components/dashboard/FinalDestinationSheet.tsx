import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/component/ui/BottomSheet';
import { documentImportApi } from '@/src/lib/api';
import { LocationSearchPicker, type LocationSearchPickerHandle } from '../LocationSearchPicker';

export function FinalDestinationSheet({ token, runId, onDismiss, onSaved }: {
  token: string; runId: string; onDismiss: () => void; onSaved: () => void;
}) {
  const modal = useRef<BottomSheetModal>(null);
  const picker = useRef<LocationSearchPickerHandle>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => modal.current?.present());
    return () => cancelAnimationFrame(frame);
  }, [token, runId]);
  return <LocationSearchPicker key={`${token}:${runId}`} ref={picker} token={token} selectedLabel="SELECTED DESTINATION" selectionIcon="flag" confirmLabel="Save final destination" onBusyChange={setSaving} onConfirm={async location => {
    await documentImportApi.chooseFinalDestination(token, runId, location.location_id);
    modal.current?.dismiss();
    onSaved();
  }}>
    {({ searchHeader, content }) => <BottomSheet keyboardBehavior="fillParent" stickyHeader={searchHeader} onScroll={event => picker.current?.onScroll(event)} showHandle={false} modalRef={modal} title="Choose final destination" scrollable dismissible={!saving} onDismiss={onDismiss}>
      {content}
    </BottomSheet>}
  </LocationSearchPicker>;
}
