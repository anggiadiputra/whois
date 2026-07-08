/**
 * Parse RDAP JSON response into frontend-compatible WhoisResult object
 * @param {object} rdap 
 * @param {string} domain 
 * @returns {object} WhoisResult
 */
export function parseRdap(rdap, domain) {
  const whoisResult = {
    domain: domain.toLowerCase(),
    handle: rdap.handle || null,
    status: rdap.status || [],
    registrar: null,
    registrarId: null,
    registrarEmail: null,
    registrarPhone: null,
    abuseEmail: null,
    abusePhone: null,
    createdDate: null,
    updatedDate: null,
    expiryDate: null,
    databaseLastUpdate: null,
    nameservers: [],
    dnssec: rdap.secureDNS?.delegationSigned ? 'Signed / Active' : 'Unsigned / Inactive',
    rawData: rdap
  };

  // Extract nameservers
  if (Array.isArray(rdap.nameservers)) {
    whoisResult.nameservers = rdap.nameservers
      .map(ns => ns.ldhName?.toLowerCase())
      .filter(Boolean);
  }

  // Helper to find an entity by its role recursively
  const findEntityByRole = (entitiesList, role) => {
    if (!Array.isArray(entitiesList)) return null;
    for (const ent of entitiesList) {
      if (Array.isArray(ent.roles) && ent.roles.includes(role)) {
        return ent;
      }
      if (Array.isArray(ent.entities)) {
        const found = findEntityByRole(ent.entities, role);
        if (found) return found;
      }
    }
    return null;
  };

  // Find abuse details recursively
  const abuseEntity = findEntityByRole(rdap.entities, 'abuse');
  if (abuseEntity && Array.isArray(abuseEntity.vcardArray) && abuseEntity.vcardArray[1]) {
    const emailItem = abuseEntity.vcardArray[1].find(item => item[0] === 'email');
    if (emailItem && emailItem[3]) whoisResult.abuseEmail = emailItem[3];

    const telItem = abuseEntity.vcardArray[1].find(item => item[0] === 'tel');
    if (telItem && telItem[3]) whoisResult.abusePhone = telItem[3].replace(/^tel:/i, '');
  }

  // Extract registrar from entities recursively
  const registrarEntity = findEntityByRole(rdap.entities, 'registrar');
  if (registrarEntity) {
    // Formatted name, email, phone
    if (Array.isArray(registrarEntity.vcardArray) && registrarEntity.vcardArray[1]) {
      const fnItem = registrarEntity.vcardArray[1].find(item => item[0] === 'fn');
      if (fnItem && fnItem[3]) {
        whoisResult.registrar = fnItem[3];
      }

      const emailItem = registrarEntity.vcardArray[1].find(item => item[0] === 'email');
      if (emailItem && emailItem[3]) {
        whoisResult.registrarEmail = emailItem[3];
      }

      const telItem = registrarEntity.vcardArray[1].find(item => item[0] === 'tel');
      if (telItem && telItem[3]) {
        whoisResult.registrarPhone = telItem[3].replace(/^tel:/i, '');
      }
    }
    // IANA Registrar ID
    if (Array.isArray(registrarEntity.publicIds)) {
      const ianaId = registrarEntity.publicIds.find(p => p.type === 'IANA Registrar ID');
      if (ianaId) {
        whoisResult.registrarId = ianaId.identifier;
      }
    }
  }

  // Extract registrant from entities recursively
  const registrantEntity = findEntityByRole(rdap.entities, 'registrant');
  if (registrantEntity && Array.isArray(registrantEntity.vcardArray) && registrantEntity.vcardArray[1]) {
    const fnItem = registrantEntity.vcardArray[1].find(item => item[0] === 'fn');
    if (fnItem && fnItem[3]) {
      whoisResult.registrantName = fnItem[3];
    }

    const emailItem = registrantEntity.vcardArray[1].find(item => item[0] === 'email');
    if (emailItem && emailItem[3]) {
      whoisResult.registrantEmail = emailItem[3];
    }

    const telItem = registrantEntity.vcardArray[1].find(item => item[0] === 'tel');
    if (telItem && telItem[3]) {
      whoisResult.registrantPhone = telItem[3].replace(/^tel:/i, '');
    }
  }

  // Extract events (registration date, expiration, updates, DB last update)
  if (Array.isArray(rdap.events)) {
    for (const event of rdap.events) {
      if (event.eventAction === 'registration') {
        whoisResult.createdDate = event.eventDate;
      } else if (event.eventAction === 'expiration') {
        whoisResult.expiryDate = event.eventDate;
      } else if (event.eventAction === 'last changed') {
        whoisResult.updatedDate = event.eventDate;
      } else if (event.eventAction === 'last update of RDAP database') {
        whoisResult.databaseLastUpdate = event.eventDate;
      }
    }
  }

  return whoisResult;
}

export function getRootDomain(domain) {
  const parts = domain.split('.');
  if (parts.length <= 2) return domain;
  const doubleTlds = new Set([
    'com.id', 'net.id', 'co.id', 'web.id', 'sch.id', 'or.id', 'go.id', 'ac.id', 'my.id',
    'co.uk', 'me.uk', 'org.uk', 'ltd.uk', 'plc.uk',
    'com.au', 'net.au', 'org.au',
    'com.sg', 'net.sg', 'org.sg',
    'com.my', 'net.my', 'org.my',
    'co.jp', 'org.jp', 'ad.jp', 'ne.jp',
    'com.br', 'net.br', 'org.br'
  ]);
  const lastTwo = parts.slice(-2).join('.');
  if (doubleTlds.has(lastTwo)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Fetches domain registration info using standard RDAP protocol bootstrap
 * @param {string} domain 
 * @returns {Promise<object>} WhoisResult
 */
export async function scrapeWhois(domain) {
  let cleanDomain = domain.trim().toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('/')[0];
  cleanDomain = getRootDomain(cleanDomain);
  if (!cleanDomain) {
    throw new Error('Invalid domain name provided');
  }

  const rdapUrl = `https://rdap.org/domain/${cleanDomain}`;
  console.log(`[RDAP] Querying: ${rdapUrl}`);

  try {
    const response = await fetch(rdapUrl, {
      headers: {
        'Accept': 'application/rdap+json, application/json'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (response.status === 404) {
      throw new Error(`Domain "${cleanDomain}" is not registered or no RDAP data is available.`);
    }

    if (!response.ok) {
      throw new Error(`RDAP query failed with status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return parseRdap(data, cleanDomain);
  } catch (error) {
    console.error(`[RDAP] Error querying domain ${cleanDomain}:`, error.message);
    throw error;
  }
}
