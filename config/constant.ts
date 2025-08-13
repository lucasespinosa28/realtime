
const host =  process.env.HOST;
const key = process.env.PK;
const default_host = process.env.DEFAULT_HOST;
const default_ping_interval = process.env.DEFAULT_PING_INTERVAL;
const proxy = process.env.PROXY_ADDRESS;
if (!host) {
  throw new Error('Missing HOST environment variable');
}
if (!key) {
  throw new Error('Missing PK environment variable');
}

if(!default_host){
    throw new Error('Missing DEFAULT_HOST environment variable');
}

if(!default_ping_interval){
   throw new Error('Missing DEFAULT_PING_INTERVAL environment variable');
}
if(!proxy){
    throw new Error('Missing PROXY_ADDRESS environment variable');
}
const CONSTANT = {
    host,
    key,
    default_host,
    default_ping_interval,
    proxy,
}

export default CONSTANT;