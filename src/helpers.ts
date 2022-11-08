import * as core from '@actions/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { chmodSync, writeFileSync, existsSync, unlinkSync } from 'fs';

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

export const composeScript = async (): Promise<string> => {
    const tenantId: string = core.getInput("TENANT_ID", { required: true });
    const tenantName: string = core.getInput("TENANT_NAME", { required: true });
    const clientId: string = core.getInput("CLIENT_ID", { required: true });
    const siteUrl: string = core.getInput("SITE_URL", { required: true });
    let audience: string = core.getInput('AUDIENCE', { required: false });
    let pnpPowerShellScript: string = core.getInput('PNP_POWERSHELL_SCRIPT', { required: false });

    //if audience is not provided, use the api://AzureADTokenExchange as the audience
    if (!audience) {
        core.info("ℹ️ Audience not provided, using default value: api://AzureADTokenExchange");
        audience = "api://AzureADTokenExchange";
    }

    // get the federated token
    let federatedToken = await core.getIDToken(audience);

    // get the access token and connect to the tenant
    const script =
        `   
                $ErrorActionPreference = "Stop"
                $requestTokenUrl = "https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token"
                $data = @{
                    scope="https://${tenantName}.sharepoint.com/.default"
                    client_id="${clientId}"
                    client_assertion_type="urn:ietf:params:oauth:client-assertion-type:jwt-bearer" 
                    client_assertion="${federatedToken}" 
                    grant_type="client_credentials" 
                }
                $contentType = 'application/x-www-form-urlencoded'
                $authResponse  = Invoke-RestMethod -Method Post -Uri $requestTokenUrl -Body $data -ContentType $contentType
                $accessToken = $authResponse.access_token
                Set-PSRepository PSGallery -InstallationPolicy Trusted
                Install-Module -Name PnP.PowerShell -SkipPublisherCheck
                Connect-PnPOnline -Url ${siteUrl} -AccessToken $accessToken
                Write-Host "✅ Successfully connected to ${siteUrl}"
                Get-PnPWeb
                Write-Host "ℹ️ Running PnP PowerShell script..."
                ${pnpPowerShellScript}
            `;
    return script;
}