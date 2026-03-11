import DeviceDetector from 'node-device-detector';
import geoip from 'geoip-lite';
import { Request } from 'express';

// Configuración recomendada según documentación
const detector = new DeviceDetector({
  clientIndexes: true,
  deviceIndexes: true,
  osIndexes: true,
  deviceAliasCode: false,
});

export interface DeviceInfo {
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  device_brand: string | null;
  device_model: string | null;
  os_name: string | null;
  os_version: string | null;
  client_name: string | null;
  client_version: string | null;
  location_country: string | null;
  location_region: string | null;
  location_city: string | null;
}

export function getDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.headers['user-agent'] || '';
  const result = detector.detect(userAgent);
  
  // Obtener IP priorizando x-forwarded-for (proxies/balanceadores)
  let ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  
  // Si hay múltiples IPs en x-forwarded-for, la primera es la del cliente real
  if (ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  // Normalizar IP para geoip-lite
  let lookupIp = ip;
  // Manejar formato IPv6-mapped IPv4 (ej: ::ffff:192.168.1.1)
  if (lookupIp.startsWith('::ffff:')) {
    lookupIp = lookupIp.substring(7);
  }

  const geo = geoip.lookup(lookupIp);

  // Determinar valores de ubicación
  let locationCountry = geo?.country || null;
  let locationRegion = geo?.region || null;
  let locationCity = geo?.city || null;

  // Si no hay geo-data y es una IP local conocida, marcamos como Local para evitar nulls confusos en dev
  if (!geo) {
    if (lookupIp === '127.0.0.1' || lookupIp === '::1' || lookupIp.startsWith('192.168.') || lookupIp.startsWith('10.')) {
      locationCountry = 'Local';
      locationRegion = 'Private Network';
      locationCity = 'Localhost';
    }
  }

  return {
    ip_address: ip.substring(0, 45) || null, // Guardamos la IP original (puede ser IPv6)
    user_agent: userAgent || null,
    device_type: result.device.type || null,
    device_brand: result.device.brand || null,
    device_model: result.device.model || null,
    os_name: result.os.name || null,
    os_version: result.os.version || null,
    client_name: result.client.name || null,
    client_version: result.client.version || null,
    location_country: locationCountry,
    location_region: locationRegion,
    location_city: locationCity,
  };
}
