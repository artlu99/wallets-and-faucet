import { encode as b85encode } from "@alttiri/base85";
import { randomBytes } from "./random";

const short =b85encode(randomBytes(16));
const long = b85encode(new TextEncoder().encode("1234567890".repeat(25)));

console.log(short.length);
console.log(long.length);

console.log(short);
