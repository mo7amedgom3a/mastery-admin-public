/** Proxy the admin API through the Pages origin so its HTTP-only cookies stay first-party. */
export async function onRequest({ request, env }) {
  if (!env.API_PROXY_TARGET) {
    return new Response("API_PROXY_TARGET is not configured", { status: 503 });
  }

  let target;
  try {
    target = new URL(env.API_PROXY_TARGET);
    if (!(["http:", "https:"].includes(target.protocol) && target.hostname)) {
      throw new Error("Invalid proxy target");
    }
  } catch {
    return new Response("API_PROXY_TARGET must be an HTTP(S) URL", { status: 503 });
  }

  const clientUrl = new URL(request.url);
  const upstreamUrl = new URL(clientUrl.pathname + clientUrl.search, target);
  const upstreamRequest = new Request(upstreamUrl, request);
  upstreamRequest.headers.delete("host");

  const upstream = await fetch(upstreamRequest, { redirect: "manual" });
  const response = new Response(upstream.body, upstream);

  // Keep framework slash redirects on this origin so cookies continue to be sent.
  const location = response.headers.get("location");
  if (location) {
    const redirectUrl = new URL(location, upstreamUrl);
    if (redirectUrl.origin === target.origin) {
      redirectUrl.protocol = clientUrl.protocol;
      redirectUrl.host = clientUrl.host;
      response.headers.set("location", redirectUrl.toString());
    }
  }

  return response;
}
