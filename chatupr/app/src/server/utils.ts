export function requireNodeEnvVar(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`Env var ${name} is undefined`);
  } else {
    return value;
  }
}

export function randomIntFromInterval(min: number, max: number) { // min and max included 
  return Math.floor(Math.random() * (max - min + 1) + min);
}