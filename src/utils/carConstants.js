export const MAKES = ["Maruti","Hyundai","Tata","Honda","Kia","Toyota","Renault","Nissan","MG","Skoda","Volkswagen","Ford","Chevrolet","Mahindra","Other"];

export const MODELS_BY_MAKE = {
  Maruti:["Swift","Alto","Baleno","Dzire","Vitara Brezza","Ertiga","WagonR","Celerio","Ignis","S-Cross","XL6"],
  Hyundai:["i20","Creta","Verna","Grand i10","Venue","Tucson","Santro","Aura","Alcazar","i10"],
  Tata:["Nexon","Altroz","Harrier","Safari","Tiago","Tigor","Punch","Indica"],
  Honda:["City","Amaze","Jazz","WR-V","BR-V","Civic","CR-V"],
  Kia:["Seltos","Sonet","Carnival","Carens"],
  Toyota:["Innova","Fortuner","Glanza","Urban Cruiser","Camry","Corolla"],
  Renault:["Kwid","Triber","Duster","Kiger"],
  Nissan:["Magnite","Kicks","Micra","Terrano"],
  MG:["Hector","Astor","ZS EV","Gloster"],
  Skoda:["Rapid","Kushaq","Slavia","Octavia","Superb"],
  Volkswagen:["Polo","Vento","Taigun","Virtus","Tiguan"],
  Ford:["Figo","Aspire","EcoSport","Endeavour","Freestyle"],
  Chevrolet:["Beat","Cruze","Spark","Enjoy"],
  Mahindra:["XUV300","XUV500","XUV700","Scorpio","Bolero","Thar","KUV100"],
  Other:[],
};

export const COLORS = ["White","Silver","Grey","Black","Red","Blue","Brown","Beige","Orange","Other"];
export const YEARS = Array.from({length:22},(_,i)=>new Date().getFullYear()-i);
export const LEAD_STATUSES = ["Pending","Deal Done","Cancelled","No Deal"];

// Fuzzy match RTO maker name to our MAKES list
/**
 * @param {string} rtoMakerName
 */
export function fuzzyMatchMake(rtoMakerName) {
  if (!rtoMakerName) return '';
  const upper = rtoMakerName.toUpperCase();
  const map = {
    'MARUTI': 'Maruti', 'SUZUKI': 'Maruti',
    'HYUNDAI': 'Hyundai',
    'TATA': 'Tata',
    'HONDA': 'Honda',
    'KIA': 'Kia',
    'TOYOTA': 'Toyota',
    'RENAULT': 'Renault',
    'NISSAN': 'Nissan',
    'MG': 'MG', 'MORRIS': 'MG',
    'SKODA': 'Skoda',
    'VOLKSWAGEN': 'Volkswagen', 'VW': 'Volkswagen',
    'FORD': 'Ford',
    'CHEVROLET': 'Chevrolet', 'CHEVY': 'Chevrolet',
    'MAHINDRA': 'Mahindra',
  };
  for (const [key, val] of Object.entries(map)) {
    if (upper.includes(key)) return val;
  }
  // Return original as manual fallback
  return rtoMakerName;
}

// Normalize RTO fuel type to our values
/**
 * @param {string} rtoFuel
 */
export function normalizeFuel(rtoFuel) {
  if (!rtoFuel) return '';
  const u = rtoFuel.toUpperCase();
  if (u.includes('PETROL') || u.includes('GASOLINE')) return 'Petrol';
  if (u.includes('DIESEL')) return 'Diesel';
  if (u.includes('CNG') || u.includes('GAS')) return 'CNG';
  if (u.includes('ELECTRIC') || u.includes('EV')) return 'Electric';
  if (u.includes('HYBRID')) return 'Hybrid';
  return rtoFuel;
}

// Normalize RTO color to our values
/**
 * @param {string} rtoColor
 */
export function normalizeColor(rtoColor) {
  if (!rtoColor) return '';
  const u = rtoColor.toUpperCase();
  const map = {
    'WHITE': 'White', 'SILVER': 'Silver', 'GREY': 'Grey', 'GRAY': 'Grey',
    'BLACK': 'Black', 'RED': 'Red', 'BLUE': 'Blue', 'BROWN': 'Brown',
    'BEIGE': 'Beige', 'ORANGE': 'Orange',
  };
  for (const [key, val] of Object.entries(map)) {
    if (u.includes(key)) return val;
  }
  return rtoColor;
}