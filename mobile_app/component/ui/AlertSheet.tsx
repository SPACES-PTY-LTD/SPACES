import { forwardRef, useImperativeHandle, useRef } from 'react';
import { MessageSheet, type MessageSheetRef } from './MessageSheet';

export type AlertSheetRef = {
  present: (title: string, message: string, onAcknowledge?: () => void | Promise<void>) => void;
};

/** Single-action alert. Acknowledgement runs after the sheet has fully closed.
 * Dismissing through close/backdrop/back does not acknowledge or run the action.
 */
export const AlertSheet = forwardRef<AlertSheetRef>(function AlertSheet(_, ref) {
  const message = useRef<MessageSheetRef>(null);
  useImperativeHandle(ref, () => ({
    present: (title, body, onAcknowledge) => {
      message.current?.present(title, body, [{ text: 'OK', onPress: onAcknowledge }]);
    },
  }), []);
  return <MessageSheet ref={message} />;
});
