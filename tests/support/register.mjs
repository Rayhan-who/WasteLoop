// Registers the test resolve hooks. Used as: node --import ./tests/support/register.mjs --test ...
import { register } from "node:module";

register("./resolve-hooks.mjs", import.meta.url);
