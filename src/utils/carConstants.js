// ─── Car Brand & Model Constants ──────────────────────────────────────────
// Single source of truth for predefined car brands and models
// Custom brands/models are fetched from Supabase tables and merged with these

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
