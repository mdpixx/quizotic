// Tier classification for Indian cities used in lead scoring + city quotas.
// Tier 1 = metro/high-spend; Tier 2 = strong digital adoption; Tier 3 = emerging.

const TIER_1 = new Set([
  'mumbai', 'delhi', 'new delhi', 'gurgaon', 'gurugram', 'noida', 'greater noida',
  'faridabad', 'ghaziabad', 'bangalore', 'bengaluru', 'hyderabad', 'secunderabad',
  'chennai', 'pune', 'kolkata', 'ahmedabad', 'surat'
]);

const TIER_2 = new Set([
  'indore', 'jaipur', 'lucknow', 'bhopal', 'coimbatore', 'chandigarh', 'mohali',
  'panchkula', 'nagpur', 'visakhapatnam', 'vizag', 'vadodara', 'baroda', 'kochi',
  'cochin', 'thiruvananthapuram', 'trivandrum', 'mysore', 'mysuru', 'mangalore',
  'mangaluru', 'thane', 'navi mumbai', 'nashik', 'nasik', 'aurangabad', 'rajkot',
  'gandhinagar', 'dehradun', 'patna', 'ranchi', 'bhubaneswar', 'cuttack',
  'guwahati', 'agra', 'kanpur', 'varanasi', 'allahabad', 'prayagraj', 'meerut',
  'jodhpur', 'udaipur', 'amritsar', 'ludhiana', 'jalandhar', 'shimla',
  'jammu', 'srinagar', 'raipur', 'jabalpur', 'gwalior', 'madurai', 'tiruchirappalli',
  'trichy', 'salem', 'vijayawada', 'guntur', 'tirupati', 'warangal'
]);

export function cityTier(cityRaw) {
  if (!cityRaw) return 'x';
  const c = String(cityRaw).toLowerCase().trim();
  if (TIER_1.has(c)) return 1;
  if (TIER_2.has(c)) return 2;
  // Try suffix match (e.g. "South Delhi" → Delhi)
  for (const t1 of TIER_1) if (c.includes(t1)) return 1;
  for (const t2 of TIER_2) if (c.includes(t2)) return 2;
  return 3;
}

// Target cities for Maps fallback scrape, with desired quota per city.
// Sums to ~500; scraper aims for 2-3x to leave room for filtering.
export const CITY_QUOTAS = [
  // Delhi NCR (100)
  { city: 'New Delhi', state: 'Delhi', quota: 35 },
  { city: 'Gurgaon', state: 'Haryana', quota: 20 },
  { city: 'Noida', state: 'Uttar Pradesh', quota: 20 },
  { city: 'Faridabad', state: 'Haryana', quota: 15 },
  { city: 'Ghaziabad', state: 'Uttar Pradesh', quota: 10 },
  // Mumbai + Pune (80)
  { city: 'Mumbai', state: 'Maharashtra', quota: 50 },
  { city: 'Pune', state: 'Maharashtra', quota: 30 },
  // Bangalore + Hyderabad + Chennai (100)
  { city: 'Bangalore', state: 'Karnataka', quota: 35 },
  { city: 'Hyderabad', state: 'Telangana', quota: 35 },
  { city: 'Chennai', state: 'Tamil Nadu', quota: 30 },
  // Kolkata + Ahmedabad + Surat (50)
  { city: 'Kolkata', state: 'West Bengal', quota: 25 },
  { city: 'Ahmedabad', state: 'Gujarat', quota: 15 },
  { city: 'Surat', state: 'Gujarat', quota: 10 },
  // Tier-2 mix (170)
  { city: 'Indore', state: 'Madhya Pradesh', quota: 18 },
  { city: 'Jaipur', state: 'Rajasthan', quota: 18 },
  { city: 'Lucknow', state: 'Uttar Pradesh', quota: 18 },
  { city: 'Bhopal', state: 'Madhya Pradesh', quota: 15 },
  { city: 'Coimbatore', state: 'Tamil Nadu', quota: 15 },
  { city: 'Chandigarh', state: 'Chandigarh', quota: 15 },
  { city: 'Nagpur', state: 'Maharashtra', quota: 15 },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh', quota: 14 },
  { city: 'Vadodara', state: 'Gujarat', quota: 14 },
  { city: 'Kochi', state: 'Kerala', quota: 14 },
  { city: 'Dehradun', state: 'Uttarakhand', quota: 14 }
];
