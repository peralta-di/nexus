import { handleWebhook } from "../_shared/pagos.ts";

Deno.serve(handleWebhook);
