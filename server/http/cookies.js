export function readCookie(request, name) {
  const header = request.header('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [key, ...valueParts] = part.trim().split('=');
    if (key === name) return decodeURIComponent(valueParts.join('='));
  }
  return null;
}

export function sessionCookie(name, value, config, maxAgeSeconds) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (config.secureCookies) attributes.push('Secure');
  return attributes.join('; ');
}
