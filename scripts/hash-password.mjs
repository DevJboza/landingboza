import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const supplied = process.argv[2];
let password = supplied;
if (!password) {
  const rl = createInterface({ input: stdin, output: stdout });
  password = await rl.question("Contraseña a proteger: ");
  rl.close();
}
if (!password || password.length < 10) {
  console.error("La contraseña debe tener al menos 10 caracteres.");
  process.exit(1);
}
console.log(await bcrypt.hash(password, 12));
