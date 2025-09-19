import bcrypt from 'bcrypt';
export const hash = (pwd) => bcrypt.hash(pwd, 12);
export const compare = (pwd, h) => bcrypt.compare(pwd, h);
