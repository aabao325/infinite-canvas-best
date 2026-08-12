import i18n from "@/i18n";
import type { ReferenceImage } from "@/types/image";

export function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "";
    }
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDuration(ms: number) {
    const value = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(value / 60);
    const seconds = value % 60;
    return minutes ? i18n.t("common.durationMinutes", { minutes, seconds: String(seconds).padStart(2, "0") }) : i18n.t("common.durationSeconds", { seconds });
}

export function getDataUrlByteSize(dataUrl: string) {
    const base64 = dataUrl.split(",", 2)[1];
    if (!base64) {
        return 0;
    }
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error(i18n.t("common.imageReadFailed")));
        reader.readAsDataURL(file);
    });
}

export function readImageMeta(dataUrl: string) {
    return new Promise<{ width: number; height: number; mimeType: string }>((resolve) => {
        const image = new Image();
        const done = () => resolve({ width: image.naturalWidth || 1024, height: image.naturalHeight || 1024, mimeType: dataUrl.match(/^data:([^;]+)/)?.[1] || "image/png" });
        image.onload = done;
        image.onerror = done;
        setTimeout(done, 3000);
        image.src = dataUrl;
    });
}

/**
 * Measure a cross-origin image through an `<img>` tag. Display is not gated by CORS, so this works
 * for provider CDN links whose bytes `fetch` cannot read. Rejects on a genuinely broken URL so a dead
 * link still surfaces as a failure instead of becoming a placeholder-sized node.
 */
export function readRemoteImageMeta(url: string) {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        const fail = () => {
            clearTimeout(timer);
            reject(new Error(i18n.t("common.imageReadFailed")));
        };
        image.onload = () => {
            clearTimeout(timer);
            if (!image.naturalWidth || !image.naturalHeight) return fail();
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
        };
        image.onerror = fail;
        const timer = setTimeout(fail, 15000);
        image.src = url;
    });
}

/** Best-effort MIME type from a URL path; signed CDN links keep their extension ahead of the query string. */
export function urlImageMimeType(url: string) {
    const extension = url.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() || "";
    if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
    if (extension === "webp" || extension === "gif" || extension === "avif" || extension === "bmp") return `image/${extension}`;
    return "image/png";
}

export function dataUrlToFile(image: ReferenceImage) {
    // Splitting a plain link here would silently yield an empty file, so reject it outright.
    if (!image.dataUrl.startsWith("data:")) throw new Error(i18n.t("apiErrors.remoteReferenceUnsupported"));
    const [header, content] = image.dataUrl.split(",", 2);
    const mimeType = header.match(/data:(.*?);base64/)?.[1] || image.type || "image/png";
    const binary = atob(content || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], image.name || "reference.png", { type: mimeType });
}
