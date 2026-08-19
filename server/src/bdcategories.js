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

// The Role dropdown: Bdjobs' own designation taxonomy (their "special skilled
// category" list — each doubles as a precise category id for their search
// API). Field-specific roles are suggested dynamically via FIELD_ROLE_MAP.
export const ROLE_GROUPS = [
  { label: 'Bdjobs designations', options: BD_SKILLED.map((c) => c.label) },
  { label: '', options: ['Other'] },
];

// The Level dropdown mirrors Bdjobs' Job Level filter exactly.
export const LEVEL_OPTIONS = ['Entry', 'Mid', 'Top'];

// Field-specific role suggestions: when the user picks a field, the Role
// dropdown surfaces these first. Curated for the big fields; every other
// Bdjobs category falls back to the generic BD job ladder.
const GENERIC_ROLES = ['Officer', 'Executive', 'Senior Executive', 'Assistant Manager', 'Manager', 'Trainee/Intern'];

export const FIELD_ROLE_MAP = {
  CSE: ['Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Mobile App Developer', 'Web Developer', 'DevOps Engineer', 'QA/Test Engineer', 'Data Engineer', 'Machine Learning Engineer', 'Trainee/Intern'],
  IT: ['IT Officer', 'System Administrator', 'Network Engineer', 'IT Support Engineer', 'Database Administrator', 'Cyber Security Analyst', 'Cloud Engineer', 'IT Manager', 'Trainee/Intern'],
  EEE: ['Electrical Engineer', 'Electronics Engineer', 'Power Engineer', 'Embedded Systems Engineer', 'Hardware Engineer', 'Maintenance Engineer', 'Instrumentation Engineer', 'Trainee/Intern'],
  'Data Analysis': ['Data Analyst', 'Business Analyst', 'Data Scientist', 'BI Analyst', 'Research Analyst', 'Statistician', 'Trainee/Intern'],
  Economics: ['Economist', 'Research Analyst', 'Policy Analyst', 'Investment Analyst', 'Market Research Analyst', 'Trainee/Intern'],
  'IT/Telecommunication': ['Software Engineer', 'Web Developer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Mobile App Developer', 'System Administrator', 'Network Engineer', 'Database Administrator', 'IT Support Engineer', 'Trainee/Intern'],
  'Accounting/Finance': ['Accountant', 'Accounts Officer', 'Finance Executive', 'Auditor', 'Tax Consultant', 'Finance Manager', 'Chief Financial Officer', 'Trainee/Intern'],
  'Bank/Non-Bank Fin. Institution': ['Trainee Officer', 'Bank Officer', 'Credit Analyst', 'Loan Officer', 'Relationship Manager', 'Branch Manager'],
  'Marketing/Sales': ['Marketing Executive', 'Sales Executive', 'Business Development Executive', 'Brand Manager', 'Marketing Manager', 'Sales Manager', 'Territory Manager', 'Trainee/Intern'],
  'Design/Creative': ['Graphic Designer', 'UI/UX Designer', 'Motion Designer', 'Illustrator', 'Video Editor', 'Creative Director', 'Trainee/Intern'],
  'HR/Org. Development': ['HR Officer', 'HR Executive', 'Recruitment Specialist', 'Payroll Officer', 'HR Manager', 'Trainee/Intern'],
  'Education/Training': ['Teacher', 'Lecturer', 'Professor', 'Trainer', 'Academic Coordinator', 'Curriculum Specialist'],
  'Engineer/Architect': ['Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Site Engineer', 'Project Engineer', 'Structural Engineer', 'Architect', 'Trainee/Intern'],
  'Garments/Textile': ['Merchandiser', 'Production Officer', 'Quality Controller', 'Textile Engineer', 'Compliance Officer', 'Pattern Master'],
  'Healthcare/Medical': ['Medical Officer', 'Doctor', 'Nurse', 'Pharmacist', 'Lab Technician', 'Physiotherapist'],
  'NGO/Development': ['Program Officer', 'Field Officer', 'Project Coordinator', 'M&E Officer', 'Community Mobilizer', 'Program Manager'],
  'Customer Service/Call Centre': ['Customer Service Representative', 'Call Centre Agent', 'Customer Support Executive', 'Team Leader'],
  'E-commerce/Digital Marketing': ['Digital Marketing Executive', 'SEO Specialist', 'Social Media Manager', 'Content Writer', 'E-commerce Executive', 'Performance Marketing Specialist'],
  'Supply Chain/Procurement': ['Supply Chain Officer', 'Procurement Officer', 'Logistics Executive', 'Warehouse In-Charge', 'Supply Chain Manager'],
  'Media/Advertisement/Event Mgt.': ['Content Writer', 'Copywriter', 'Journalist', 'Video Editor', 'Event Coordinator', 'Media Executive'],
};
for (const c of BD_PROFESSIONAL) {
  if (!FIELD_ROLE_MAP[c.label]) FIELD_ROLE_MAP[c.label] = GENERIC_ROLES;
}

// Bdjobs GetJobSearch accepts a single jobLevel value: Entry | Mid | Top.
export function bdJobLevelFor(levels = []) {
  const valid = levels.filter((l) => LEVEL_OPTIONS.includes(l));
  return valid.length === 1 ? valid[0] : '';
}
