/** Illustrative processing messages; only the API response confirms completion. */
export const DELIVERY_NOTE_READING_INTERVAL_MS = 3200;
export const DELIVERY_NOTE_READING_STAGES = [
  'Scanning the document…',
  'Reading the document text…',
  'Extracting the delivery note number…',
  'Extracting the collection date…',
  'Finding shipments…',
  'Extracting shipment numbers…',
  'Reading collection addresses…',
  'Reading delivery addresses…',
  'Matching shipments to known locations…',
  'Identifying shipment types…',
  'Extracting quantities and parcel details…',
  'Reading weights and measurements…',
  'Checking for duplicate shipment references…',
  'Checking for missing details…',
  'Preparing your shipment review…',
] as const;
export const DELIVERY_NOTE_WRAPPING_UP = 'Wrapping up…';

/** Advance once through the messages, then hold wrapping-up until disposed. */
export function startDeliveryNoteReading(onStage: (index: number) => void) {
  let index = 0;
  let active = true;
  let timer: ReturnType<typeof setTimeout>;
  const advance = () => {
    if (!active) return;
    index += 1;
    onStage(index);
    if (index < DELIVERY_NOTE_READING_STAGES.length) {
      timer = setTimeout(advance, DELIVERY_NOTE_READING_INTERVAL_MS);
    }
  };
  timer = setTimeout(advance, DELIVERY_NOTE_READING_INTERVAL_MS);
  return () => { active = false; clearTimeout(timer); };
}
