import { z } from "zod";

export const env = z.object({
  ORACLE_CONNECTION_STRING: z.string(),
  ORACLE_USERNAME: z.string(),
  ORACLE_PASSWORD: z.string(),
}).parse(process.env);
