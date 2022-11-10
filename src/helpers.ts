import * as core from '@actions/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { chmodSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import axios from 'axios';

const createScriptFile = async (inlineScript: string, powershell: boolean): Promise<string> => {
    const TEMP_DIRECTORY: string = process.env.RUNNER_TEMP || tmpdir();
    const fileExtension: string = powershell ? "ps1" : "sh";
    const fileName: string = `PNP_PS_CONNECT_GITHUB_ACTION_${new Date().getTime().toString()}.${fileExtension}`;
    const filePath: string = join(TEMP_DIRECTORY, fileName);
    writeFileSync(filePath, `${inlineScript}`);
    chmodSync(filePath, 0o755);
    return filePath;
}

const deleteFile = async (filePath: string) => {
    if (existsSync(filePath)) {
        try {
            unlinkSync(filePath);
        }
        catch (err: any) {
            core.warning(err.toString());
        }
    }
}

const getParams = async (federatedToken: string): Promise<URLSearchParams> => {

    let { tenantName, clientId } = await import('./inputs');

    var params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    params.append('client_assertion', federatedToken);
    params.append('scope', `https://${tenantName}.sharepoint.com/.default`);
    return params;
}

const getAccessToken = async (): Promise<string | null> => {
    try {

        let { tenantId, audience } = await import('./inputs');

        core.info("ℹ️ Getting federated token...");
        let federatedToken: string = await core.getIDToken(audience);

        //if federated token is empty then core.setFailed
        if (!federatedToken) {
            core.setFailed("❌ Failed to get federated token");
            return null;
        }

        core.info("ℹ️ Getting access token...");
        const requestTokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

        const params = await getParams(federatedToken);

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        const response = await axios.post(requestTokenUrl, params, { headers: headers });

        if (response.status == 200) {
            return response.data.access_token;
        }

        return null;

    } catch (err: any) {
        core.error(err.toString());
        return null;
    }
}

const composeScript = async (accessToken: string): Promise<string> => {

    let { siteUrl, pnpPowerShellScript } = await import('./inputs');

    // connect to the tenant and run script
    const script =
        `   
            $ErrorActionPreference = "Stop"
            Set-PSRepository PSGallery -InstallationPolicy Trusted
            Install-Module -Name PnP.PowerShell -SkipPublisherCheck
            Connect-PnPOnline -Url ${siteUrl} -AccessToken ${accessToken}
            Write-Host "✅ Successfully connected to ${siteUrl}"
            Get-PnPWeb
            Write-Host "ℹ️ Running PnP PowerShell script..."
            ${pnpPowerShellScript}
        `;
    return script;
}

export { createScriptFile, deleteFile, getAccessToken, composeScript };