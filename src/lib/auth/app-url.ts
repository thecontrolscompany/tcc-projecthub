export function getProjectHubAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/+$/, '');
  }

  return (
    configuredUrl ??
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://internal.thecontrolscompany.com')
  );
}
