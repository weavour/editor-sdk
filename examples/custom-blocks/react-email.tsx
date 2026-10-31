import { defineCustomBlock } from '@weavour/editor';
import { Section, Text, Button } from '@react-email/components';
import { render } from '@react-email/render';

export const productCard = defineCustomBlock({
  id: 'product-card', version: 1, label: 'Product card',
  defaultProps: { title: 'New product', href: 'https://example.com/product' },
  controls: {
    title: { type: 'text', label: 'Product name', required: true },
    href: { type: 'url', label: 'Product link' },
  },
  async render(props) {
    const html = await render(
      <Section><Text>{props.title}</Text>
        <Button href={props.href} style={{ padding: '12px 24px' }}>View product</Button>
      </Section>
    );
    // React Email adds a doctype even when rendering a body fragment.
    return html.replace(/^<!doctype[^>]*>/i, '');
  },
});
// <WeavourEditor {...identity} customBlocks={[productCard]} />
