import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import {
  applyCommand,
  startIntake,
} from "../../../supabase/functions/_shared/cie33/engine";
import type {
  IntakeState,
  IntakeCommand,
} from "../../../supabase/functions/_shared/cie33/engine";
const root = process.cwd();
let state: IntakeState | null = null;
const receipts = new Set<string>();
export default defineConfig({
  root,
  optimizeDeps: { entries: ["tests/cie33/browser/index.html"] },
  plugins: [
    react(),
    {
      name: "cie33-synthetic-fixture",
      configureServer(server) {
        server.middlewares.use("/__cie33_fixture", async (req, res) => {
          let raw = "";
          for await (const chunk of req) raw += chunk;
          try {
            const body = JSON.parse(raw);
            const now = new Date().toISOString();
            if (body.action !== "read" && !receipts.has(body.request_id)) {
              state =
                body.action === "start"
                  ? startIntake(
                      "11111111-1111-4111-8111-111111111111",
                      body.sensitive_consent,
                      now,
                    )
                  : applyCommand(
                      state!,
                      {
                        action: body.action,
                        answer: body.answer,
                        witnessId: body.witness_id,
                      } as IntakeCommand,
                      body.request_id,
                      now,
                    );
              receipts.add(body.request_id);
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ state }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ message: (e as Error).message }));
          }
        });
      },
    },
  ],
  resolve: {
    alias: [
      ...[
        "@/integrations/supabase/client",
        "@/context/AuthContext",
        "@/context/ViewAsContext",
        "@/context/CIEAssessmentContext",
        "@/context/OnboardingContext",
      ].map((find) => ({
        find,
        replacement: path.join(root, "tests/cie33/browser/adapters.ts"),
      })),
      { find: "@", replacement: path.join(root, "src") },
      {
        find: "@shared",
        replacement: path.join(root, "supabase/functions/_shared"),
      },
    ],
  },
  server: { host: "127.0.0.1", port: 5173 },
});
