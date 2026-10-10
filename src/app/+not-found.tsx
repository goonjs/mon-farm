import { Redirect, type Href } from 'expo-router';

/**
 * Any path no route matches — old v1 links and bookmarks such as `/settings`
 * or `/sale/<id>/counter` — goes to the v2 home instead of expo-router's
 * "Unmatched Route" page (D-83: v2 is the app).
 */
export default function NotFound() {
  return <Redirect href={'/v2' as Href} />;
}
