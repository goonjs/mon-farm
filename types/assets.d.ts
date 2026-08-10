/**
 * Metro resolves CSS imports on web; TypeScript needs to be told they exist.
 * Required by template files left in place (src/constants/theme.ts,
 * src/components/animated-icon.web.tsx) -- see s1-tech-stack-and-ci.md for why
 * they are kept rather than deleted.
 */
declare module '*.css';
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
