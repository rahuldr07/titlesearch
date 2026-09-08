import { z } from "zod";

export const Thing = z.object({ id: z.string() });
export type Thing = { id: string };
