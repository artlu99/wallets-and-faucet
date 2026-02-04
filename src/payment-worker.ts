import { Hono } from "hono";
import { paymentMiddleware } from "x402-hono";

interface PaymentEnv {
  FACILITATOR_URL: string;
  PAYTO_ADDRESS: string;
}

const app = new Hono<{ Bindings: PaymentEnv }>();

// x402 payment middleware for all routes
app.use("/*", async (c, next) => {
  const middleware = paymentMiddleware(
    c.env.PAYTO_ADDRESS as `0x${string}`,
    {
      "GET /eoa/*": {
        price: "$0.10",
        network: "base",
        config: {
          description: "Pay to retrieve private key",
        },
      },
    },
    { url: c.env.FACILITATOR_URL },
  );

  return middleware(c, next);
});

// If payment succeeds, return 200 OK (main worker will handle the actual response)
app.all("/*", (c) => {
  return c.json({ success: true }, 200);
});

export default app;
