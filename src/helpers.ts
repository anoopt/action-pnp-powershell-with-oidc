import * as core from '@actions/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { chmodSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import axios from 'axios';

export const createScriptFile = async (inlineScript: string, powershell: boolean): Promise<string> => {
    const TEMP_DIRECTORY: string = process.env.RUNNER_TEMP || tmpdir();
    const fileExtension: string = powershell ? "ps1" : "sh";
    const fileName: string = `PNP_PS_CONNECT_GITHUB_ACTION_${new Date().getTime().toString()}.${fileExtension}`;
    const filePath: string = join(TEMP_DIRECTORY, fileName);
    writeFileSync(filePath, `${inlineScript}`);
    chmodSync(filePath, 0o755);
    return filePath;
}

export const deleteFile = async (filePath: string) => {
    if (existsSync(filePath)) {
        try {
            unlinkSync(filePath);
        }
        catch (err: any) {
            core.warning(err.toString());
        }
    }
}

export const getAccessToken = async (): Promise<string | null> => {
    try {

        const tenantId: string = core.getInput("TENANT_ID", { required: true });
        const tenantName: string = core.getInput("TENANT_NAME", { required: true });
        const clientId: string = core.getInput("CLIENT_ID", { required: true });
        let audience: string = core.getInput('AUDIENCE', { required: false });

        // mask the client id, tenant id and tenant name
        core.setSecret(tenantId);
        core.setSecret(tenantName);
        core.setSecret(clientId);

        core.info("ℹ️ Getting federated token...");

        //if audience is not provided, use the api://AzureADTokenExchange as the audience
        if (!audience) {
            core.info("ℹ️ Audience not provided, using default value: api://AzureADTokenExchange");
            audience = "api://AzureADTokenExchange";
        }

        let federatedToken = await core.getIDToken(audience);

        core.info("ℹ️ Getting access token...");

        var params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', clientId);
        params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
        params.append('client_assertion', federatedToken);
        params.append('scope', `https://${tenantName}.sharepoint.com/.default`);

        const requestTokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

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

export const composeScript = async (accessToken: string): Promise<string> => {
    const siteUrl: string = core.getInput("SITE_URL", { required: true });
    let pnpPowerShellScript: string = core.getInput('PNP_POWERSHELL_SCRIPT', { required: false });

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