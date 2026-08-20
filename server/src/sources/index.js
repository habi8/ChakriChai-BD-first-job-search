// Source registry. Order here is presentation-neutral — ranking decides order.
import * as greenhouse from './greenhouse.js';
import * as lever from './lever.js';
import * as remoteok from './remoteok.js';
import * as arbeitnow from './arbeitnow.js';
import * as bdjobs from './bdjobs.js';
import * as bdcompanies from './bdcompanies.js';
import * as adzuna from './adzuna.js';

export const sources = [bdjobs, bdcompanies, greenhouse, lever, remoteok, arbeitnow, adzuna];

export const sourceById = Object.fromEntries(sources.map((s) => [s.id, s]));
