import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const generatorPath = fileURLToPath(new URL("../reporting/generate_report.py", import.meta.url));

function pythonExecutable() {
  if (process.env.REPORT_PYTHON) return process.env.REPORT_PYTHON;
  if (process.platform === "win32") return "python";
  return fileURLToPath(new URL("../../.venv/bin/python", import.meta.url));
}

export function generateReport(format, payload, { timeoutMs = 20_000 } = {}) {
  if (!["pdf", "xlsx"].includes(format))
    return Promise.reject(Object.assign(new Error("Unsupported report format."), { code: "FORMAT_INVALID" }));
  return new Promise((resolve, reject) => {
    const processHandle = spawn(pythonExecutable(), [generatorPath, format], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const output = [];
    const errors = [];
    let outputSize = 0;
    let errorSize = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      processHandle.kill();
      fail(Object.assign(new Error("Report generation timed out."), { code: "REPORT_TIMEOUT" }));
    }, timeoutMs);
    processHandle.stdout.on("data", (chunk) => {
      outputSize += chunk.length;
      if (outputSize > 25 * 1024 * 1024) {
        processHandle.kill();
        fail(Object.assign(new Error("Generated report is too large."), { code: "REPORT_TOO_LARGE" }));
        return;
      }
      output.push(chunk);
    });
    processHandle.stderr.on("data", (chunk) => {
      if (errorSize >= 8_192) return;
      const bounded = chunk.subarray(0, 8_192 - errorSize);
      errors.push(bounded);
      errorSize += bounded.length;
    });
    processHandle.on("error", () =>
      fail(Object.assign(new Error("Python reporting service is unavailable."), { code: "REPORT_ENGINE_UNAVAILABLE" })),
    );
    processHandle.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        const detail = Buffer.concat(errors).toString("utf8").trim();
        fail(Object.assign(new Error(detail || "Report generation failed."), { code: "REPORT_GENERATION_FAILED" }));
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(output));
    });
    processHandle.stdin.on("error", () =>
      fail(Object.assign(new Error("Could not send data to the reporting service."), { code: "REPORT_ENGINE_UNAVAILABLE" })),
    );
    processHandle.stdin.end(JSON.stringify(payload));
  });
}
