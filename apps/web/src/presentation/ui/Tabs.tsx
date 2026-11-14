import { Tabs as RadixTabs } from 'radix-ui';
import type { ReactNode } from 'react';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

/** Keyboard-navigable tabs (arrow keys, Home, End) from Radix. */
export function Tabs({
  items,
  value,
  onValueChange,
  label,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onValueChange}>
      <RadixTabs.List
        aria-label={label}
        className="no-print flex gap-1 overflow-x-auto border-b border-border"
      >
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className="min-h-touch shrink-0 border-b-4 border-transparent px-4 text-base font-semibold text-text-muted data-[state=active]:border-primary data-[state=active]:text-text"
          >
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className="pt-5">
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
