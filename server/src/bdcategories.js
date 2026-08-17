// Bdjobs.com functional categories, fetched from their category API
// (gateway.bdjobs.com/ActtivejobsTest/api/JobSubsystem/category, Aug 2026).
// CatType 1 = professional fields, CatType 2 = skilled trades.
// The ids feed the bdjobs source's `category=` search param; the labels are
// the Field/Department dropdown options served by GET /api/filters.

export const BD_PROFESSIONAL = [
  { id: 1, label: 'Accounting/Finance' },
  { id: 26, label: 'Agro (Plant/Animal/Fisheries)' },
  { id: 2, label: 'Bank/Non-Bank Fin. Institution' },
  { id: 21, label: 'Beauty Care/Health & Fitness' },
  { id: 27, label: 'Commercial' },
  { id: 28, label: 'Company Secretary/Regulatory affairs' },
  { id: 16, label: 'Customer Service/Call Centre' },
  { id: 15, label: 'Data Entry/Operator/BPO' },
  { id: 18, label: 'Design/Creative' },
  { id: 25, label: 'Driving/Motor Technician' },
  { id: 30, label: 'E-commerce/Digital Marketing' },
  { id: 4, label: 'Education/Training' },
  { id: 23, label: 'Electrician/Construction/Repair' },
  { id: 5, label: 'Engineer/Architect' },
  { id: 6, label: 'Garments/Textile' },
  { id: 7, label: 'General Management/Admin' },
  { id: 11, label: 'Healthcare/Medical' },
  { id: 20, label: 'Hospitality/Travel/Tourism' },
  { id: 17, label: 'HR/Org. Development' },
  { id: 8, label: 'IT/Telecommunication' },
  { id: 22, label: 'Law/Legal' },
  { id: 9, label: 'Marketing/Sales' },
  { id: 10, label: 'Media/Advertisement/Event Mgt.' },
  { id: 12, label: 'NGO/Development' },
  { id: 29, label: 'Pharmaceutical' },
  { id: 19, label: 'Production/Operation' },
  { id: 14, label: 'Receptionist/PS' },
  { id: 13, label: 'Research/Consultancy' },
  { id: 24, label: 'Security/Support Service' },
  { id: 3, label: 'Supply Chain/Procurement' },
];

export const BD_SKILLED = [
  { id: 88, label: 'Beautician/Salon worker' },
  { id: 90, label: 'Boiler Operator' },
  { id: 76, label: 'CAD Operator' },
  { id: 91, label: 'Caregiver/Nanny' },
  { id: 82, label: 'Carpenter' },
  { id: 68, label: 'Chef/Cook' },
  { id: 80, label: 'Cleaner' },
  { id: 61, label: 'Data Entry/Computer Operator' },
  { id: 77, label: 'Delivery Man' },
  { id: 67, label: 'Driver' },
  { id: 66, label: 'Electrician/Electronics Technician' },
  { id: 89, label: 'Fire Safety/Firefighter' },
  { id: 81, label: 'Gardener' },
  { id: 78, label: 'Garments technician/Machine operator' },
  { id: 71, label: 'Graphic Designer' },
  { id: 86, label: 'Gym/Fitness Trainer' },
  { id: 69, label: 'Housekeeper' },
  { id: 85, label: 'Imam/Khatib/Muezzin' },
  { id: 87, label: 'Interpreter' },
  { id: 75, label: 'Mason/Construction worker' },
  { id: 62, label: 'Mechanic/Technician' },
  { id: 63, label: 'Nurse' },
  { id: 65, label: 'Pathologist/Lab Assistant' },
  { id: 79, label: 'Peon' },
  { id: 92, label: 'Physiotherapist' },
  { id: 73, label: 'Plumber/Pipe fitting' },
  { id: 84, label: 'Sales Representative (SR)' },
  { id: 70, label: 'Security Guard' },
  { id: 74, label: 'Sewing machine operator' },
  { id: 83, label: 'Showroom Assistant/Salesman' },
  { id: 64, label: 'Waiter/Waitress' },
  { id: 72, label: 'Welder' },
];

export const BD_CATEGORY_ID = Object.fromEntries(
  [...BD_PROFESSIONAL, ...BD_SKILLED].map((c) => [c.label, c.id])
);

// The Field/Department dropdown, grouped. "Common" keeps the original quick
// picks (they map to curated synonym lists in rank.js, not Bdjobs categories).
export const FIELD_GROUPS = [
  { label: 'Common', options: ['CSE', 'EEE', 'IT', 'Data Analysis', 'Economics'] },
  { label: 'Bdjobs categories', options: BD_PROFESSIONAL.map((c) => c.label) },
  { label: '', options: ['Other'] },
];

// The Role dropdown: a few common picks plus Bdjobs' own designation taxonomy
// (their "special skilled category" list — the closest thing Bdjobs has to
// roles, and each doubles as a precise category id for their search API).
export const ROLE_GROUPS = [
  { label: 'Common', options: ['Manager', 'Junior Frontend Developer', 'Trainee/Intern'] },
  { label: 'Bdjobs designations', options: BD_SKILLED.map((c) => c.label) },
  { label: '', options: ['Other'] },
];

// The Level dropdown mirrors Bdjobs' Job Level filter exactly.
export const LEVEL_OPTIONS = ['Entry', 'Mid', 'Top'];

// Bdjobs GetJobSearch accepts a single jobLevel value: Entry | Mid | Top.
export function bdJobLevelFor(levels = []) {
  const valid = levels.filter((l) => LEVEL_OPTIONS.includes(l));
  return valid.length === 1 ? valid[0] : '';
}
