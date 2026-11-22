import assert from 'node:assert/strict';
import { test } from 'node:test';

import { darkColors, lightColors } from './palette';

function luminance(color: string) {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const foregroundLight = luminance(foreground);
  const backgroundLight = luminance(background);
  return (
    (Math.max(foregroundLight, backgroundLight) + 0.05) /
    (Math.min(foregroundLight, backgroundLight) + 0.05)
  );
}

for (const [mode, colors] of [
  ['light', lightColors],
  ['dark', darkColors],
] as const) {
  test(`${mode} theme meets text and control contrast targets`, () => {
    function check(
      foreground: keyof typeof colors,
      background: keyof typeof colors,
      minimum: number,
    ) {
      const ratio = contrast(colors[foreground], colors[background]);
      assert.ok(
        ratio >= minimum,
        `${foreground} on ${background} has contrast ${ratio.toFixed(2)}, expected at least ${minimum}`,
      );
    }

    for (const background of ['background', 'surface'] as const) {
      for (const foreground of [
        'text',
        'muted',
        'accent',
        'danger',
        'success',
      ] as const) {
        check(foreground, background, 4.5);
      }
      check('focus', background, 3);
    }

    check('onPrimary', 'primary', 4.5);
    check('onPrimary', 'primaryPressed', 4.5);
    check('inputBorder', 'surface', 3);
  });
}
