export type SavedDomain = {
  id: string;
  user_id: string;
  domain: string;
  whois_data: WhoisResult | null;
  registrar: string | null;
  expiry_date: string | null;
  created_at: string;
};

export type WhoisResult = {
  domain: string;
  handle: string | null;
  status: string[];
  registrar: string | null;
  registrarId: string | null;
  registrarEmail: string | null;
  registrarPhone: string | null;
  abuseEmail: string | null;
  abusePhone: string | null;
  createdDate: string | null;
  updatedDate: string | null;
  expiryDate: string | null;
  databaseLastUpdate: string | null;
  nameservers: string[];
  dnssec: string;
  registrantName?: string | null;
  registrantEmail?: string | null;
  registrantPhone?: string | null;
  rawData: Record<string, unknown>;
};
