import { createElement } from 'react';
export const metadata = { title: 'Weavour Next.js integration' };
export default function Layout({ children }) {
  return createElement('html', { lang: 'en' }, createElement('body', null, children));
}
