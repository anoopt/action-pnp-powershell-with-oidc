import * as core from '@actions/core';

const tenantId = core.getInput('TENANT_ID', { required: true });
core.setSecret(tenantId);

const tenantName: string = core.getInput("TENANT_NAME", { required: true });

const clientId: string = core.getInput("CLIENT_ID", { required: true });
core.setSecret(clientId);

let audience: string = core.getInput('AUDIENCE', { required: false });
//if audience is not provided, use the api://AzureADTokenExchange as the audience
if (!audience) {
    core.info("ℹ️ Audience not provided, using default value: api://AzureADTokenExchange");
    audience = "api://AzureADTokenExchange";
}

const siteUrl: string = core.getInput("SITE_URL", { required: true });

let pnpPowerShellScript: string = core.getInput('PNP_POWERSHELL_SCRIPT', { required: false });

export { tenantId, tenantName, clientId, audience, siteUrl, pnpPowerShellScript };