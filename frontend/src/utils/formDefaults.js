// Dynamic form defaults utility to avoid hardcoded values

export const getDefaultSipAmount = () => {
  // Default to a common SIP amount that's reasonable for most investors
  return '10000'; // ₹10,000 is a popular monthly SIP amount
};

export const getDefaultLumpAmount = () => {
  // Default to a reasonable lump sum for analysis
  return '500000'; // ₹5 lakhs is a common investment amount
};

export const getDefaultStartDate = () => {
  // Default to 5 years ago for meaningful analysis
  const date = new Date();
  date.setFullYear(date.getFullYear() - 5);
  return date.toISOString().split('T')[0];
};

export const getDefaultEndDate = () => {
  // Default to current date
  return new Date().toISOString().split('T')[0];
};

export const getDefaultLumpDate = () => {
  // Default to 3 years ago for lump sum analysis
  const date = new Date();
  date.setFullYear(date.getFullYear() - 3);
  return date.toISOString().split('T')[0];
};

export const getDefaultBenchmarkIndex = () => {
  // Default to the most commonly used Indian index
  return 'nifty50';
};

export const getDefaultInvestmentType = () => {
  // SIP is more common for retail investors
  return 'sip';
};