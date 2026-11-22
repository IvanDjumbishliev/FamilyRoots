import { Link, type Href } from 'expo-router';
import type { ComponentProps } from 'react';

import { Button } from '@/components/Button';

type Props = Pick<
  ComponentProps<typeof Button>,
  'label' | 'variant' | 'icon'
> & {
  href: Href;
  dismissTo?: boolean;
};

export function ActionLink({ href, dismissTo, ...button }: Props) {
  return (
    <Link href={href} dismissTo={dismissTo} asChild>
      <Button {...button} />
    </Link>
  );
}
