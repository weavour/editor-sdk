export type EditorTheme = {
  mode?: 'light' | 'dark';
  primaryColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  shellColor?: string;
  inputColor?: string;
  textColor?: string;
  mutedColor?: string;
  borderColor?: string;
  cornerRadius?: number;
  density?: 'comfortable' | 'compact';
  fontFamily?: string;
};

export function resolveEditorTheme(input: EditorTheme = {}): Required<EditorTheme> {
  const dark = input.mode === 'dark';
  const theme: Required<EditorTheme> = {
    mode: dark ? 'dark' : 'light',
    primaryColor: dark ? '#9c90ff' : '#6351ce',
    backgroundColor: dark ? '#111827' : '#f7f8fc',
    surfaceColor: dark ? '#1b2232' : '#ffffff',
    shellColor: dark ? '#1b2232' : '#ffffff',
    inputColor: dark ? '#1b2232' : '#ffffff',
    textColor: dark ? '#e9edf5' : '#111827',
    mutedColor: dark ? '#a6b1c6' : '#56657b',
    borderColor: dark ? '#2c3750' : '#dce1eb',
    cornerRadius: 8, density: 'comfortable', fontFamily: 'Inter',
  };
  for (const key of ['primaryColor', 'backgroundColor', 'surfaceColor', 'shellColor', 'inputColor', 'textColor', 'mutedColor', 'borderColor'] as const) {
    const value = input[key];
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) theme[key] = value;
  }
  if (!/^#[0-9a-f]{6}$/i.test(input.shellColor ?? '')) theme.shellColor = theme.surfaceColor;
  if (!/^#[0-9a-f]{6}$/i.test(input.inputColor ?? '')) theme.inputColor = theme.surfaceColor;
  if (typeof input.cornerRadius === 'number' && Number.isFinite(input.cornerRadius)) {
    theme.cornerRadius = Math.max(0, Math.min(24, input.cornerRadius));
  }
  if (input.density === 'compact') theme.density = 'compact';
  if (typeof input.fontFamily === 'string' && /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,99}$/u.test(input.fontFamily)) theme.fontFamily = input.fontFamily;
  return theme;
}

function luminance(color: string) {
  const channels = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

export function colorContrast(first: string, second: string) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function readableForeground(background: string) {
  if (colorContrast(background, '#111111') >= 4.5 && colorContrast(background, '#111111') >= colorContrast(background, '#ffffff')) return '#111111';
  return colorContrast(background, '#000000') > colorContrast(background, '#ffffff') ? '#000000' : '#ffffff';
}

function mixColor(background: string, foreground: string, amount: number) {
  return '#' + [1, 3, 5].map(start => Math.round(
    parseInt(background.slice(start, start + 2), 16) * (1 - amount) + parseInt(foreground.slice(start, start + 2), 16) * amount,
  ).toString(16).padStart(2, '0')).join('');
}

function readableColor(backgrounds: string[], candidate: string | undefined, fallback: string, minimum = 4.5) {
  const passes = (color: string) => backgrounds.every(background => colorContrast(background, color) >= minimum);
  const seed = candidate && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
  if (passes(seed)) return seed;
  for (let step = 1; step <= 100; step++) {
    const color = mixColor(seed, fallback, step / 100);
    if (passes(color)) return color;
  }
  return fallback;
}

// Clamp state backgrounds before resolving supporting colors. This preserves
// the same readable foreground through hover and selection, including midtones.
function stateBackground(background: string, target: string, text: string) {
  for (let step = 100; step >= 0; step--) {
    const color = mixColor(background, target, step / 100);
    if (colorContrast(color, text) >= 4.5) return color;
  }
  return background;
}

export function editorSurfacePalette(background: string, theme: EditorTheme) {
  const foreground = readableForeground(background);
  const text = theme.textColor && /^#[0-9a-f]{6}$/i.test(theme.textColor) && colorContrast(background, theme.textColor) >= 4.5 ? theme.textColor : foreground;
  const hover = stateBackground(background, luminance(background) > 0.7
    ? mixColor(background, '#000000', 0.04) : mixColor(background, '#ffffff', 0.08), text);
  const selected = stateBackground(background, mixColor(background, foreground, 0.04), text);
  const states = [background, hover, selected];
  const muted = readableColor(states, theme.mutedColor ?? mixColor(background, text, 0.65), text);
  const danger = readableColor(states, '#b93845', states.every(color => colorContrast(color, '#ffffff') >= 4.5) ? '#ffffff' : '#000000');
  const focus = readableColor(states, theme.primaryColor, text, 3);
  const border = readableColor([background], mixColor(background, foreground, 0.3), foreground, 3);
  const accessory = mixColor(background, '#000000', 0.08);
  const accessoryText = readableColor([accessory], text, readableForeground(accessory));
  return {
    text, muted, danger, focus, hover, selected,
    accessory, accessoryText,
    accessoryFocus: readableColor([accessory], theme.primaryColor, accessoryText, 3),
    border: theme.borderColor && /^#[0-9a-f]{6}$/i.test(theme.borderColor) ? theme.borderColor : border,
    colorScheme: luminance(background) < 0.179 ? 'dark' : 'light',
  };
}
