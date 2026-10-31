import { parseDocument } from 'htmlparser2';

const number = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const geometry = new Set('svg g path rect circle ellipse line polyline polygon'.split(' '));
const numeric = new Set('x y width height rx ry cx cy r x1 y1 x2 y2 stroke-width opacity fill-opacity stroke-opacity'.split(' '));
const escape = (value: string) => value.replace(/[&"<>]/g, char => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[char]!));
function invalid(): never { throw new Error('invalid_custom_icon_svg'); }

/** Static, bounded geometry only. Palette icons always follow the chrome foreground. */
export function validateCustomBlockIcon(source: unknown): string {
  if (typeof source !== 'string' || !source.trim() || new TextEncoder().encode(source).length > 16384) invalid();
  const tree = parseDocument(source, { xmlMode: true, decodeEntities: true });
  const roots = tree.children.filter(node => node.type !== 'text' || node.data.trim());
  if (roots.length !== 1 || (roots[0] as any).name !== 'svg') invalid();
  let count = 0;
  const draw = (node: any, depth: number): string => {
    if (node.type === 'text' && !node.data.trim()) return '';
    if (node.type !== 'tag' || !geometry.has(node.name) || depth > 12 || ++count > 128 || depth > 0 && node.name === 'svg') invalid();
    const attributes: string[] = [];
    for (const [key, raw] of Object.entries(node.attribs)) {
      const value = raw as string;
      let output = value;
      if (key === 'xmlns' && depth === 0) { if (value !== 'http://www.w3.org/2000/svg') invalid(); continue; }
      if (key === 'viewBox' && depth === 0) {
        const values = value.trim().split(/[\s,]+/);
        if (values.length !== 4 || values.some(part => !number.test(part) || !Number.isFinite(+part) || Math.abs(+part) > 1e6) || +values[2] <= 0 || +values[3] <= 0) invalid();
      } else if (numeric.has(key)) {
        if (!number.test(value) || !Number.isFinite(+value) || Math.abs(+value) > 1e6) invalid();
        if (depth === 0 && (key === 'width' || key === 'height')) continue;
      } else if (key === 'd' && node.name === 'path') {
        if (!value.trim() || !/^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]+$/.test(value)) invalid();
      } else if (key === 'points' && ['polyline', 'polygon'].includes(node.name)) {
        if (!value.trim() || !/^[\d\s.,eE+-]+$/.test(value)) invalid();
      } else if (key === 'transform') {
        if (!/^(?:\s*(?:matrix|translate|scale|rotate|skewX|skewY)\([\d\s.,eE+-]+\)\s*)+$/.test(value)) invalid();
      } else if (key === 'fill' || key === 'stroke') {
        if (!/^(?:none|currentColor|#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d\s.,%]+\))$/i.test(value)) invalid();
        output = value.toLowerCase() === 'none' ? 'none' : 'currentColor';
      } else if (key === 'stroke-linecap') { if (!['butt', 'round', 'square'].includes(value)) invalid(); }
      else if (key === 'stroke-linejoin') { if (!['miter', 'round', 'bevel'].includes(value)) invalid(); }
      else if (key === 'fill-rule' || key === 'clip-rule') { if (!['nonzero', 'evenodd'].includes(value)) invalid(); }
      else invalid();
      attributes.push(`${key}="${escape(output)}"`);
    }
    if (depth === 0) {
      if (!Object.hasOwn(node.attribs, 'viewBox')) invalid();
      if (!Object.hasOwn(node.attribs, 'fill')) attributes.push('fill="currentColor"');
    }
    return `<${node.name}${attributes.length ? ' ' + attributes.join(' ') : ''}>${node.children.map((child: any) => draw(child, depth + 1)).join('')}</${node.name}>`;
  };
  return draw(roots[0], 0);
}
