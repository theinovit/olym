const URL_WITH_USERINFO = /\b(https?:\/\/)([^/\s@]+)@/gi;
const SECRET_ENV_NAME = /(token|secret|password|passwd|api_?key|private_?key)/i;

function redactUrlUserinfo(value: string): string {
  return value.replace(URL_WITH_USERINFO, (_match, protocol: string, userinfo: string) => {
    const separator = userinfo.indexOf(":");
    if (separator < 0) return `${protocol}***@`;
    const username = userinfo.slice(0, separator);
    return `${protocol}${username}:***@`;
  });
}

export function redactSecrets(value: string): string {
  let redacted = redactUrlUserinfo(value);
  for (const [name, secret] of Object.entries(process.env)) {
    if (!SECRET_ENV_NAME.test(name) || !secret || secret.length < 4) continue;
    redacted = redacted.replaceAll(secret, "***");
  }
  return redacted;
}
