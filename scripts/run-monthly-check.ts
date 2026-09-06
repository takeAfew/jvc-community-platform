import { runMonthlyVerification } from "../src/lib/monthly-checker";

async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`Starting JVC monthly ecosystem verification (dry-run: ${isDryRun})...`);

  try {
    const summary = await runMonthlyVerification({ dryRun: isDryRun });
    console.log("Completed with summary:", summary);
    process.exit(0);
  } catch (error) {
    console.error("Fatal error during verification run:", error);
    process.exit(1);
  }
}

main();
