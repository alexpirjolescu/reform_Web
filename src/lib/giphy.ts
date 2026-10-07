// GIPHY search results, trimmed to what a message keeps. Client-safe.

export type GifResult = { id: string; url: string; preview: string; width: number; height: number; title: string };

type GiphyImage = { url?: string; webp?: string; width?: string; height?: string };
export type GiphyResponse = {
  data?: { id: string; title?: string; rating?: string; images?: { fixed_width?: GiphyImage; fixed_width_small?: GiphyImage; downsized?: GiphyImage } }[];
};

/** Only GIFs served from GIPHY's own media hosts (the database checks the same). */
export const giphyHost = /^https:\/\/(media[0-9]*|i)\.giphy\.com\//;

export function toGifs(response: GiphyResponse): GifResult[] {
  return (response.data ?? []).flatMap((item) => {
    const full = item.images?.fixed_width;
    const small = item.images?.fixed_width_small ?? full;
    const url = full?.webp ?? full?.url;
    const preview = small?.webp ?? small?.url ?? url;
    if (!url || !preview || !giphyHost.test(url) || !giphyHost.test(preview)) return [];
    if (item.rating && item.rating !== "g") return [];
    return [{ id: item.id, url, preview, width: Number(full?.width) || 200, height: Number(full?.height) || 200, title: (item.title ?? "").slice(0, 120) }];
  });
}
