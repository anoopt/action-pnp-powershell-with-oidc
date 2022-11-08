import * as core from '@actions/core';
import { exec } from '@actions/exec';
import { createScriptFile, deleteFile, composeScript } from './helpers';

async function main() {

    let scriptPath: string = "";

    try {

        core.info("ℹ️ Running initial tasks...");

        // compose the script
        const script: string = await composeScript();

        core.info("ℹ️ Creating script file...");

        // create the script file
        scriptPath = await createScriptFile(script, true);

        core.info("ℹ️ Executing script file...");

        // run the script
        await exec('pwsh', ['-f', scriptPath]);

        core.info("✅ Done.");

    } catch (err: any) {

        core.error("🚨 An error occurred.");
        core.setFailed(err);

    } finally {

        await deleteFile(scriptPath);

    }
}

main();