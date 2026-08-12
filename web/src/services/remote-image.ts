import i18n from "@/i18n";

import { IMAGE_PROXY_URL } from "@/constant/runtime-config";

const PROXY_PLACEHOLDER = "{url}";

export function isRemoteHttpUrl(url: string) {
    return /^https?:\/\//i.test(url);
}

/** Build the proxy request for a cross-origin asset. Only the operator-configured proxy is ever used. */
function proxyUrl(url: string) {
    if (!IMAGE_PROXY_URL) return "";
    if (IMAGE_PROXY_URL.includes(PROXY_PLACEHOLDER)) return IMAGE_PROXY_URL.replace(PROXY_PLACEHOLDER, encodeURIComponent(url));
    return `${IMAGE_PROXY_URL}${IMAGE_PROXY_URL.includes("?") ? "&" : "?"}url=${encodeURIComponent(url)}`;
}

async function fetchBlob(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(i18n.t("common.imageFetchFailed", { status: response.status }));
    const blob = await response.blob();
    // A CDN or misconfigured proxy can answer 200 with an XML/HTML error page. Storing that would leave a
    // broken node behind, so reject the obvious non-image types and let the caller fall back.
    if (/^(?:text\/|application\/(?:xml|json))/i.test(blob.type)) throw new Error(i18n.t("common.imageReadFailed"));
    return blob;
}

/**
 * Read an image's bytes. Providers such as Ark hand back signed CDN links that carry no
 * `Access-Control-Allow-Origin`, so the direct read is attempted first and the optional
 * operator-hosted proxy is only a fallback — no third-party service is ever contacted.
 */
export async function fetchImageBlob(url: string) {
    if (!isRemoteHttpUrl(url)) return fetchBlob(url);
    try {
        return await fetchBlob(url);
    } catch (error) {
        const proxy = proxyUrl(url);
        if (!proxy) throw error;
        return fetchBlob(proxy);
    }
}
