import { compileFilterWorkspace } from './filterCompiler';

async function main() {
  const summary = await compileFilterWorkspace(process.cwd());
  console.log(
    `✅ Compiled filters -> global: ${summary.globalRulesCount}, vietnam: ${summary.vietnamRulesCount}, redirects: ${summary.redirectRulesCount}, cosmetic: ${summary.cosmeticCount}, scriptlets: ${summary.scriptletCount}`
  );
}

main().catch((err) => {
  console.error('❌ Filter compilation failed:', err);
  process.exit(1);
});
