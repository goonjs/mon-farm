import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The web HTML shell. Static-rendered at export time, so this runs in Node and
 * never in the browser.
 *
 * The height rule matters more than it looks: without it the root element is
 * only as tall as its content, so the counter stage — which sizes the public
 * numeral as a fraction of its own height — collapses. The numeral would then
 * be sized against nothing, which is the failure the whole §4 constraint exists
 * to prevent.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Landscape phone, and a count that must not be rescaled by the browser
            or pinched by accident mid-sale. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <title>mon-farm</title>

        {/* Resets react-native-web's ScrollView so it scrolls the container
            rather than the document body. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: BODY_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BODY_CSS = `
html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
}
body {
  overflow: hidden;
  overscroll-behavior: none;
  /* A long-press on the stage must not raise the text-selection callout or the
     iOS magnifier -- the hold is a three-second press, which is exactly the
     gesture those are looking for. */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
`;
