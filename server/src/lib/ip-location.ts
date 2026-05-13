export interface IpLocation {
  lat: number;
  lng: number;
  accuracy: "ip";
}

interface IpWhoResponse {
  success?: boolean;
  latitude?: number;
  longitude?: number;
  message?: string;
}

interface GeoJsResponse {
  latitude?: string;
  longitude?: string;
}

interface IpApiCoResponse {
  latitude?: number;
  longitude?: number;
  error?: boolean;
  reason?: string;
}

interface IpInfoResponse {
  loc?: string;
}

export async function detectLocationFromIp(ip: string | undefined): Promise<IpLocation> {
  const publicIp = getPublicIp(ip);
  const urls = publicIp
    ? [
        `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(publicIp)}.json`,
        `https://ipinfo.io/${encodeURIComponent(publicIp)}/json`,
        `https://ipapi.co/${encodeURIComponent(publicIp)}/json/`,
        `https://ipwho.is/${encodeURIComponent(publicIp)}`
      ]
    : [
        "https://get.geojs.io/v1/ip/geo.json",
        "https://ipinfo.io/json",
        "https://ipapi.co/json/",
        "https://ipwho.is/"
      ];

  for (const url of urls) {
    try {
      const location = await fetchLocation(url);
      if (location) return location;
    } catch {
      // Try the next provider.
    }
  }

  throw new Error("Unable to determine location from IP address.");
}

async function fetchLocation(url: string): Promise<IpLocation | null> {
  if (url.includes("get.geojs.io")) return fetchGeoJsLocation(url);
  if (url.includes("ipinfo.io")) return fetchIpInfoLocation(url);
  if (url.includes("ipapi.co")) return fetchIpApiCoLocation(url);
  return fetchIpWhoLocation(url);
}

async function fetchGeoJsLocation(url: string): Promise<IpLocation | null> {
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as GeoJsResponse;
  return toLocation(Number(data.latitude), Number(data.longitude));
}

async function fetchIpInfoLocation(url: string): Promise<IpLocation | null> {
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as IpInfoResponse;
  const [lat, lng] = data.loc?.split(",") ?? [];
  return toLocation(Number(lat), Number(lng));
}

async function fetchIpWhoLocation(url: string): Promise<IpLocation | null> {
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as IpWhoResponse;
  if (data.success === false) return null;
  return toLocation(data.latitude, data.longitude);
}

async function fetchIpApiCoLocation(url: string): Promise<IpLocation | null> {
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as IpApiCoResponse;
  if (data.error) return null;
  return toLocation(data.latitude, data.longitude);
}

function toLocation(lat: number | undefined, lng: number | undefined): IpLocation | null {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng, accuracy: "ip" };
}

function getPublicIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;

  const firstIp = ip.split(",")[0]?.trim().replace(/^::ffff:/, "");
  if (!firstIp || isPrivateIp(firstIp)) return undefined;
  return firstIp;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("fe80:")
  );
}
