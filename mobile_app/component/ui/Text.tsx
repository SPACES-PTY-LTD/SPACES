import { forwardRef, type ElementRef } from 'react';
import { Text as RNText, type TextProps } from 'react-native';

type Props = TextProps & {
  className?: string;
};

export const Text = forwardRef<ElementRef<typeof RNText>, Props>(function Text({ className, ...props }, ref) {
  const mergedClassName = ['text-foreground ', className].filter(Boolean).join(' ');

  return <RNText ref={ref} className={mergedClassName} {...props} />;
});
